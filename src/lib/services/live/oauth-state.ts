import { randomBytes, timingSafeEqual } from "node:crypto";

/**
 * CSRF protection for provider OAuth. The random `state` is sent to the
 * provider and also stored in an httpOnly, SameSite=Lax cookie; the callback
 * accepts the code only when both match and the attempt is recent.
 * Pure helpers — unit tested.
 */

export const OAUTH_STATE_MAX_AGE_SECONDS = 600;

export function oauthStateCookieName(provider: "zoom" | "google_meet"): string {
  return `fm_oauth_${provider}`;
}

export interface OAuthStateCookie {
  state: string;
  returnTo: string;
  issuedAt: number;
}

export function createOAuthState(returnTo: string, now: Date = new Date()): { state: string; cookieValue: string } {
  const state = randomBytes(24).toString("base64url");
  const payload: OAuthStateCookie = { state, returnTo: safeReturnPath(returnTo), issuedAt: now.getTime() };
  return { state, cookieValue: Buffer.from(JSON.stringify(payload)).toString("base64url") };
}

/** Only same-site relative paths into the dashboards are allowed as return targets. */
export function safeReturnPath(path: string | null | undefined): string {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return "/teach/settings?section=meetings";
  if (!/^\/(teach|admin)(\/|$|\?)/.test(path)) return "/teach/settings?section=meetings";
  return path.slice(0, 300);
}

export function verifyOAuthState(
  cookieValue: string | undefined,
  returnedState: string | null,
  now: Date = new Date(),
): { ok: true; returnTo: string } | { ok: false; reason: "missing" | "mismatch" | "expired" | "malformed" } {
  if (!cookieValue || !returnedState) return { ok: false, reason: "missing" };
  let parsed: OAuthStateCookie;
  try {
    parsed = JSON.parse(Buffer.from(cookieValue, "base64url").toString("utf8")) as OAuthStateCookie;
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (typeof parsed?.state !== "string" || typeof parsed.issuedAt !== "number") return { ok: false, reason: "malformed" };
  const a = Buffer.from(parsed.state);
  const b = Buffer.from(returnedState);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "mismatch" };
  if (now.getTime() - parsed.issuedAt > OAUTH_STATE_MAX_AGE_SECONDS * 1000) return { ok: false, reason: "expired" };
  return { ok: true, returnTo: safeReturnPath(parsed.returnTo) };
}
