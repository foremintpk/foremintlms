import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserFacingError } from "@/lib/actions";
import { appUrl } from "@/lib/env";
import { sha256 } from "@/lib/security/crypto";
import { isWhopReady, getWhopClient } from "@/lib/services/payments/whop";
import { applyPaymentObject } from "@/lib/services/payments/sync";
import { resendAccessInvitation } from "@/lib/services/invoicing/invitations";
import {
  durationDays,
  isOrderPayable,
  learnerEmailSchema,
  orderFingerprintSource,
  type DurationKey,
} from "@/lib/domain/commerce";
import type { CheckoutResult } from "@/lib/domain/commerce-view";
import type { Json } from "@/types/database";
import { saveCart, type CartRow } from "./cart";
import { sendPaymentLinkEmail } from "./emails";
import { fulfillOrder } from "./fulfillment";
import { quoteBasket, type Quote } from "./pricing";
import { getOrderLinkTtlHours } from "./settings";
import { loadOrder, loadOrderItems, logOrderEvent, updateOrder, type OrderRow } from "./store";
import { orderAccessToken, orderStatusPath, tokenHash } from "./tokens";
import { closeOrderCheckout, createOrderCheckout, listOrderPayments } from "./whop-checkout";

/**
 * Guest checkout for course packages. The browser sends only the learner
 * email and the total it was shown; the server rebuilds the basket from the
 * cart's course ids and current prices, re-validates the coupon, and charges
 * exactly that. Orders are snapshots: later price changes never alter them.
 */

const db = () => createAdminClient();

export type CheckoutOutcome =
  | { ok: true; order: OrderRow; result: CheckoutResult; quote: Quote }
  | { ok: false; code: "price_changed" | "blocked" | "invalid_email" | "provider_error"; error: string; quote?: Quote };

/** Minutes a reused pending link must still have left before we hand it out again. */
const REUSE_MARGIN_MS = 15 * 60_000;

function resultFor(order: OrderRow, reused: boolean): CheckoutResult {
  return {
    orderNumber: order.order_number,
    statusUrl: orderStatusPath(order.id),
    paymentUrl: order.whop_checkout_url,
    totalMinor: order.total_minor,
    currency: order.currency,
    expiresAt: order.expires_at,
    free: order.checkout_provider === "none",
    reused,
  };
}

/** Whop only accepts https redirect URLs; local http development gets no return URL. */
function successUrl(orderId: string): string | null {
  const url = appUrl(`/checkout/success?order=${orderAccessToken(orderId)}`);
  return url.startsWith("https://") ? url : null;
}

/**
 * Create (or finish creating) the order's Whop payment link. Idempotent and
 * resumable; on failure the order stays a draft with the reason recorded.
 */
export async function generateOrderLink(order: OrderRow): Promise<{ order: OrderRow; error: string | null }> {
  if (order.whop_checkout_url && order.status !== "draft") return { order, error: null };
  const items = await loadOrderItems(order.id);
  await updateOrder(order.id, { link_attempts: order.link_attempts + 1, link_locked_at: new Date().toISOString() });
  const outcome = await createOrderCheckout(order, items, {
    redirectUrl: successUrl(order.id),
    save: async (patch) => {
      await updateOrder(order.id, patch);
    },
  });
  if (outcome.error || !outcome.paymentUrl) {
    const failed = await updateOrder(order.id, { link_generation_error: (outcome.error ?? "No payment link returned").slice(0, 500), link_locked_at: null });
    await logOrderEvent({ orderId: order.id, type: "link_failed", data: { error: outcome.error, code: outcome.errorCode } });
    return { order: failed, error: outcome.error ?? "Whop returned no payment link." };
  }
  const ready = await updateOrder(order.id, {
    status: "pending_payment",
    link_generation_error: null,
    link_locked_at: null,
    environment: outcome.config.environment,
    whop_account_id: outcome.config.companyId,
  });
  await logOrderEvent({ orderId: order.id, type: "link_created", oldStatus: order.status, newStatus: "pending_payment", dedupeKey: `link-created:${order.id}`, data: { environment: outcome.config.environment } });
  await sendPaymentLinkEmail(ready, items);
  if (ready.link_email_sent_count === 0) await updateOrder(order.id, { link_email_sent_count: 1 });
  return { order: ready, error: null };
}

/** Close an unpaid order's Whop link and mark it expired. */
export async function expireOrder(order: OrderRow, reason = "The payment link expired."): Promise<OrderRow> {
  if (!["draft", "pending_payment", "payment_processing", "failed"].includes(order.status)) return order;
  const { data } = await db()
    .from("public_course_orders")
    .update({ status: "expired", expired_at: new Date().toISOString(), status_reason: reason })
    .eq("id", order.id)
    .in("status", ["draft", "pending_payment", "failed"])
    .select("*")
    .maybeSingle();
  if (!data) return order;
  if (order.whop_checkout_configuration_id || order.whop_plan_id) {
    await closeOrderCheckout(order).catch((err) => console.warn("[orders] could not close expired link", order.order_number, err instanceof Error ? err.message : err));
  }
  await logOrderEvent({ orderId: order.id, type: "expired", oldStatus: order.status, newStatus: "expired", dedupeKey: `expired:${order.id}`, data: { reason } });
  return data as OrderRow;
}

