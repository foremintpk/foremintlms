import "server-only";
import { unwrapWebhook, WebhookVerificationError } from "@whop/sdk/helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { IntegrationNotConfiguredError } from "@/lib/services/integrations";
import type { Json } from "@/types/database";
import { getWhopConfig } from "./whop";
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

export async function receiveWhopWebhook(rawBody: string, headers: Headers): Promise<WebhookOutcome> {
  let secret: string | undefined;
  try {
    secret = (await getWhopConfig()).webhookSecret;
  } catch (err) {
    if (!(err instanceof IntegrationNotConfiguredError)) throw err;
  }
  if (!secret) {
    return { status: 503, body: { error: "Whop webhooks are not configured on this site yet." } };
  }

  const h = lowerHeaders(headers);
  let event: { id?: string; type?: string; data?: unknown; account_id?: string | null };
  try {
    event = unwrapWebhook(rawBody, { headers: h, key: secret });
  } catch (err) {
    if (err instanceof WebhookVerificationError || err instanceof Error) {
      return { status: 400, body: { error: "Invalid webhook signature." } };
    }
    throw err;
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
