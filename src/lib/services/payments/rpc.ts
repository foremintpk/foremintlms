import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WebhookEventRow } from "./types";

/**
 * Typed calls to the payments RPCs defined in
 * supabase/migrations/20261114105000_payments_functions.sql. Declared here so
 * the signatures stay explicit even before generated types include them.
 */
interface PaymentsRpc {
  next_billing_document_number: { args: Record<string, never>; result: number };
  increment_plan_units_sold: { args: { p_plan: string }; result: number | null };
  increment_coupon_redemptions: { args: { p_whop_promo_code_id: string }; result: number | null };
  claim_failed_webhook_events: { args: { p_provider: string; p_limit: number }; result: WebhookEventRow[] };
  release_stale_webhook_events: { args: { p_provider: string; p_older_than_minutes: number }; result: number };
}

type RpcCaller = <K extends keyof PaymentsRpc>(
  fn: K,
  args?: PaymentsRpc[K]["args"],
) => PromiseLike<{ data: PaymentsRpc[K]["result"] | null; error: { message: string } | null }>;

export function paymentsRpc<K extends keyof PaymentsRpc>(fn: K, args?: PaymentsRpc[K]["args"]) {
  const admin = createAdminClient();
  const call = admin.rpc.bind(admin) as unknown as RpcCaller;
  return call(fn, args);
}
