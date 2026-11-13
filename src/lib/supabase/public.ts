import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { publicEnv } from "@/lib/env";

let publicClient: ReturnType<typeof createSupabaseClient<Database>> | null = null;

/**
 * Anonymous, cookie-less client for public marketing data. Because it never
 * reads request cookies it can run inside `"use cache"` functions, and RLS
 * limits it to content that is published for everyone.
 */
export function createPublicClient() {
  if (publicClient) return publicClient;
  const env = publicEnv();
  publicClient = createSupabaseClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return publicClient;
}
