import "server-only";
import type { Whop } from "@whop/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/services/notifications";
import { normalizeMembershipStatus } from "@/lib/domain/subscriptions";
import { appUrl } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { UserFacingError } from "@/lib/actions";
import type { Json } from "@/types/database";
import { getWhopClient, isWhopNotFound, isWhopReady } from "./whop";
import { mapPaymentStatus } from "./mapping";
import { applyMembershipObject, applyPaymentObject } from "./sync";
import { processStoredWhopEvent } from "./webhooks";
import { paymentsRpc } from "./rpc";
import type { PaymentTransactionRow, ReconciliationMismatch, SubscriptionRecordRow, WebhookEventRow } from "./types";

/**
 * Reconciliation compares our records with Whop's current state and repairs
 * drift (missed or out-of-order webhooks, manual changes in the Whop
 * dashboard). A past successful payment is never treated as proof that a
 * subscription is still active — the membership's live status decides.
 */

const MEMBERSHIP_BATCH = 300;
const PAYMENT_LOOKBACK_DAYS = 3;
const MAX_REMOTE_PAYMENTS = 500;

export interface ReconcileSummary {
  checked: number;
  updated: number;
  mismatches: number;
}

export async function reconcileWhopPayments(opts: { trigger: "scheduled" | "manual"; actorId?: string }): Promise<ReconcileSummary> {
  const admin = createAdminClient();

  if (!(await isWhopReady())) {
    await admin.from("payment_reconciliation_logs").insert({
      trigger: opts.trigger,
      status: "skipped",
      finished_at: new Date().toISOString(),
      error: "Whop is not connected.",
      triggered_by: opts.actorId ?? null,
    });
    return { checked: 0, updated: 0, mismatches: 0 };
  }

  const { data: log } = await admin
    .from("payment_reconciliation_logs")
    .insert({ trigger: opts.trigger, status: "running", triggered_by: opts.actorId ?? null })
    .select("id")
    .single();
  const logId = log?.id as string | undefined;

  const mismatches: ReconciliationMismatch[] = [];
  let checked = 0;
  let updated = 0;

  try {
    const { client, config } = await getWhopClient();

    // 1. Subscriptions: every non-final record, plus anything touched recently.
    const recent = new Date(Date.now() - 45 * 86_400_000).toISOString();
    const { data: subs } = await admin
      .from("subscription_records")
      .select("*")
      .or(`status.in.(trialing,active,past_due,canceling,unresolved,drafted),updated_at.gte.${recent}`)
      .order("last_synced_at", { ascending: true, nullsFirst: true })
      .limit(MEMBERSHIP_BATCH);

    for (const sub of (subs ?? []) as SubscriptionRecordRow[]) {
      checked++;
      let remote: Whop.Membership;
      try {
        remote = await client.memberships.retrieve({ id: sub.whop_membership_id });
      } catch (err) {
        if (isWhopNotFound(err)) {
          mismatches.push({ kind: "membership", whopId: sub.whop_membership_id, field: "exists", local: sub.status, remote: null, action: "flagged" });
          continue;
        }
        throw err;
      }
      const remoteStatus = normalizeMembershipStatus(remote.status);
      const remoteEnd = remote.current_period_end ?? remote.expires_at;
      const drift: ReconciliationMismatch[] = [];
      if (remoteStatus !== sub.status) drift.push({ kind: "membership", whopId: sub.whop_membership_id, field: "status", local: sub.status, remote: remoteStatus, action: "updated" });
      if (Boolean(remote.cancel_at_period_end) !== sub.cancel_at_period_end) {
        drift.push({ kind: "membership", whopId: sub.whop_membership_id, field: "cancel_at_period_end", local: String(sub.cancel_at_period_end), remote: String(remote.cancel_at_period_end), action: "updated" });
      }
      if ((remoteEnd ?? null) && (!sub.current_period_end || new Date(remoteEnd!).getTime() !== new Date(sub.current_period_end).getTime())) {
        drift.push({ kind: "membership", whopId: sub.whop_membership_id, field: "current_period_end", local: sub.current_period_end, remote: remoteEnd, action: "updated" });
      }
      // Always re-apply: refreshes entitlements even when only time has passed.
      await applyMembershipObject(remote);
      if (drift.length) {
        mismatches.push(...drift);
        updated++;
      }
      await remindIfEnding(sub, remote);
    }

    // 2. Recent payments on Whop that we have not recorded (or recorded differently).
    const since = new Date(Date.now() - PAYMENT_LOOKBACK_DAYS * 86_400_000).toISOString();
    const page = await client.payments.list({ account_id: config.companyId, created_after: since, first: 100 });
    let seen = 0;
    for await (const payment of page) {
      if (++seen > MAX_REMOTE_PAYMENTS) break;
      checked++;
      const { data: local } = await admin
        .from("payment_transactions")
        .select("id, status, refunded_cents")
        .eq("whop_payment_id", payment.id)
        .maybeSingle();
      const remoteStatus = mapPaymentStatus(payment);
      if (!local) {
        mismatches.push({ kind: "payment", whopId: payment.id, field: "exists", local: null, remote: remoteStatus, action: "imported" });
        await applyPaymentObject(payment);
        updated++;
      } else if (local.status !== remoteStatus) {
        mismatches.push({ kind: "payment", whopId: payment.id, field: "status", local: local.status as string, remote: remoteStatus, action: "updated" });
        await applyPaymentObject(payment);
        updated++;
      }
    }

    // 3. Local payments still pending after an hour.
    const stale = new Date(Date.now() - 3_600_000).toISOString();
    const { data: pending } = await admin
      .from("payment_transactions")
      .select("whop_payment_id, status")
      .eq("status", "pending")
      .lt("updated_at", stale)
      .limit(100);
    for (const tx of (pending ?? []) as Pick<PaymentTransactionRow, "whop_payment_id" | "status">[]) {
      checked++;
      try {
        const remote = await client.payments.retrieve({ id: tx.whop_payment_id });
        const remoteStatus = mapPaymentStatus(remote);
        if (remoteStatus !== tx.status) {
          mismatches.push({ kind: "payment", whopId: tx.whop_payment_id, field: "status", local: tx.status, remote: remoteStatus, action: "updated" });
          updated++;
        }
        await applyPaymentObject(remote);
      } catch (err) {
        if (!isWhopNotFound(err)) throw err;
      }
    }

    if (logId) {
      await admin
        .from("payment_reconciliation_logs")
        .update({
          status: "completed",
          finished_at: new Date().toISOString(),
          checked_count: checked,
          updated_count: updated,
          mismatches: mismatches.slice(0, 500) as unknown as Json,
        })
        .eq("id", logId);
    }
    return { checked, updated, mismatches: mismatches.length };
  } catch (err) {
    console.error("[reconcile] failed", err);
    if (logId) {
      await admin
        .from("payment_reconciliation_logs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          checked_count: checked,
          updated_count: updated,
          mismatches: mismatches.slice(0, 500) as unknown as Json,
          error: err instanceof Error ? err.message.slice(0, 500) : "Unknown error",
        })
        .eq("id", logId);
    }
    throw err;
  }
}

