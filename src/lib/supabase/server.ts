import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { publicEnv } from "@/lib/env";

/**
 * Supabase client bound to the signed-in user's session cookies. Every query
 * runs under the user's identity, so Row Level Security applies.
 * Create one per request — never share it across requests.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const env = publicEnv();
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // The proxy refreshes sessions, so this is safe to ignore.
        }
      },
    },
  });
}
