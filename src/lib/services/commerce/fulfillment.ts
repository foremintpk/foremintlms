import "server-only";
import type { Whop } from "@whop/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { grantAccess, revokeAccess } from "@/lib/services/entitlements";
import { notify } from "@/lib/services/notifications";
import { enqueueEmail } from "@/lib/services/email/outbox";
import { listAdminUserIds } from "@/lib/services/account";
import { getWhopClient } from "@/lib/services/payments/whop";
import { mapBillingReason, mapPaymentStatus, moneyToCents } from "@/lib/services/payments/mapping";
import type { TransactionStatus } from "@/lib/services/payments/types";
import { createAccessInvitation } from "@/lib/services/invoicing/invitations";
import { isSupportedCurrency, majorStringToMinor, formatMinor } from "@/lib/domain/invoicing";
import { courseTitlesText, isOrderSettled, orderAccessSummary, orderAccessWindow, verifyOrderPayment, type OrderPaymentFacts } from "@/lib/domain/commerce";
import { appUrl } from "@/lib/env";
import { firstName } from "@/lib/format";
import type { Json } from "@/types/database";
import { sendCoursesAddedEmail, sendPaymentConfirmedEmail } from "./emails";
import { loadOrder, loadOrderItems, logOrderEvent, updateOrder, type OrderRow } from "./store";
import { closeOrderCheckout } from "./whop-checkout";

/**
 * Verified Whop state → course-package order outcome.
 *
 * Called from the existing Whop webhook / reconciliation pipeline
 * (src/lib/services/payments/sync.ts), which has already verified the
 * webhook signature and re-fetched the payment from the Whop API. Nothing
 * here trusts a redirect, a query string or a raw webhook payload. Each step
 * is idempotent: the order is claimed with a conditional status update,
 * entitlements are unique per order and course, and every email/event has a
 * dedupe key — a retried or out-of-order webhook can't double-provision.
 */

const db = () => createAdminClient();

export interface OrderPaymentResult {
  transactionId: string;
  status: TransactionStatus;
  previousStatus: TransactionStatus | null;
  userMatched: boolean;
  planMatched: boolean;
}

function metadataOrderId(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const v = (meta as Record<string, unknown>).foremint_public_order_id;
  return typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null;
}

/**
 * Is this (re-fetched) payment for a course-package order? Matched by the
 * order's own checkout configuration or hidden variant. Metadata alone is
 * never trusted: it must point at an order whose Whop variant/checkout is the
 * one the payment was made through.
 */
export async function findOrderForPayment(
  p: Pick<Whop.Payment, "id" | "metadata"> & Partial<Pick<Whop.Payment, "checkout_configuration_id" | "variant_id">>,
): Promise<OrderRow | null> {
  const admin = db();
  if (p.checkout_configuration_id) {
    const { data } = await admin.from("public_course_orders").select("*").eq("whop_checkout_configuration_id", p.checkout_configuration_id).maybeSingle();
    if (data) return data as OrderRow;
  }
  if (p.variant_id) {
    const { data } = await admin.from("public_course_orders").select("*").eq("whop_plan_id", p.variant_id).maybeSingle();
    if (data) return data as OrderRow;
  }
  const byPayment = await admin.from("public_course_orders").select("*").eq("whop_payment_id", p.id).maybeSingle();
  if (byPayment.data) return byPayment.data as OrderRow;
  const id = metadataOrderId(p.metadata);
  if (id) {
    const order = await loadOrder(id);
    if (order && ((p.variant_id && order.whop_plan_id === p.variant_id) || (p.checkout_configuration_id && order.whop_checkout_configuration_id === p.checkout_configuration_id))) {
      return order;
    }
    if (order) console.warn("[orders] payment metadata names an order it was not paid through", p.id, id);
  }
  return null;
}

function minorFrom(money: { amount: string | number } | null | undefined, currency: string): number | null {
  if (!money) return null;
  if (isSupportedCurrency(currency)) return majorStringToMinor(String(money.amount), currency);
  return moneyToCents(money as Parameters<typeof moneyToCents>[0]);
}

function paymentFacts(p: Whop.Payment): OrderPaymentFacts {
  const currency = (p.currency ?? "usd").toLowerCase();
  return {
    accountId: p.account_id ?? null,
    currency,
    subtotalMinor: minorFrom(p.subtotal, currency),
    totalMinor: minorFrom(p.total, currency),
    taxMinor: minorFrom(p.tax_amount, currency),
    promoCodeId: p.promo_code_id ?? null,
  };
}

