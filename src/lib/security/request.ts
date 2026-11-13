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
