import "server-only";
import { unwrapWebhook, WebhookVerificationError } from "@whop/sdk/helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWhopWebhookSecrets, IntegrationNotConfiguredError } from "@/lib/services/integrations";
import { checkRateLimit } from "@/lib/security/rate-limit";
import type { Json } from "@/types/database";
import { classifyWhopEvent, eventTarget, nextRetryDelayMs } from "./mapping";
import { syncMembershipFromWhop, syncPaymentFromWhop } from "./sync";
import type { WebhookEventRow } from "./types";

/**
 * Whop webhook intake.
 * 1. Verify the Standard Webhooks signature over the raw body (unwrapWebhook
 *    from @whop/sdk/helpers; the `ws_` secret is passed verbatim).
 * 2. Store the event keyed by `webhook-id` — retries reuse the id, so a
 *    processed event is acknowledged without running again.
 * 3. Re-fetch the payment/membership from the API and apply it.
 * Failures are recorded with a backoff and answered with a non-2xx status so
 * Whop retries; the cron job retries them too.
 */

export interface WebhookOutcome {
  status: number;
  body: Record<string, unknown>;
}

const STALE_PROCESSING_MS = 2 * 60_000;

function lowerHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

type WhopEvent = { id?: string; type?: string; data?: unknown; account_id?: string | null };

/**
 * Keep a record of a rejected delivery so the cause is visible in Admin →
 * Payments → Webhook events. Never stores the payload or any secret — only
 * the verifier's reason, header presence, clock skew and the length/prefix
 * of each secret tried. Rate-limited so junk requests can't flood the table.
 */
async function recordRejectedDelivery(h: Record<string, string>, reason: string, secrets: { source: string; secret: string }[], bodyBytes: number) {
  try {
    if (!(await checkRateLimit("whop-webhook-rejected", 30, 600))) return;
    const ts = Number(h["webhook-timestamp"]);
    const diagnostics = {
      reason,
      secretsTried: secrets.map((s) => ({ source: s.source, length: s.secret.length, prefix: s.secret.slice(0, 3) })),
      headers: { id: Boolean(h["webhook-id"]), timestamp: Boolean(h["webhook-timestamp"]), signature: Boolean(h["webhook-signature"]) },
      clockSkewSeconds: Number.isFinite(ts) ? Math.round(Date.now() / 1000 - ts) : null,
      bodyBytes,
    };
    await createAdminClient()
      .from("webhook_events")
      .insert({
        provider: "whop",
        event_id: `rejected:${(h["webhook-id"] || crypto.randomUUID()).slice(0, 120)}:${Date.now()}`,
        event_type: "signature_rejected",
        payload: diagnostics as unknown as Json,
        status: "ignored",
        attempts: 1,
        last_error: `Signature check failed: ${reason}`.slice(0, 500),
      });
  } catch (err) {
    console.error("[whop-webhook] could not record rejected delivery", err);
  }
}

export async function receiveWhopWebhook(rawBody: string, headers: Headers): Promise<WebhookOutcome> {
  const secrets = await getWhopWebhookSecrets();
  if (secrets.length === 0) {
    return { status: 503, body: { error: "Whop webhooks are not configured on this site yet." } };
  }

  const h = lowerHeaders(headers);
  let event: WhopEvent | null = null;
  let reason = "unknown";
  for (const { secret } of secrets) {
    try {
      event = unwrapWebhook(rawBody, { headers: h, key: secret }) as WhopEvent;
      break;
    } catch (err) {
      if (!(err instanceof WebhookVerificationError || err instanceof Error)) throw err;
      reason = err.message || err.name;
    }
  }
  if (!event) {
    console.error(`[whop-webhook] signature rejected: ${reason}`);
    await recordRejectedDelivery(h, reason, secrets, Buffer.byteLength(rawBody));
    return { status: 400, body: { error: "Invalid webhook signature." } };
  }

  const eventId = h["webhook-id"] || event.id;
  const eventType = typeof event.type === "string" ? event.type : "unknown";
  if (!eventId) return { status: 400, body: { error: "Missing webhook id." } };

  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .from("webhook_events")
    .insert({
      provider: "whop",
      event_id: eventId,
      event_type: eventType,
      payload: event as unknown as Json,
      status: "processing",
      attempts: 1,
    })
    .select("*")
    .single();

  let row = inserted as WebhookEventRow | null;
  if (error) {
    if (error.code !== "23505") throw new Error(`webhook store failed: ${error.message}`);
    const { data: existing } = await admin
      .from("webhook_events")
      .select("*")
      .eq("provider", "whop")
      .eq("event_id", eventId)
      .single();
    const prior = existing as WebhookEventRow;
    if (prior.status === "processed" || prior.status === "ignored") {
      return { status: 200, body: { received: true, duplicate: true } };
    }
    if (prior.status === "processing" && Date.now() - new Date(prior.received_at).getTime() < STALE_PROCESSING_MS && prior.attempts <= 1) {
      // Another delivery of this event is being handled right now.
      return { status: 200, body: { received: true, inFlight: true } };
    }
    const { data: claimed } = await admin
      .from("webhook_events")
      .update({ status: "processing", attempts: prior.attempts + 1 })
      .eq("id", prior.id)
      .neq("status", "processed")
      .select("*")
      .maybeSingle();
    if (!claimed) return { status: 200, body: { received: true, duplicate: true } };
    row = claimed as WebhookEventRow;
  }

  const outcome = await processStoredWhopEvent(row!);
  if (outcome === "failed") return { status: 500, body: { error: "Processing failed; it will be retried." } };
  return { status: 200, body: { received: true, outcome } };
}

/** Apply a stored event. Used by the webhook route and the retry job. */
export async function processStoredWhopEvent(row: WebhookEventRow): Promise<"processed" | "ignored" | "failed"> {
  const admin = createAdminClient();
  const payload = row.payload as { data?: unknown };
  const action = classifyWhopEvent(row.event_type);

  if (action === "ignore") {
    await admin.from("webhook_events").update({ status: "ignored", processed_at: new Date().toISOString(), last_error: null }).eq("id", row.id);
    return "ignored";
  }
  const target = eventTarget(action, payload.data);
  if (!target) {
    await admin
      .from("webhook_events")
      .update({ status: "ignored", processed_at: new Date().toISOString(), last_error: "Event has no payment or membership id" })
      .eq("id", row.id);
    return "ignored";
  }

  try {
    if (target.kind === "payment") await syncPaymentFromWhop(target.id);
    else await syncMembershipFromWhop(target.id);
    await admin
      .from("webhook_events")
      .update({ status: "processed", processed_at: new Date().toISOString(), last_error: null, next_attempt_at: null })
      .eq("id", row.id);
    return "processed";
  } catch (err) {
    const message = err instanceof IntegrationNotConfiguredError ? err.message : err instanceof Error ? err.message.slice(0, 500) : "Unknown error";
    console.error(`[whop-webhook] ${row.event_type} ${row.event_id} failed`, err);
    await admin
      .from("webhook_events")
      .update({
        status: "failed",
        last_error: message,
        next_attempt_at: new Date(Date.now() + nextRetryDelayMs(row.attempts)).toISOString(),
      })
      .eq("id", row.id);
    return "failed";
  }
}
