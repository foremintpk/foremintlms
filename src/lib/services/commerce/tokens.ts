import "server-only";
import { createHmac } from "node:crypto";
import { serverEnv } from "@/lib/env";
import { sha256 } from "@/lib/security/crypto";

/**
 * Order access tokens. The token in /checkout/order/<token> is an HMAC of
 * the order id (so it can be re-derived for emails and the admin), and only
 * its SHA-256 is stored for lookup. 43 base64url characters = 256 bits, so
 * order pages can't be enumerated from the public order number.
 */
function key(): Buffer {
  return Buffer.from(serverEnv().ENCRYPTION_KEY, "base64");
}

export function orderAccessToken(orderId: string): string {
  return createHmac("sha256", key()).update(`public-course-order:v1:${orderId}`).digest("base64url");
}

export function tokenHash(token: string): string {
  return sha256(token);
}

export function isPlausibleToken(token: string | null | undefined): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{40,64}$/.test(token);
}

export function orderStatusPath(orderId: string): string {
  return `/checkout/order/${orderAccessToken(orderId)}`;
}