function payerOf(p: Whop.Payment): { email: string | null; name: string | null } {
  const user = (p.user ?? null) as { email?: string | null; name?: string | null; username?: string | null } | null;
  return { email: (user?.email ?? p.customer_email ?? null)?.toLowerCase() ?? null, name: user?.name ?? user?.username ?? null };
}

async function alertAdmins(title: string, body: string, orderId: string, type: string) {
  const admins = await listAdminUserIds();
  if (admins.length) await notify(admins, { category: "system", type, title, body, url: `/admin/orders/${orderId}` });
}

async function upsertOrderTransaction(p: Whop.Payment, order: OrderRow, status: TransactionStatus) {
  const admin = db();
  const { data: existing } = await admin.from("payment_transactions").select("id, status, refunded_cents, raw").eq("whop_payment_id", p.id).maybeSingle();
  const facts = paymentFacts(p);
  const card = p.payment_instrument?.card ?? null;
  const effects = ((existing?.raw as { effects?: Record<string, boolean> } | undefined)?.effects) ?? {};
  const row = {
    whop_payment_id: p.id,
    user_id: order.learner_user_id,
    public_order_id: order.id,
    whop_membership_id: p.membership_id,
    status,
    billing_reason: mapBillingReason(p.billing_reason),
    currency: facts.currency,
    subtotal_cents: facts.subtotalMinor,
    discount_cents: order.discount_minor,
    tax_cents: facts.taxMinor,
    total_cents: facts.totalMinor ?? 0,
    refunded_cents: minorFrom(p.refunded_amount, facts.currency) ?? 0,
    promo_code: p.promo_code_id,
    card_brand: card?.brand ?? null,
    card_last4: card?.last4 ?? null,
    failure_reason: p.failure_message,
    paid_at: p.paid_at,
    refunded_at: p.refunded_at,
    last_synced_at: new Date().toISOString(),
    raw: { whop: p, effects, matched_by: "public_order" } as unknown as Json,
  };
  const { data, error } = await admin.from("payment_transactions").upsert(row, { onConflict: "whop_payment_id" }).select("id").single();
  if (error || !data) throw new Error(`payment upsert failed: ${error?.message}`);
  return {
    id: data.id as string,
    previousStatus: (existing?.status as TransactionStatus | undefined) ?? null,
    previousRefunded: (existing?.refunded_cents as number | undefined) ?? 0,
    refundedMinor: row.refunded_cents,
  };
}

