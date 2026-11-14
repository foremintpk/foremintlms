import "server-only";
import { headers } from "next/headers";

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

/** Client IP and user agent for rate limiting and audit logs. */
export async function getRequestMeta(): Promise<RequestMeta> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  return {
    ip: ip && /^[0-9a-fA-F:.]+$/.test(ip) ? ip : null,
    userAgent: h.get("user-agent")?.slice(0, 400) ?? null,
  };
}

/**
 * Reject cross-site state-changing requests to public JSON endpoints. Browsers
 * always send Origin on POST; a mismatch with the request host means another
 * site is posting on the visitor's behalf.
 */
export function isSameOriginRequest(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // same-origin fetches from older browsers, server-to-server tests
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
