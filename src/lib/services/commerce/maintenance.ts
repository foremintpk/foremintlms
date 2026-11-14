import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSetting } from "@/lib/settings";
import { isWhopReady } from "@/lib/services/payments/whop";
import { expireOrder, refreshOrderFromWhop } from "./orders";
import { fulfillOrder } from "./fulfillment";
import type { OrderRow } from "./store";

/**
 * Daily course-package housekeeping (cron job "commerce"). Every step is
 * idempotent and safe to run twice:
 * 1. Re-read open orders from Whop (catches a missed or delayed webhook).
 * 2. Expire unpaid orders whose link lifetime ended and close their Whop links.
 * 3. Retry fulfilment for paid orders whose access setup failed.
 * 4. Delete advisor conversation logs past their retention period, and old carts.
 */
export async function runCommerceMaintenance(now = new Date()) {
  const admin = createAdminClient();
  const result = { reconciled: 0, expired: 0, retried: 0, retryFailed: 0, logsDeleted: 0, sessionsDeleted: 0, cartsDeleted: 0, errors: [] as string[] };
  const whop = await isWhopReady();

  // 1 + 2. Open orders: check Whop first, then expire what is still unpaid and past its expiry.
  const { data: open } = await admin
    .from("public_course_orders")
    .select("*")
    .in("status", ["draft", "pending_payment", "payment_processing", "failed"])
    .gte("created_at", new Date(now.getTime() - 30 * 86_400_000).toISOString())
    .order("created_at")
    .limit(200);
  for (const row of (open ?? []) as OrderRow[]) {
    let order = row;
    try {
      if (whop && order.whop_plan_id) {
        order = await refreshOrderFromWhop(order);
        result.reconciled++;
      }
      if (["draft", "pending_payment", "failed"].includes(order.status) && new Date(order.expires_at) <= now) {
        await expireOrder(order);
        result.expired++;
      }
    } catch (err) {
      result.errors.push(`${order.order_number}: ${err instanceof Error ? err.message.slice(0, 160) : "error"}`);
    }
  }

  // 3. Paid but not provisioned.
  const { data: stuck } = await admin.from("public_course_orders").select("*").eq("status", "fulfillment_pending").not("paid_at", "is", null).limit(100);
  for (const order of (stuck ?? []) as OrderRow[]) {
    try {
      await fulfillOrder(order, { paidAt: new Date(order.paid_at!), paymentId: order.whop_payment_id, transactionId: order.payment_transaction_id });
      result.retried++;
    } catch (err) {
      result.retryFailed++;
      result.errors.push(`${order.order_number}: ${err instanceof Error ? err.message.slice(0, 160) : "error"}`);
    }
  }

  // 4. Retention.
  const retentionDays = Math.min(Math.max(Number(await getSetting<number>("advisor.log_retention_days", 90)) || 90, 7), 730);
  const cutoff = new Date(now.getTime() - retentionDays * 86_400_000).toISOString();
  const { data: oldMessages } = await admin.from("course_advisor_messages").delete().lt("created_at", cutoff).select("id");
  result.logsDeleted = oldMessages?.length ?? 0;
  const { data: oldSessions } = await admin.from("course_advisor_conversation_sessions").delete().lt("last_activity_at", cutoff).select("id");
  result.sessionsDeleted = oldSessions?.length ?? 0;
  const { data: oldCarts } = await admin.from("public_carts").delete().lt("expires_at", new Date(now.getTime() - 7 * 86_400_000).toISOString()).select("id");
  result.cartsDeleted = oldCarts?.length ?? 0;

  return result;
}
