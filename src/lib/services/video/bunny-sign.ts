import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Bunny Stream signing helpers (pure, no I/O).
 * Sources:
 *  - TUS upload: https://docs.bunny.net/reference/tus-resumable-uploads
 *    AuthorizationSignature = SHA256_HEX(library_id + api_key + expiration_time + video_id)
 *  - Embed token auth: https://docs.bunny.net/docs/stream-embed-token-authentication
 *    token = SHA256_HEX(token_security_key + video_id + expiration)
 *  - Webhooks: https://docs.bunny.net/docs/stream-webhook
 *    X-BunnyStream-Signature = HMAC_SHA256_HEX(raw_body, key = library read-only API key)
 */

export function bunnyTusSignature(libraryId: string, apiKey: string, expiresAt: number, videoId: string): string {
  return createHash("sha256").update(`${libraryId}${apiKey}${expiresAt}${videoId}`).digest("hex");
}

export function bunnyEmbedToken(tokenKey: string, videoId: string, expiresAt: number): string {
  return createHash("sha256").update(`${tokenKey}${videoId}${expiresAt}`).digest("hex");
}

export function bunnyEmbedUrl(input: {
  libraryId: string;
  videoId: string;
  tokenKey?: string;
  expiresAt?: number;
  startSeconds?: number;
}): string {
  const params = new URLSearchParams({ autoplay: "false", preload: "true", responsive: "true" });
  if (input.tokenKey) {
    const expires = input.expiresAt ?? Math.floor(Date.now() / 1000) + 2 * 3600;
    params.set("token", bunnyEmbedToken(input.tokenKey, input.videoId, expires));
    params.set("expires", String(expires));
  }
  if (input.startSeconds && input.startSeconds > 0) params.set("t", String(Math.floor(input.startSeconds)));
  return `https://player.mediadelivery.net/embed/${encodeURIComponent(input.libraryId)}/${encodeURIComponent(input.videoId)}?${params.toString()}`;
}

export function verifyBunnyWebhookSignature(rawBody: string, signatureHex: string | null, key: string): boolean {
  if (!signatureHex || !/^[0-9a-f]{64}$/i.test(signatureHex)) return false;
  const expected = createHmac("sha256", key).update(rawBody, "utf8").digest();
  const given = Buffer.from(signatureHex.toLowerCase(), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Bunny video status codes → our video_assets.status. */
export function mapBunnyStatus(status: number): "waiting" | "processing" | "ready" | "errored" {
  switch (status) {
    case 0: // Created (nothing uploaded yet)
      return "waiting";
    case 4: // Finished
      return "ready";
    case 5: // Error
    case 6: // UploadFailed
      return "errored";
    default: // 1 Uploaded, 2 Processing, 3 Transcoding, 7/8 JIT
      return "processing";
  }
}