async function markUnderReview(order: OrderRow, reason: string, paymentId: string, transactionId: string) {
  if (order.status === "under_review") return;
  await updateOrder(order.id, { status: "under_review", payment_status: "succeeded", status_reason: reason.slice(0, 500), whop_payment_id: paymentId, payment_transaction_id: transactionId });
  const fresh = await logOrderEvent({ orderId: order.id, type: "under_review", oldStatus: order.status, newStatus: "under_review", dedupeKey: `under-review:${order.id}:${paymentId}`, data: { reason } });
  if (fresh) await alertAdmins(`Order ${order.order_number} needs review`, reason, order.id, "order_under_review");
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export async function applyOrderPayment(p: Whop.Payment, order: OrderRow): Promise<OrderPaymentResult> {
  const status = mapPaymentStatus(p);
  const tx = await upsertOrderTransaction(p, order, status);
  const result: OrderPaymentResult = { transactionId: tx.id, status, previousStatus: tx.previousStatus, userMatched: true, planMatched: true };

  // Record who paid (a parent, employer or institute may pay for the learner). Never the learner identity.
  const payer = payerOf(p);
  if (payer.email && !order.payer_email) {
    order = await updateOrder(order.id, { payer_email: payer.email, payer_name: payer.name?.slice(0, 160) ?? null });
  }

  switch (status) {
    case "succeeded": {
      const { config } = await getWhopClient();
      const check = verifyOrderPayment(order, paymentFacts(p), order.whop_account_id || config.companyId);
      if (!check.ok && !isOrderSettled(order.status)) {
        await markUnderReview(order, check.reason, p.id, tx.id);
        return result;
      }
      if (order.status === "under_review") return result; // an administrator decides
      await fulfillOrder(order, { paidAt: p.paid_at ? new Date(p.paid_at) : new Date(), paymentId: p.id, transactionId: tx.id, facts: paymentFacts(p) });
      if (tx.previousStatus === "disputed") await restoreAfterDispute(order.id);
      break;
    }
    case "pending": {
      if (["pending_payment", "failed", "draft"].includes(order.status)) {
        await updateOrder(order.id, { status: "payment_processing", payment_status: "pending", status_reason: null });
      }
      await logOrderEvent({ orderId: order.id, type: "payment_pending", dedupeKey: `pending:${p.id}:${p.substatus ?? ""}`, data: { substatus: p.substatus } });
      break;
    }
    case "failed": {
      if (["pending_payment", "payment_processing", "draft"].includes(order.status)) {
        await updateOrder(order.id, { status: "failed", payment_status: "failed", status_reason: (p.failure_message ?? "The payment attempt failed.").slice(0, 500) });
      }
      await logOrderEvent({ orderId: order.id, type: "payment_failed", oldStatus: order.status, newStatus: "failed", dedupeKey: `failed:${p.id}:${p.payments_failed ?? 0}`, data: { failure: p.failure_message } });
      break;
    }
    case "voided": {
      if (order.status === "payment_processing") await updateOrder(order.id, { status: "pending_payment", payment_status: "unpaid" });
      await logOrderEvent({ orderId: order.id, type: "payment_voided", dedupeKey: `voided:${p.id}` });
      break;
    }
    case "refunded":
    case "partially_refunded":
      await applyOrderRefund(order, p, status === "refunded", tx);
      break;
    case "disputed":
      await applyOrderDispute(order, p);
      break;
  }
  return result;
}

/**
 * Mark the order paid and provision access. Safe to call repeatedly: the
 * first call claims the order; later calls only finish any step a crash may
 * have interrupted. Free orders (100% coupons) come here without a payment.
 */
export async function fulfillOrder(
  order: OrderRow,
  opts: { paidAt: Date; paymentId: string | null; transactionId: string | null; facts?: OrderPaymentFacts; overrideBy?: string | null },
): Promise<OrderRow> {
  const admin = db();
  const claimable = opts.overrideBy ? ["draft", "pending_payment", "payment_processing", "failed", "under_review"] : ["draft", "pending_payment", "payment_processing", "failed"];
  const free = order.checkout_provider === "none";
  const paidTotal = opts.facts?.totalMinor ?? (free ? 0 : order.total_minor);
  const { data: claimed } = await admin
    .from("public_course_orders")
    .update({
      status: "paid",
      payment_status: free ? "not_required" : "succeeded",
      status_reason: opts.overrideBy ? "Approved by an administrator after review" : null,
      paid_at: opts.paidAt.toISOString(),
      paid_amount_minor: paidTotal,
      paid_tax_minor: opts.facts?.taxMinor ?? null,
      whop_payment_id: opts.paymentId,
      payment_transaction_id: opts.transactionId,
      last_synced_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    .in("status", claimable)
    .select("*")
    .maybeSingle();

  let current = (claimed as OrderRow | null) ?? null;
  if (current) {
    await logOrderEvent({
      orderId: order.id,
      type: "paid",
      oldStatus: order.status,
      newStatus: "paid",
      actorId: opts.overrideBy ?? null,
      dedupeKey: `paid:${order.id}`,
      data: { whop_payment_id: opts.paymentId, total: paidTotal, tax: opts.facts?.taxMinor ?? null, currency: order.currency, free },
    });
  } else {
    current = await loadOrder(order.id);
    if (!current || !["paid", "fulfillment_pending", "fulfilled"].includes(current.status)) return current ?? order;
  }

  // A paid link stops working (its variant also had stock 1).
  if (!free && (await logOrderEvent({ orderId: current.id, type: "checkout_closed", dedupeKey: `checkout-closed:${current.id}` }))) {
    await closeOrderCheckout(current).catch((err) => console.warn("[orders] could not close paid checkout", current!.order_number, err instanceof Error ? err.message : err));
  }
  // Coupon redemptions are counted once per paid order.
  if (current.coupon_id && (await logOrderEvent({ orderId: current.id, type: "coupon_redeemed", dedupeKey: `coupon-redeemed:${current.id}`, data: { coupon: current.coupon_code_snapshot } }))) {
    await admin.rpc("increment_coupon_redemption", { p_coupon: current.coupon_id });
  }

  try {
    let userId = current.learner_user_id;
    if (!userId) {
      const { data: profile } = await admin.from("profile_private").select("user_id").eq("email", current.learner_email).maybeSingle();
      userId = (profile?.user_id as string | undefined) ?? null;
    }
    if (userId) {
      return await provisionOrderAccess(current, userId, { viaActivation: false });
    }
    // No account yet: a single-use activation link (the learner sets their own password).
    if (await logOrderEvent({ orderId: current.id, type: "activation_invited", dedupeKey: `activation:${current.id}`, data: { email: current.learner_email } })) {
      await createAccessInvitation({ kind: "order_activation", publicOrderId: current.id, email: current.learner_email, invitedByRole: "system" });
      current = await updateOrder(current.id, { fulfillment_status: "awaiting_activation", activation_sent_count: current.activation_sent_count + 1 });
    } else if (current.fulfillment_status !== "awaiting_activation") {
      current = await updateOrder(current.id, { fulfillment_status: "awaiting_activation" });
    }
    await sendPaymentConfirmedEmail(current, await loadOrderItems(current.id), { hasAccount: false });
    return current;
  } catch (err) {
    console.error("[orders] fulfilment failed", current.order_number, err);
    await updateOrder(current.id, { status: "fulfillment_pending", fulfillment_status: "failed", status_reason: "Access could not be set up yet; it will be retried." }).catch(() => undefined);
    throw err;
  }
}

/**
 * Create the learner's course entitlements for a paid order: one row per
 * course, each expiring `duration_days` after the verified payment time.
 * Existing, independent purchases are never touched.
 */
export async function provisionOrderAccess(order: OrderRow, userId: string, opts: { viaActivation: boolean }): Promise<OrderRow> {
  const admin = db();
  const items = await loadOrderItems(order.id);
  const paidAt = order.paid_at ? new Date(order.paid_at) : new Date();
  const window = orderAccessWindow(order.duration_days, paidAt);
  for (const item of items) {
    if (!item.course_id) continue;
    await grantAccess({
      userId,
      courseIds: [item.course_id],
      source: "purchase",
      startsAt: window.startsAt,
      expiresAt: window.expiresAt,
      productId: item.product_id,
      planId: item.pricing_plan_id,
      paymentTransactionId: order.payment_transaction_id,
      publicOrderId: order.id,
      reason: `Course package ${order.order_number}`,
      notifyUser: false,
    });
  }
  const updated = await updateOrder(order.id, {
    learner_user_id: userId,
    status: "fulfilled",
    fulfillment_status: "fulfilled",
    fulfilled_at: order.fulfilled_at ?? new Date().toISOString(),
    status_reason: null,
  });
  if (order.payment_transaction_id) {
    await admin.from("payment_transactions").update({ user_id: userId }).eq("id", order.payment_transaction_id).is("user_id", null);
  }
  // Pending activation links for this order are no longer needed.
  await admin
    .from("access_invitations")
    .update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_by: userId })
    .eq("public_order_id", order.id)
    .eq("status", "pending");

  if (await logOrderEvent({ orderId: order.id, type: "access_granted", dedupeKey: `access-granted:${order.id}:${userId}`, data: { user_id: userId, courses: items.length, expires_at: window.expiresAt?.toISOString() ?? null } })) {
    const { data: profile } = await admin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
    const titles = items.map((i) => i.course_title_snapshot);
    await notify(userId, {
      category: "learning",
      type: "enrollment",
      title: items.length === 1 ? `${titles[0]} is ready` : `${items.length} new courses are ready`,
      body: orderAccessSummary(order.duration_days, paidAt),
      url: "/learn/courses",
    });
    await sendPaymentConfirmedEmail(updated, items, { hasAccount: true });
    if (!opts.viaActivation) {
      await sendCoursesAddedEmail(updated, items, { firstName: firstName(profile?.full_name ?? null), userId });
    }
    console.info("[orders] access granted", order.order_number, courseTitlesText(titles, 3));
  }
  return updated;
}

/**
 * A learner proved control of their email (activation link, or signing in
 * with that address): attach every paid order waiting for that email.
 */
export async function attachPaidOrdersToUser(user: { id: string; email: string }, opts: { viaActivation: boolean }): Promise<number> {
  const { data } = await db()
    .from("public_course_orders")
    .select("*")
    .eq("learner_email", user.email.toLowerCase())
    .in("status", ["paid", "fulfillment_pending"])
    .or(`learner_user_id.is.null,learner_user_id.eq.${user.id}`);
  let attached = 0;
  for (const order of (data ?? []) as OrderRow[]) {
    await provisionOrderAccess(order, user.id, opts);
    attached++;
  }
  return attached;
}

// ---------------------------------------------------------------------------
// Refunds and disputes
// ---------------------------------------------------------------------------

async function setOrderEntitlements(orderId: string, from: string[], to: "active" | "suspended") {
  await db().from("course_entitlements").update({ status: to }).eq("public_order_id", orderId).in("status", from);
}

async function applyOrderRefund(order: OrderRow, p: Whop.Payment, full: boolean, tx: { id: string; previousRefunded: number; refundedMinor: number }) {
  if (tx.refundedMinor <= tx.previousRefunded && ["refunded", "partially_refunded"].includes(order.status)) return;
  const admin = db();
  await updateOrder(order.id, {
    status: full ? "refunded" : "partially_refunded",
    payment_status: full ? "refunded" : "partially_refunded",
    refunded_amount_minor: tx.refundedMinor,
    ...(full ? { fulfillment_status: "revoked" as const } : {}),
    status_reason: full ? "Payment refunded" : "Payment partially refunded",
  });
  await logOrderEvent({ orderId: order.id, type: full ? "refunded" : "partially_refunded", oldStatus: order.status, dedupeKey: `refund:${p.id}:${tx.refundedMinor}`, data: { amount: tx.refundedMinor } });
  if (full) {
    // Same policy as single-course purchases: a full refund ends the access it paid for.
    await revokeAccess({ paymentTransactionId: tx.id, reason: "Payment refunded" });
    await db().from("course_entitlements").update({ status: "revoked", revoked_at: new Date().toISOString(), revoke_reason: "Payment refunded" }).eq("public_order_id", order.id).in("status", ["active", "suspended"]);
    await admin.from("access_invitations").update({ status: "revoked", revoked_at: new Date().toISOString() }).eq("public_order_id", order.id).eq("status", "pending");
  }
  await enqueueEmail({
    templateKey: "billing.refund_processed",
    to: order.learner_email,
    userId: order.learner_user_id,
    idempotencyKey: `order-refund:${p.id}:${tx.refundedMinor}`,
    payload: { product_name: `Course package ${order.order_number}`, amount: formatMinor(tx.refundedMinor - tx.previousRefunded, order.currency), cta_url: appUrl("/learn/billing") },
  });
}

async function applyOrderDispute(order: OrderRow, p: Whop.Payment) {
  const lost = (p.substatus ?? "").toLowerCase().endsWith("_lost");
  const fresh = await logOrderEvent({ orderId: order.id, type: lost ? "dispute_lost" : "disputed", dedupeKey: `dispute:${p.id}:${p.substatus ?? ""}`, data: { substatus: p.substatus } });
  await updateOrder(order.id, { status: "under_review", payment_status: "disputed", fulfillment_status: lost ? "revoked" : "suspended", status_reason: lost ? "Chargeback lost" : "Payment disputed" });
  if (lost) {
    await db().from("course_entitlements").update({ status: "revoked", revoked_at: new Date().toISOString(), revoke_reason: "Dispute lost" }).eq("public_order_id", order.id).in("status", ["active", "suspended"]);
  } else {
    await setOrderEntitlements(order.id, ["active"], "suspended");
  }
  if (fresh) await alertAdmins(`Payment dispute on ${order.order_number}`, lost ? "The chargeback was lost; access was revoked." : "Access is paused while the dispute is open.", order.id, "order_disputed");
}

async function restoreAfterDispute(orderId: string) {
  const order = await loadOrder(orderId);
  if (!order || order.status_reason !== "Payment disputed") return;
  await setOrderEntitlements(orderId, ["suspended"], "active");
  await updateOrder(orderId, { status: order.learner_user_id ? "fulfilled" : "paid", payment_status: "succeeded", fulfillment_status: order.learner_user_id ? "fulfilled" : "awaiting_activation", status_reason: "Dispute resolved in our favour" });
  await logOrderEvent({ orderId, type: "dispute_won", dedupeKey: `dispute-won:${orderId}` });
}
