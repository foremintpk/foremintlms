import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { unwrapWebhook } from "@whop/sdk/helpers";

/**
 * Standard Webhooks signing as Whop does it: HMAC-SHA256 over
 * "{webhook-id}.{webhook-timestamp}.{raw body}" keyed with the literal bytes
 * of the `ws_` secret, base64-encoded, sent as "v1,<sig>".
 */
const SECRET = "ws_test_secret_for_unit_tests";

function sign(id: string, timestamp: number, body: string, secret = SECRET) {
  const sig = createHmac("sha256", Buffer.from(secret, "utf8")).update(`${id}.${timestamp}.${body}`).digest("base64");
  return { "webhook-id": id, "webhook-timestamp": String(timestamp), "webhook-signature": `v1,${sig}` };
}

const now = () => Math.floor(Date.now() / 1000);
const body = JSON.stringify({ id: "evt_1", type: "payment.succeeded", data: { id: "pay_1" } });

describe("Whop signature verification (SDK unwrapWebhook)", () => {
  it("accepts a correctly signed body", () => {
    const event = unwrapWebhook<{ type: string }>(body, { headers: sign("msg_1", now(), body), key: SECRET });
    expect(event.type).toBe("payment.succeeded");
  });
  it("rejects a tampered body", () => {
    const headers = sign("msg_1", now(), body);
    expect(() => unwrapWebhook(body.replace("pay_1", "pay_2"), { headers, key: SECRET })).toThrow();
  });
  it("rejects the wrong secret", () => {
    expect(() => unwrapWebhook(body, { headers: sign("msg_1", now(), body, "ws_other"), key: SECRET })).toThrow();
  });
  it("rejects a stale timestamp (replay protection)", () => {
    expect(() => unwrapWebhook(body, { headers: sign("msg_1", now() - 60 * 60, body), key: SECRET })).toThrow();
  });
  it("rejects missing signature headers", () => {
    expect(() => unwrapWebhook(body, { headers: {}, key: SECRET })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Intake: storage + duplicate handling, with the database and API mocked.
// ---------------------------------------------------------------------------

interface EventRow {
  id: string;
  provider: string;
  event_id: string;
  event_type: string;
  payload: unknown;
  status: string;
  attempts: number;
  received_at: string;
  last_error: string | null;
  next_attempt_at: string | null;
  processed_at: string | null;
}

const store: { events: EventRow[] } = { events: [] };
const syncPayment = vi.fn<(id: string) => Promise<object>>(async () => ({}));
const syncMembership = vi.fn<(id: string) => Promise<object>>(async () => ({}));

function eventsTable() {
  let filters: [string, unknown][] = [];
  let neq: [string, unknown] | null = null;
  let pendingUpdate: Partial<EventRow> | null = null;
  let pendingInsert: EventRow | null = null;
  const match = (r: EventRow) => filters.every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v) && (!neq || (r as unknown as Record<string, unknown>)[neq[0]] !== neq[1]);
  const builder = {
    insert(row: Partial<EventRow>) {
      pendingInsert = {
        id: `row_${store.events.length + 1}`,
        received_at: new Date().toISOString(),
        last_error: null,
        next_attempt_at: null,
        processed_at: null,
        ...row,
      } as EventRow;
      return builder;
    },
    update(values: Partial<EventRow>) {
      pendingUpdate = values;
      return builder;
    },
    select() {
      return builder;
    },
    eq(k: string, v: unknown) {
      filters.push([k, v]);
      return builder;
    },
    neq(k: string, v: unknown) {
      neq = [k, v];
      return builder;
    },
    async single() {
      return builder.resolve(true);
    },
    async maybeSingle() {
      return builder.resolve(false);
    },
    then(resolve: (v: unknown) => void) {
      resolve(builder.resolve(false));
    },
    resolve(strict: boolean) {
      if (pendingInsert) {
        const row = pendingInsert;
        pendingInsert = null;
        if (store.events.some((e) => e.provider === row.provider && e.event_id === row.event_id)) {
          return { data: null, error: { code: "23505", message: "duplicate" } };
        }
        store.events.push(row);
        return { data: row, error: null };
      }
      const rows = store.events.filter(match);
      if (pendingUpdate) {
        for (const r of rows) Object.assign(r, pendingUpdate);
        pendingUpdate = null;
      }
      filters = [];
      neq = null;
      const first = rows[0] ?? null;
      if (strict && !first) return { data: null, error: { code: "PGRST116", message: "no rows" } };
      return { data: first, error: null };
    },
  };
  return builder;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (table: string) => (table === "webhook_events" ? eventsTable() : eventsTable()) }),
}));
type SecretSource = { source: "environment" | "settings"; secret: string };
const secrets = vi.fn(async (): Promise<SecretSource[]> => [{ source: "settings", secret: SECRET }]);
vi.mock("@/lib/services/integrations", () => ({
  getWhopWebhookSecrets: () => secrets(),
  IntegrationNotConfiguredError: class IntegrationNotConfiguredError extends Error {},
}));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: async () => true }));
vi.mock("@/lib/services/payments/sync", () => ({
  syncPaymentFromWhop: (id: string) => syncPayment(id),
  syncMembershipFromWhop: (id: string) => syncMembership(id),
}));

