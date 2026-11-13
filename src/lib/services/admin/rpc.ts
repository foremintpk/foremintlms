import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Typed wrapper for the admin analytics RPCs defined in
 * supabase/migrations/20261114106001_admin_analytics.sql. They run as the
 * signed-in admin (each function checks private.is_admin() itself).
 */
export type AdminRpcName =
  | "admin_overview_metrics"
  | "admin_timeseries"
  | "admin_course_stats"
  | "admin_assignment_performance"
  | "admin_instructor_activity"
  | "admin_search_users";

type LooseRpc = (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

export async function adminRpc<T>(fn: AdminRpcName, args: Record<string, unknown>): Promise<T> {
  const supabase = await createClient();
  const rpc = supabase.rpc.bind(supabase) as unknown as LooseRpc;
  const { data, error } = await rpc(fn, args);
  if (error) throw new Error(`${fn} failed: ${error.message}`);
  return data as T;
}
