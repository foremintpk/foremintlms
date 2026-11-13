import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestMeta } from "./request";

export class RateLimitError extends Error {
  constructor(message = "Too many attempts. Wait a moment and try again.") {
    super(message);
    this.name = "RateLimitError";
  }
}

/**
 * Fixed-window rate limit backed by Postgres, so it holds across serverless
 * instances. Returns true when the request is allowed.
 */
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("check_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    // Fail closed: an unavailable limiter must not allow unlimited attempts.
    console.error("[rate-limit] check failed", error.message);
    return false;
  }
  return data === true;
}

/** Throws RateLimitError when the caller exceeds the limit (keyed by IP + scope). */
export async function enforceRateLimit(scope: string, limit: number, windowSeconds: number, extraKey?: string) {
  const { ip } = await getRequestMeta();
  const key = `${scope}:${ip ?? "unknown"}${extraKey ? `:${extraKey.toLowerCase()}` : ""}`;
  if (!(await checkRateLimit(key, limit, windowSeconds))) throw new RateLimitError();
}
