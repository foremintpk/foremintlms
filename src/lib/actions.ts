import "server-only";
import { z } from "zod";
import { AuthError } from "@/lib/auth/guards";
import { RateLimitError } from "@/lib/security/rate-limit";

/** Uniform result for server actions consumed by forms. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** An error whose message is safe and useful to show to the user. */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

function isNextControlFlow(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && "digest" in err && typeof (err as { digest: unknown }).digest === "string"
    && /^(NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR)/.test((err as { digest: string }).digest));
}

/**
 * Run an action body and convert known errors into user-facing results.
 * Unknown errors are logged on the server and reported generically, so
 * internal details (SQL, stack traces, provider responses) never reach the
 * browser.
 */
export async function runAction<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (err) {
    if (isNextControlFlow(err)) throw err;
    if (err instanceof z.ZodError) {
      return fail("Check the highlighted fields.", z.flattenError(err).fieldErrors as Record<string, string[]>);
    }
    if (err instanceof AuthError || err instanceof RateLimitError || err instanceof UserFacingError) {
      return fail(err.message);
    }
    console.error("[action] unexpected error", err);
    return fail("Something went wrong. Try again, and contact support if it keeps happening.");
  }
}