export async function checkoutCart(
  cart: CartRow,
  input: { email: string; expectedTotalMinor?: number | null; source: "website" | "advisor"; advisorSessionId?: string | null },
): Promise<CheckoutOutcome> {
  const parsedEmail = learnerEmailSchema.safeParse(input.email);
  if (!parsedEmail.success) return { ok: false, code: "invalid_email", error: parsedEmail.error.issues[0]?.message ?? "Enter a valid email address." };
  const email = parsedEmail.data;

  const quote = await quoteBasket({ courseIds: cart.course_ids, duration: cart.access_duration, couponCode: cart.coupon_code, email });
  if (quote.blockers.length) return { ok: false, code: "blocked", error: quote.blockers[0], quote };
  if (input.expectedTotalMinor !== undefined && input.expectedTotalMinor !== null && input.expectedTotalMinor !== quote.totalMinor) {
    return { ok: false, code: "price_changed", error: "Prices changed since you opened this page. Check the updated total, then continue.", quote };
  }
  if (!quote.free && !(await isWhopReady())) {
    return { ok: false, code: "provider_error", error: "Online payments aren't available right now. Please try again later or contact us.", quote };
  }
  const duration = quote.duration as DurationKey;
  const fingerprint = sha256(orderFingerprintSource({ courseIds: quote.lines.map((l) => l.courseId), duration, currency: quote.currency, couponCode: quote.coupon?.evaluation.ok ? quote.couponCode : null, totalMinor: quote.totalMinor, email }));

  // Same basket, same email, link still valid: hand back the existing order and link.
  const { data: open } = await db()
    .from("public_course_orders")
    .select("*")
    .eq("cart_id", cart.id)
    .eq("fingerprint", fingerprint)
    .in("status", ["draft", "pending_payment", "payment_processing", "failed"])
    .order("created_at", { ascending: false })
    .limit(1);
  const existing = (open?.[0] as OrderRow | undefined) ?? null;
  if (existing) {
    if (new Date(existing.expires_at).getTime() - Date.now() > REUSE_MARGIN_MS) {
      const { order, error } = existing.whop_checkout_url && existing.status !== "draft" ? { order: existing, error: null } : await generateOrderLink(existing);
      if (error) return { ok: false, code: "provider_error", error: "We couldn't create the secure payment link. Please try again in a minute.", quote };
      await saveCart(cart, { last_order_id: order.id, learner_email: email });
      return { ok: true, order, result: resultFor(order, true), quote };
    }
    await expireOrder(existing, "Replaced by a new payment link.");
  }

  const id = randomUUID();
  const ttlHours = await getOrderLinkTtlHours();
  const { data: numberData, error: numberError } = await db().rpc("next_public_order_number");
  if (numberError || !numberData) throw new Error(`order number failed: ${numberError?.message}`);
  const coupon = quote.coupon?.evaluation.ok && quote.coupon.rule ? quote.coupon.rule : null;
  const { data: inserted, error } = await db()
    .from("public_course_orders")
    .insert({
      id,
      order_number: numberData as string,
      access_token_hash: tokenHash(orderAccessToken(id)),
      cart_id: cart.id,
      fingerprint,
      source: input.source,
      advisor_session_id: input.advisorSessionId ?? null,
      learner_email: email,
      currency: quote.currency,
      duration_days: durationDays(duration),
      subtotal_minor: quote.subtotalMinor,
      discount_minor: quote.discountMinor,
      total_minor: quote.totalMinor,
      coupon_id: coupon?.id ?? null,
      coupon_code_snapshot: coupon?.code.toUpperCase() ?? null,
      coupon_snapshot: coupon
        ? ({ code: coupon.code, discount_type: coupon.discount_type, amount: coupon.amount, currency: coupon.currency, course_ids: coupon.course_ids, plan_ids: coupon.plan_ids } as unknown as Json)
        : null,
      checkout_provider: quote.free ? "none" : "whop",
      status: "draft",
      expires_at: new Date(Date.now() + ttlHours * 3_600_000).toISOString(),
    })
    .select("*")
    .single();
  if (error || !inserted) throw new Error(`order insert failed: ${error?.message}`);
  let order = inserted as OrderRow;

  const { error: itemsError } = await db()
    .from("public_course_order_items")
    .insert(
      quote.lines.map((l, i) => ({
        order_id: order.id,
        course_id: l.courseId,
        pricing_plan_id: l.planId,
        product_id: l.productId,
        course_title_snapshot: l.title,
        course_slug_snapshot: l.slug,
        category_snapshot: l.category,
        course_price_minor: l.priceMinor,
        discount_minor: l.discountMinor,
        currency: quote.currency,
        duration_days: durationDays(duration),
        sort_order: i,
      })),
    );
  if (itemsError) throw new Error(`order items insert failed: ${itemsError.message}`);
  await logOrderEvent({ orderId: order.id, type: "created", newStatus: "draft", data: { source: input.source, courses: quote.lines.length, total: quote.totalMinor, currency: quote.currency, coupon: coupon?.code ?? null } });
  await saveCart(cart, { last_order_id: order.id, learner_email: email });

  if (quote.free) {
    // A 100% discount: nothing to charge, so the order is fulfilled now (access still goes only to the learner email).
    order = await fulfillOrder(order, { paidAt: new Date(), paymentId: null, transactionId: null });
    return { ok: true, order, result: resultFor(order, false), quote };
  }

  const generated = await generateOrderLink(order);
  if (generated.error) {
    return { ok: false, code: "provider_error", error: "We couldn't create the secure payment link. Please try again in a minute.", quote };
  }
  return { ok: true, order: generated.order, result: resultFor(generated.order, false), quote };
}