describe("webhook intake", () => {
  beforeEach(() => {
    store.events = [];
    secrets.mockImplementation(async () => [{ source: "settings" as const, secret: SECRET }]);
    syncPayment.mockReset();
    syncPayment.mockImplementation(async () => ({}));
    syncMembership.mockReset();
  });

  async function deliver(id: string, payload: object) {
    const { receiveWhopWebhook } = await import("@/lib/services/payments/webhooks");
    const raw = JSON.stringify(payload);
    return receiveWhopWebhook(raw, new Headers(sign(id, now(), raw)));
  }

  it("rejects an invalid signature and records only a diagnostic (no payload, no secret)", async () => {
    const { receiveWhopWebhook } = await import("@/lib/services/payments/webhooks");
    const res = await receiveWhopWebhook(body, new Headers({ ...sign("msg_x", now(), body), "webhook-signature": "v1,bad" }));
    expect(res.status).toBe(400);
    expect(syncPayment).not.toHaveBeenCalled();
    expect(store.events).toHaveLength(1);
    expect(store.events[0]).toMatchObject({ event_type: "signature_rejected", status: "ignored" });
    const recorded = JSON.stringify(store.events[0]);
    expect(recorded).not.toContain(SECRET);
    expect(recorded).not.toContain("pay_1");
    expect(store.events[0].payload).toMatchObject({ secretsTried: [{ source: "settings", length: SECRET.length, prefix: "ws_" }] });
  });

  it("answers 503 when no webhook secret is configured", async () => {
    secrets.mockImplementation(async () => []);
    const { receiveWhopWebhook } = await import("@/lib/services/payments/webhooks");
    const res = await receiveWhopWebhook(body, new Headers(sign("msg_y", now(), body)));
    expect(res.status).toBe(503);
  });

  it("accepts the saved secret even when a stale environment secret is also set", async () => {
    secrets.mockImplementation(async () => [
      { source: "environment" as const, secret: "ws_stale_value" },
      { source: "settings" as const, secret: SECRET },
    ]);
    const res = await deliver("msg_z", { id: "evt_z", type: "payment.succeeded", data: { id: "pay_1" } });
    expect(res.status).toBe(200);
    expect(syncPayment).toHaveBeenCalledWith("pay_1");
  });

  it("re-fetches the payment and marks the event processed", async () => {
    const res = await deliver("msg_1", { id: "evt_1", type: "payment.succeeded", data: { id: "pay_1" } });
    expect(res.status).toBe(200);
    expect(syncPayment).toHaveBeenCalledWith("pay_1");
    expect(store.events[0].status).toBe("processed");
  });

  it("acknowledges a duplicate delivery without processing it again", async () => {
    await deliver("msg_dup", { id: "evt_2", type: "payment.succeeded", data: { id: "pay_2" } });
    const second = await deliver("msg_dup", { id: "evt_2", type: "payment.succeeded", data: { id: "pay_2" } });
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ duplicate: true });
    expect(syncPayment).toHaveBeenCalledTimes(1);
  });

  it("records failures with a backoff and asks Whop to retry", async () => {
    syncPayment.mockImplementationOnce(async () => {
      throw new Error("Whop timeout");
    });
    const first = await deliver("msg_fail", { id: "evt_3", type: "payment.succeeded", data: { id: "pay_3" } });
    expect(first.status).toBe(500);
    expect(store.events[0]).toMatchObject({ status: "failed", last_error: "Whop timeout" });
    expect(store.events[0].next_attempt_at).not.toBeNull();

    // Whop's retry (same webhook-id) is processed again and succeeds.
    const retry = await deliver("msg_fail", { id: "evt_3", type: "payment.succeeded", data: { id: "pay_3" } });
    expect(retry.status).toBe(200);
    expect(store.events[0]).toMatchObject({ status: "processed", attempts: 2 });
  });

  it("stores but ignores events that don't affect access", async () => {
    const res = await deliver("msg_ign", { id: "evt_4", type: "payout.created", data: { id: "po_1" } });
    expect(res.status).toBe(200);
    expect(store.events[0].status).toBe("ignored");
    expect(syncPayment).not.toHaveBeenCalled();
  });

  it("routes membership events to the membership sync", async () => {
    await deliver("msg_mem", { id: "evt_5", type: "membership.deactivated", data: { id: "mem_9" } });
    expect(syncMembership).toHaveBeenCalledWith("mem_9");
  });

  it("routes refunds to the payment they reverse", async () => {
    await deliver("msg_rf", { id: "evt_6", type: "refund.created", data: { id: "rf_1", payment_id: "pay_77" } });
    expect(syncPayment).toHaveBeenCalledWith("pay_77");
  });
});
