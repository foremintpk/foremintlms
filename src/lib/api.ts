import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError } from "@/lib/auth/guards";
import { RateLimitError } from "@/lib/security/rate-limit";
import { UserFacingError } from "@/lib/actions";

/** JSON error responses for route handlers, without leaking internals. */
export function apiError(err: unknown) {
  if (err instanceof AuthError) {
    const status = err.code === "unauthenticated" ? 401 : 403;
    return NextResponse.json({ error: err.message }, { status });
  }
  if (err instanceof RateLimitError) return NextResponse.json({ error: err.message }, { status: 429 });
  if (err instanceof z.ZodError) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  if (err instanceof UserFacingError) return NextResponse.json({ error: err.message }, { status: 400 });
  console.error("[api] unexpected error", err);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}

export const noStore = { "Cache-Control": "private, no-store" } as const;