/**
 * Ask Whop directly whether the order has been paid and apply what it says
 * (same path as the webhook, so idempotent). Backs up delayed webhooks.
 */
export async function refreshOrderFromWhop(order: OrderRow): Promise<OrderRow> {
  if (!order.whop_plan_id || !(await isWhopReady())) return order;
  const payments = await listOrderPayments(order);
  for (const payment of payments) await applyPaymentObject(payment);
  await updateOrder(order.id, { last_synced_at: new Date().toISOString() });
  return (await loadOrder(order.id)) ?? order;
}

// ---------------------------------------------------------------------------
// Administration
// ---------------------------------------------------------------------------

export async function cancelOrder(orderId: string, actorId: string, reason: string): Promise<OrderRow> {
  const order = await loadOrder(orderId);
  if (!order) throw new UserFacingError("Order not found.");
  if (!["draft", "pending_payment", "payment_processing", "failed"].includes(order.status)) throw new UserFacingError("Only unpaid orders can be cancelled.");
  const updated = await updateOrder(order.id, { status: "cancelled", cancelled_at: new Date().toISOString(), status_reason: reason });
  await closeOrderCheckout(order).catch(() => undefined);
  await logOrderEvent({ orderId: order.id, type: "cancelled", oldStatus: order.status, newStatus: "cancelled", actorId, data: { reason } });
  return updated;
}

export async function retryOrderFulfillment(orderId: string, actorId: string): Promise<OrderRow> {
  const order = await loadOrder(orderId);
  if (!order) throw new UserFacingError("Order not found.");
  if (order.status === "draft" || (!order.whop_checkout_url && order.checkout_provider === "whop" && !order.paid_at)) {
    const { order: next, error } = await generateOrderLink(order);
    if (error) throw new UserFacingError(`Whop: ${error}`);
    await logOrderEvent({ orderId, type: "admin_retry_link", actorId });
    return next;
  }
  if (!["paid", "fulfillment_pending", "fulfilled"].includes(order.status) || !order.paid_at) throw new UserFacingError("Only paid orders can be fulfilled. Refresh the payment status first.");
  const next = await fulfillOrder(order, { paidAt: new Date(order.paid_at), paymentId: order.whop_payment_id, transactionId: order.payment_transaction_id });
  await logOrderEvent({ orderId, type: "admin_retry_fulfillment", actorId });
  return next;
}

export async function resendOrderActivation(orderId: string, actorId: string): Promise<void> {
  const order = await loadOrder(orderId);
  if (!order) throw new UserFacingError("Order not found.");
  if (order.fulfillment_status !== "awaiting_activation") throw new UserFacingError("This learner doesn't have a pending activation.");
  const { data: invite } = await db()
    .from("access_invitations")
    .select("id")
    .eq("public_order_id", order.id)
    .in("status", ["pending", "expired"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!invite) throw new UserFacingError("No activation invitation was found for this order.");
  await resendAccessInvitation(invite.id);
  await updateOrder(order.id, { activation_sent_count: order.activation_sent_count + 1 });
  await logOrderEvent({ orderId, type: "activation_resent", actorId });
}

/** Release an order held for review: Whop must still report the payment as paid. */
export async function approveOrderUnderReview(orderId: string, actorId: string, reason: string): Promise<OrderRow> {
  const order = await loadOrder(orderId);
  if (!order) throw new UserFacingError("Order not found.");
  if (order.status !== "under_review" || !order.whop_payment_id) throw new UserFacingError("Only orders held for review with a payment can be approved.");
  const { client } = await getWhopClient();
  const payment = await client.payments.retrieve({ id: order.whop_payment_id });
  if ((payment.status ?? "").toLowerCase() !== "paid") throw new UserFacingError(`Whop reports this payment as ${payment.status}, so it can't be approved.`);
  const { data: tx } = await db().from("payment_transactions").select("id").eq("whop_payment_id", payment.id).maybeSingle();
  await logOrderEvent({ orderId, type: "review_approved", actorId, data: { reason } });
  return fulfillOrder(order, { paidAt: payment.paid_at ? new Date(payment.paid_at) : new Date(), paymentId: payment.id, transactionId: (tx?.id as string | undefined) ?? null, overrideBy: actorId });
}

export { isOrderPayable };