/** Remind a subscriber a week before a cancelled subscription ends. */
async function remindIfEnding(sub: SubscriptionRecordRow, remote: Whop.Membership) {
  const end = remote.current_period_end ?? remote.expires_at;
  if (!sub.user_id || !end || !remote.cancel_at_period_end) return;
  const msLeft = new Date(end).getTime() - Date.now();
  if (msLeft <= 0 || msLeft > 7 * 86_400_000) return;
  const admin = createAdminClient();
  const { data: product } = sub.product_id ? await admin.from("products").select("name").eq("id", sub.product_id).maybeSingle() : { data: null };
  const name = (product?.name as string | undefined) ?? "your subscription";
  await notify(sub.user_id, {
    category: "billing",
    type: "subscription_expiring",
    title: `${name} ends ${formatDate(end)}`,
    url: "/learn/billing",
    email: {
      templateKey: "billing.subscription_expiring",
      idempotencyKey: `subscription-expiring:${sub.whop_membership_id}:${end}`,
      payload: { product_name: name, ends_at: formatDate(end), cta_url: remote.manage_url ?? appUrl("/learn/billing") },
    },
  });
}

/** Cron: re-run failed webhook events whose backoff has elapsed. */
export async function retryFailedWebhookEvents(): Promise<number> {
  await paymentsRpc("release_stale_webhook_events", { p_provider: "whop", p_older_than_minutes: 15 });
  const { data, error } = await paymentsRpc("claim_failed_webhook_events", { p_provider: "whop", p_limit: 25 });
  if (error) throw new Error(`claim webhook events failed: ${error.message}`);
  let processed = 0;
  for (const row of data ?? []) {
    const outcome = await processStoredWhopEvent(row);
    if (outcome !== "failed") processed++;
  }
  return processed;
}

/** Admin: retry one event now (ignores the backoff). */
export async function retryWebhookEvent(eventId: string): Promise<"processed" | "ignored" | "failed"> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("webhook_events")
    .update({ status: "processing" })
    .eq("id", eventId)
    .eq("provider", "whop")
    .in("status", ["failed", "received"])
    .select("*")
    .maybeSingle();
  if (!data) throw new UserFacingError("This event isn't waiting for a retry.");
  const row = data as WebhookEventRow;
  await admin.from("webhook_events").update({ attempts: row.attempts + 1 }).eq("id", row.id);
  return processStoredWhopEvent({ ...row, attempts: row.attempts + 1 });
}
