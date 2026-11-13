import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  computeZoomSignature,
  verifyZoomSignature,
  zoomEventId,
  zoomUrlValidationResponse,
  ZOOM_TIMESTAMP_TOLERANCE_SECONDS,
} from "@/lib/services/live/zoom-webhook";

const SECRET = "zoom-secret-token";
const BODY = JSON.stringify({ event: "meeting.started", event_ts: 1700000000000, payload: { object: { id: 123, uuid: "abc" } } });

describe("Zoom webhook signature", () => {
  it("matches Zoom's documented v0 HMAC-SHA256 format", () => {
    const ts = "1700000000";
    const expected = `v0=${createHmac("sha256", SECRET).update(`v0:${ts}:${BODY}`).digest("hex")}`;
    expect(computeZoomSignature(SECRET, ts, BODY)).toBe(expected);
  });

  it("accepts a valid, fresh signature", () => {
    const now = new Date(1_700_000_000_000);
    const ts = String(now.getTime() / 1000);
    const result = verifyZoomSignature({ secretToken: SECRET, signature: computeZoomSignature(SECRET, ts, BODY), timestamp: ts, rawBody: BODY, now });
    expect(result).toEqual({ ok: true });
  });

  it("rejects a tampered body", () => {
    const now = new Date(1_700_000_000_000);
    const ts = String(now.getTime() / 1000);
    const signature = computeZoomSignature(SECRET, ts, BODY);
    const result = verifyZoomSignature({ secretToken: SECRET, signature, timestamp: ts, rawBody: BODY.replace("123", "999"), now });
    expect(result).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects a signature made with another secret", () => {
    const now = new Date(1_700_000_000_000);
    const ts = String(now.getTime() / 1000);
    const result = verifyZoomSignature({ secretToken: SECRET, signature: computeZoomSignature("other", ts, BODY), timestamp: ts, rawBody: BODY, now });
    expect(result.ok).toBe(false);
  });

  it("rejects stale timestamps (replay protection)", () => {
    const sent = 1_700_000_000;
    const now = new Date((sent + ZOOM_TIMESTAMP_TOLERANCE_SECONDS + 5) * 1000);
    const ts = String(sent);
    const result = verifyZoomSignature({ secretToken: SECRET, signature: computeZoomSignature(SECRET, ts, BODY), timestamp: ts, rawBody: BODY, now });
    expect(result).toEqual({ ok: false, reason: "stale" });
  });

  it("rejects missing headers", () => {
    expect(verifyZoomSignature({ secretToken: SECRET, signature: null, timestamp: "1", rawBody: BODY })).toEqual({ ok: false, reason: "missing_headers" });
    expect(verifyZoomSignature({ secretToken: SECRET, signature: "v0=x", timestamp: null, rawBody: BODY })).toEqual({ ok: false, reason: "missing_headers" });
  });
});

describe("Zoom endpoint.url_validation", () => {
  it("returns the plain token and its HMAC-SHA256 hex digest", () => {
    const res = zoomUrlValidationResponse(SECRET, "qgg8vlvZRS6UYooatFL8Aw");
    expect(res.plainToken).toBe("qgg8vlvZRS6UYooatFL8Aw");
    expect(res.encryptedToken).toBe(createHmac("sha256", SECRET).update("qgg8vlvZRS6UYooatFL8Aw").digest("hex"));
    expect(res.encryptedToken).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("Zoom event idempotency key", () => {
  it("is stable for retries of the same delivery and differs between deliveries", () => {
    const envelope = JSON.parse(BODY);
    expect(zoomEventId(envelope, BODY)).toBe(zoomEventId(envelope, BODY));
    const other = JSON.stringify({ ...envelope, event_ts: 1700000000001 });
    expect(zoomEventId(JSON.parse(other), other)).not.toBe(zoomEventId(envelope, BODY));
  });
});
