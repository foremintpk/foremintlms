import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { TOTP } from "otpauth";
import fs from "node:fs";
import path from "node:path";

/**
 * Shared E2E fixtures. Users are created in the real Supabase project with
 * an "e2e+" email prefix and removed again by global-teardown.
 */

export const E2E_STATE_FILE = path.join(process.cwd(), "test-results", "e2e-state.json");

export interface E2EState {
  admin: { email: string; password: string; totpSecret: string; id: string };
  teacher: { email: string; password: string; id: string };
  otherTeacher: { email: string; password: string; id: string };
  student: { email: string; password: string; id: string };
  courseId: string;
  courseSlug: string;
  otherCourseSlug: string;
  lessonId: string;
  categoryId: string;
}

export function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("E2E needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (see .env.example)");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function readState(): E2EState {
  return JSON.parse(fs.readFileSync(E2E_STATE_FILE, "utf8")) as E2EState;
}

export function totpCode(secret: string): string {
  return new TOTP({ secret, digits: 6, period: 30, algorithm: "SHA1" }).generate();
}

export const hasWhopSandbox = Boolean(process.env.WHOP_API_KEY && process.env.WHOP_ENVIRONMENT === "sandbox" && process.env.E2E_WHOP_TEST_CARD);
