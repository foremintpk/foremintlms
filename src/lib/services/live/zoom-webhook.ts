import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Zoom webhook verification (developers.zoom.us/docs/api/webhooks):
 *   message   = `v0:${x-zm-request-timestamp}:${raw body}`
 *   signature = "v0=" + HMAC-SHA256(secretToken, message) as hex
 * URL validation: respond with { plainToken, encryptedToken } where
 *   encryptedToken = HMAC-SHA256(secretToken, plainToken) as hex.
 * Pure — unit tested.
 */

/** Reject deliveries whose timestamp is too far from now (replay protection). */
export const ZOOM_TIMESTAMP_TOLERANCE_SECONDS = 300;

export function computeZoomSignature(secretToken: string, timestamp: string, rawBody: string): string {
  return `v0=${createHmac("sha256", secretToken).update(`v0:${timestamp}:${rawBody}`).digest("hex")}`;
}

export function verifyZoomSignature(input: {
  secretToken: string;
  signature: string | null;
  timestamp: string | null;
  rawBody: string;
  now?: Date;
}): { ok: true } | { ok: false; reason: "missing_headers" | "stale" | "bad_signature" } {
  const { secretToken, signature, timestamp, rawBody } = input;
  if (!signature || !timestamp) return { ok: false, reason: "missing_headers" };
  const tsNum = Number(timestamp);
  if (!Number.isFinite(tsNum)) return { ok: false, reason: "missing_headers" };
  // Zoom sends seconds; tolerate milliseconds too.
  const tsMs = tsNum > 1e12 ? tsNum : tsNum * 1000;
  const now = (input.now ?? new Date()).getTime();
  if (Math.abs(now - tsMs) > ZOOM_TIMESTAMP_TOLERANCE_SECONDS * 1000) return { ok: false, reason: "stale" };
  const expected = Buffer.from(computeZoomSignature(secretToken, timestamp, rawBody));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: "bad_signature" };
  return { ok: true };
}

export function zoomUrlValidationResponse(secretToken: string, plainToken: string): { plainToken: string; encryptedToken: string } {
  return {
    plainToken,
    encryptedToken: createHmac("sha256", secretToken).update(plainToken).digest("hex"),
  };
}

export interface ZoomWebhookEnvelope {
  event: string;
  event_ts?: number;
  payload?: {
    plainToken?: string;
    account_id?: string;
    object?: {
      id?: number | string;
      uuid?: string;
      topic?: string;
      start_time?: string;
      end_time?: string;
      duration?: number;
      share_url?: string;
      password?: string;
      recording_play_passcode?: string;
      total_size?: number;
      recording_files?: { id?: string; recording_type?: string; play_url?: string; recording_start?: string; recording_end?: string }[];
      participant?: {
        id?: string;
        user_id?: string;
        participant_user_id?: string;
        user_name?: string;
        email?: string;
        join_time?: string;
        leave_time?: string;
      };
    };
  };
}

/**
 * Stable idempotency key for a Zoom delivery. Retries resend the identical
 * body, so a digest of event + event_ts + body identifies one delivery.
 */
export function zoomEventId(envelope: ZoomWebhookEnvelope, rawBody: string): string {
  const digest = createHash("sha256").update(rawBody).digest("hex").slice(0, 40);
  return `${envelope.event}:${envelope.event_ts ?? "0"}:${digest}`;
}
