import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { publicEnv, serverEnv } from "@/lib/env";

let adminClient: ReturnType<typeof createSupabaseClient<Database>> | null = null;

/**
 * Service-role client. Bypasses Row Level Security — use it only in trusted
 * server code (webhooks, background jobs, and server actions AFTER an explicit
 * permission check). Never import this from a client component.
 */
export function createAdminClient() {
  if (adminClient) return adminClient;
  adminClient = createSupabaseClient<Database>(publicEnv().NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return adminClient;
}
