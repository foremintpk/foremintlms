import "server-only";
import type { Whop } from "@whop/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { grantAccess, revokeAccess, setSubscriptionAccess, type EntitlementSource } from "@/lib/services/entitlements";
import { notify } from "@/lib/services/notifications";
import { computeAccessWindow } from "@/lib/domain/access";
import { entitlementForMembership, normalizeMembershipStatus } from "@/lib/domain/subscriptions";
import { getSetting } from "@/lib/settings";
import { appUrl } from "@/lib/env";
import { formatDate, formatMoney } from "@/lib/format";
import { planPriceLabel } from "@/lib/domain/pricing";
import { syncBillingDocuments } from "@/lib/services/billing/documents";
import type { Json } from "@/types/database";
import { getWhopClient } from "./whop";
import { productCourseIds } from "./catalog";
import {
  derivePaymentAmounts,
  isDisputeResolvedInOurFavour,
  mapBillingReason,
  mapPaymentStatus,
  parseForemintMetadata,
} from "./mapping";
import type { WhopLineLike } from "@/lib/services/billing/receipt-model";
import { paymentsRpc } from "./rpc";
import { applyOrderPayment, findOrderForPayment } from "@/lib/services/commerce/fulfillment";
import {
  applyCustomInvoiceMembership,
  applyCustomInvoicePayment,
  findInvoiceForMembership,
  findInvoiceForPayment,
} from "@/lib/services/invoicing/fulfillment";
import type {
  CheckoutSessionRow,
  PaymentTransactionRow,
  PlanRow,
  ProductRow,
  SubscriptionRecordRow,
  TransactionStatus,
} from "./types";

/**
 * Turns verified Whop state into our records. Both the webhook handler and
 * the reconciliation job call these functions; they always re-fetch the
 * payment/membership from the Whop API first, so a forged or stale payload
 * can never grant access. Every step is idempotent.
 */

interface Context {
  userId: string | null;
  plan: PlanRow | null;
  product: ProductRow | null;
  session: CheckoutSessionRow | null;
  matchedBy: "metadata" | "checkout" | "existing" | "customer" | "email" | null;
}

interface Effects {
  units_counted?: boolean;
  coupon_counted?: boolean;
  confirmation_sent?: boolean;
}

const db = () => createAdminClient();

async function loadPlan(id: string | null | undefined): Promise<PlanRow | null> {
  if (!id) return null;
  const { data } = await db().from("pricing_plans").select("*").eq("id", id).maybeSingle();
  return (data as PlanRow | null) ?? null;
}

async function loadProduct(id: string | null | undefined): Promise<ProductRow | null> {
  if (!id) return null;
  const { data } = await db().from("products").select("*").eq("id", id).maybeSingle();
  return (data as ProductRow | null) ?? null;
}

/**
 * Work out who paid and for what. Metadata is only trusted when it matches a
 * checkout session we created for the same user and plan.
 */
async function resolveContext(input: {
  metadata: unknown;
  checkoutConfigurationId: string | null;
  variantId: string | null;
  whopUserId: string | null;
  email: string | null;
  existingUserId: string | null;
}): Promise<Context> {
  const admin = db();
  let session: CheckoutSessionRow | null = null;
  let matchedBy: Context["matchedBy"] = null;

  const meta = parseForemintMetadata(input.metadata);
  if (meta) {
    const { data } = await admin.from("checkout_sessions").select("*").eq("id", meta.checkout_session_id).maybeSingle();
    const s = data as CheckoutSessionRow | null;
    if (s && s.user_id === meta.foremint_user_id && s.plan_id === meta.plan_id) {
      session = s;
      matchedBy = "metadata";
    } else if (s) {
      console.warn("[whop] metadata does not match its checkout session", meta.checkout_session_id);
    }
  }
  if (!session && input.checkoutConfigurationId) {
    const { data } = await admin.from("checkout_sessions").select("*").eq("whop_checkout_id", input.checkoutConfigurationId).maybeSingle();
    if (data) {
      session = data as CheckoutSessionRow;
      matchedBy = "checkout";
    }
  }

  let plan = session ? await loadPlan(session.plan_id) : null;
  if (!plan && input.variantId) {
    const { data } = await admin.from("pricing_plans").select("*").eq("whop_plan_id", input.variantId).maybeSingle();
    plan = (data as PlanRow | null) ?? null;
  }
  const product = plan ? await loadProduct(plan.product_id) : session ? await loadProduct(session.product_id) : null;

  let userId = session?.user_id ?? null;
  if (!userId && input.existingUserId) {
    userId = input.existingUserId;
    matchedBy = "existing";
  }
  if (!userId && input.whopUserId) {
    const { data } = await admin.from("whop_customers").select("user_id").eq("whop_user_id", input.whopUserId).maybeSingle();
    if (data) {
      userId = data.user_id as string;
      matchedBy = "customer";
    }
  }
  if (!userId && input.email) {
    const { data } = await admin.from("profile_private").select("user_id").eq("email", input.email.toLowerCase()).limit(2);
    if (data && data.length === 1) {
      userId = data[0].user_id as string;
      matchedBy = "email";
    }
  }
  return { userId, plan, product, session, matchedBy };
}

function entitlementSource(product: ProductRow, recurring: boolean): EntitlementSource {
  if (product.kind === "membership") return "membership";
  if (recurring) return "subscription";
  return product.kind === "bundle" ? "bundle" : "purchase";
}

async function upsertCustomer(userId: string, whopUserId: string | null, whopMemberId: string | null, email: string | null) {
  if (!whopUserId && !whopMemberId) return;
  const admin = db();
  const { data: existing } = await admin.from("whop_customers").select("user_id, whop_user_id").eq("user_id", userId).maybeSingle();
  if (existing && existing.whop_user_id && whopUserId && existing.whop_user_id !== whopUserId) {
    // A learner paying from a second Whop account: keep the first link, log the other.
    console.warn("[whop] learner has more than one Whop account", userId);
    return;
  }
  const { error } = await admin.from("whop_customers").upsert(
    {
      user_id: userId,
      whop_user_id: whopUserId ?? existing?.whop_user_id ?? null,
      whop_member_id: whopMemberId,
      email,
    },
    { onConflict: "user_id" },
  );
  if (error && error.code !== "23505") console.error("[whop] customer upsert failed", error.message);
}

async function setPaymentEntitlementStatus(transactionId: string, from: string[], to: "active" | "suspended") {
  await db()
    .from("course_entitlements")
    .update({ status: to })
    .eq("payment_transaction_id", transactionId)
    .in("status", from);
}

function moneyLabel(cents: number, currency: string) {
  return formatMoney(cents, currency);
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export interface PaymentSyncResult {
  transactionId: string;
  status: TransactionStatus;
  previousStatus: TransactionStatus | null;
  userMatched: boolean;
  planMatched: boolean;
}

export async function syncPaymentFromWhop(whopPaymentId: string): Promise<PaymentSyncResult> {
  const { client } = await getWhopClient();
  const payment = await client.payments.retrieve({ id: whopPaymentId });
  return applyPayment(payment);
}

async function applyPayment(p: Whop.Payment): Promise<PaymentSyncResult> {
  // Course-package orders from the public selector / advisor (guest checkout,
  // one hidden single-use variant per order) have their own fulfilment.
  const publicOrder = await findOrderForPayment(p);
  if (publicOrder) return applyOrderPayment(p, publicOrder);

  // Custom invoices (and renewals of the subscriptions they start) have their
  // own fulfilment: company packages, account activation, invoice statuses.
  const customInvoice = await findInvoiceForPayment(p);
  if (customInvoice) return applyCustomInvoicePayment(p, customInvoice);

  const admin = db();
  const { data: existingRow } = await admin.from("payment_transactions").select("*").eq("whop_payment_id", p.id).maybeSingle();
  const existing = existingRow as PaymentTransactionRow | null;

  const ctx = await resolveContext({
    metadata: p.metadata,
    checkoutConfigurationId: p.checkout_configuration_id,
    variantId: p.variant_id,
    whopUserId: p.user?.id ?? null,
    email: p.customer_email,
    existingUserId: existing?.user_id ?? null,
  });

  const status = mapPaymentStatus(p);
  const amounts = derivePaymentAmounts(p);
  const card = p.payment_instrument?.card ?? null;
  const previousStatus = existing?.status ?? null;
  const effects: Effects = ((existing?.raw as { effects?: Effects } | undefined)?.effects) ?? {};

  if (ctx.userId) await upsertCustomer(ctx.userId, p.user?.id ?? null, p.member_id, p.customer_email);

  let subscriptionRecordId = existing?.subscription_record_id ?? null;
  if (!subscriptionRecordId && p.membership_id) {
    const { data } = await admin.from("subscription_records").select("id").eq("whop_membership_id", p.membership_id).maybeSingle();
    subscriptionRecordId = (data?.id as string | undefined) ?? null;
  }

  const row = {
    whop_payment_id: p.id,
    user_id: ctx.userId,
    plan_id: ctx.plan?.id ?? null,
    product_id: ctx.product?.id ?? null,
    checkout_session_id: ctx.session?.id ?? existing?.checkout_session_id ?? null,
    subscription_record_id: subscriptionRecordId,
    whop_membership_id: p.membership_id,
    status,
    billing_reason: mapBillingReason(p.billing_reason),
    currency: (p.currency ?? "usd").toLowerCase(),
    subtotal_cents: amounts.subtotalCents,
    discount_cents: amounts.discountCents,
    tax_cents: amounts.taxCents,
    total_cents: amounts.totalCents,
    refunded_cents: amounts.refundedCents,
    promo_code: p.promo_code_id,
    card_brand: card?.brand ?? null,
    card_last4: card?.last4 ?? null,
    failure_reason: p.failure_message,
    paid_at: p.paid_at,
    refunded_at: p.refunded_at,
    last_synced_at: new Date().toISOString(),
    raw: { whop: p, effects, matched_by: ctx.matchedBy } as unknown as Json,
  };
  const { data: saved, error } = await admin.from("payment_transactions").upsert(row, { onConflict: "whop_payment_id" }).select("*").single();
  if (error || !saved) throw new Error(`payment upsert failed: ${error?.message}`);
  const tx = saved as PaymentTransactionRow;

  const result: PaymentSyncResult = {
    transactionId: tx.id,
    status,
    previousStatus,
    userMatched: Boolean(ctx.userId),
    planMatched: Boolean(ctx.plan),
  };
  if (!ctx.userId || !ctx.plan || !ctx.product) return result; // recorded for admin review; no access decisions possible

  const recurring = ctx.plan.plan_type === "recurring";
  const productName = ctx.product.name;
  const facts = {
    whopPaymentId: p.id,
    whopMembershipId: p.membership_id,
    paidAt: p.paid_at,
    currency: tx.currency,
    status,
    lineItems: (p.line_items ?? []) as unknown as WhopLineLike[],
    discountCents: amounts.discountCents,
    taxCents: amounts.taxCents,
    taxBehavior: p.tax_behavior,
    totalCents: amounts.totalCents,
    refundedCents: amounts.refundedCents,
    promoCodeId: p.promo_code_id,
    paymentMethod: card?.brand && card.last4 ? `${card.brand} •••• ${card.last4}` : p.payment_instrument?.display_name ?? null,
    billingAddress: p.billing_address as unknown as Record<string, string | null> | null,
    customerEmail: p.customer_email,
  };

  // --- Access --------------------------------------------------------------
  if (status === "succeeded") {
    if (ctx.session && ctx.session.status !== "completed") {
      await admin.from("checkout_sessions").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", ctx.session.id);
    }
    if (recurring) {
      if (p.membership_id) {
        const sub = await syncMembershipFromWhop(p.membership_id, { knownUserId: ctx.userId });
        if (sub && !tx.subscription_record_id) {
          await admin.from("payment_transactions").update({ subscription_record_id: sub.id }).eq("id", tx.id);
        }
      }
    } else {
      const { allAccess, courseIds } = await productCourseIds(ctx.product);
      const window = computeAccessWindow(ctx.plan, p.paid_at ? new Date(p.paid_at) : new Date());
      await grantAccess({
        userId: ctx.userId,
        courseIds,
        allAccess,
        source: entitlementSource(ctx.product, false),
        startsAt: window.startsAt,
        expiresAt: window.expiresAt,
        productId: ctx.product.id,
        planId: ctx.plan.id,
        checkoutSessionId: ctx.session?.id ?? null,
        paymentTransactionId: tx.id,
        whopMembershipId: p.membership_id,
      });
    }
    // A won dispute restores suspended access.
    if (previousStatus === "disputed" && isDisputeResolvedInOurFavour(p.substatus)) {
      await setPaymentEntitlementStatus(tx.id, ["suspended"], "active");
    }
  } else if (status === "refunded") {
    await revokeAccess({ paymentTransactionId: tx.id, reason: "Payment refunded" });
    if (tx.subscription_record_id && (amounts.refundedCents >= amounts.totalCents)) {
      await setSubscriptionAccess(tx.subscription_record_id, { status: "revoked", expiresAt: new Date(), reason: "Payment refunded" });
    }
  } else if (status === "disputed") {
    const lost = (p.substatus ?? "").toLowerCase().endsWith("_lost");
    if (lost) {
      await revokeAccess({ paymentTransactionId: tx.id, reason: "Dispute lost" });
      if (tx.subscription_record_id) {
        await setSubscriptionAccess(tx.subscription_record_id, { status: "revoked", expiresAt: new Date(), reason: "Dispute lost" });
      }
    } else {
      await setPaymentEntitlementStatus(tx.id, ["active"], "suspended");
      if (tx.subscription_record_id) {
        await setSubscriptionAccess(tx.subscription_record_id, { status: "suspended", expiresAt: null, reason: "Payment disputed" });
      }
    }
  }

  // --- Counters (exactly once per payment) ----------------------------------
  const ever = status === "succeeded" || status === "partially_refunded" || status === "refunded" || status === "disputed";
  if (ever && tx.billing_reason !== "renewal") {
    if (!effects.units_counted) {
      await paymentsRpc("increment_plan_units_sold", { p_plan: ctx.plan.id });
      effects.units_counted = true;
    }
    if (!effects.coupon_counted && p.promo_code_id) {
      await paymentsRpc("increment_coupon_redemptions", { p_whop_promo_code_id: p.promo_code_id });
      effects.coupon_counted = true;
    }
    // Persist the flags immediately so a crash later in this run can't double count on retry.
    await admin
      .from("payment_transactions")
      .update({ raw: { whop: p, effects, matched_by: ctx.matchedBy } as unknown as Json })
      .eq("id", tx.id);
  }

  // --- Documents --------------------------------------------------------------
  const receipt = ever ? await syncBillingDocuments({ transaction: tx, facts, product: ctx.product, plan: ctx.plan }) : null;

  // --- Emails (idempotency keys make every one of these send at most once) ---
  const lineItems = facts.lineItems.length
    ? facts.lineItems.map((l) => ({
        description: [l.product_title ?? l.label ?? productName, l.variant_title].filter(Boolean).join(" — "),
        amount: l.subtotal ? moneyLabel(Math.round(Number(l.subtotal.amount) * 100), tx.currency) : "",
      }))
    : [{ description: `${productName} — ${ctx.plan.name}`, amount: moneyLabel(amounts.totalCents, tx.currency) }];

  if (status === "succeeded" && previousStatus !== "succeeded") {
    if (tx.billing_reason === "renewal") {
      const { data: sub } = tx.subscription_record_id
        ? await admin.from("subscription_records").select("current_period_end").eq("id", tx.subscription_record_id).maybeSingle()
        : { data: null };
      await notify(ctx.userId, {
        category: "billing",
        type: "subscription_renewed",
        title: `${productName} renewed`,
        body: `${moneyLabel(amounts.totalCents, tx.currency)} paid.`,
        url: "/learn/billing",
        email: {
          templateKey: "billing.subscription_renewed",
          idempotencyKey: `subscription-renewed:${p.id}`,
          payload: {
            product_name: productName,
            renews_at: sub?.current_period_end ? formatDate(sub.current_period_end as string) : "your next billing date",
            cta_url: appUrl("/learn/billing"),
            line_items: lineItems,
            total: moneyLabel(amounts.totalCents, tx.currency),
          },
        },
      });
    } else {
      await notify(ctx.userId, {
        category: "billing",
        type: "payment_confirmation",
        title: `Payment received for ${productName}`,
        body: `${moneyLabel(amounts.totalCents, tx.currency)} — ${planPriceLabel(ctx.plan)}`,
        url: "/learn/billing",
        email: {
          templateKey: "billing.payment_confirmation",
          idempotencyKey: `payment-confirmation:${p.id}`,
          payload: {
            product_name: productName,
            cta_url: appUrl("/learn/billing"),
            details: [
              { label: "Plan", value: ctx.plan.name },
              { label: "Paid", value: p.paid_at ? formatDate(p.paid_at, "d MMM yyyy, HH:mm") + " UTC" : "—" },
              { label: "Payment reference", value: p.id },
              ...(facts.paymentMethod ? [{ label: "Payment method", value: facts.paymentMethod }] : []),
            ],
            line_items: lineItems,
            total: moneyLabel(amounts.totalCents, tx.currency),
          },
        },
      });
    }
    effects.confirmation_sent = true;
    const sendOwnReceipts = await getSetting<boolean>("billing.send_foremint_receipts", false);
    if (sendOwnReceipts && receipt) {
      await notify(ctx.userId, {
        category: "billing",
        type: "receipt_available",
        title: `Receipt ${receipt.number} is ready`,
        url: "/learn/billing",
        emailOnly: true,
        email: {
          templateKey: "billing.receipt_available",
          idempotencyKey: `receipt-available:${receipt.id}`,
          payload: { document_number: receipt.number, product_name: productName, cta_url: appUrl("/learn/billing") },
        },
      });
    }
  }

  if (status === "failed" && previousStatus !== "failed") {
    await notify(ctx.userId, {
      category: "billing",
      type: "payment_failed",
      title: `Payment for ${productName} didn't go through`,
      body: p.failure_message ?? undefined,
      url: "/learn/billing",
      email: {
        templateKey: "billing.payment_failed",
        idempotencyKey: `payment-failed:${p.id}:${p.payments_failed ?? 0}`,
        required: true,
        payload: {
          product_name: productName,
          failure_reason: p.failure_message ? `The provider said: ${p.failure_message}` : "",
          cta_url: p.recovery_url ?? appUrl("/learn/billing"),
        },
      },
    });
  }

  if ((status === "refunded" || status === "partially_refunded") && amounts.refundedCents > (existing?.refunded_cents ?? 0)) {
    await notify(ctx.userId, {
      category: "billing",
      type: "refund_processed",
      title: `Refund of ${moneyLabel(amounts.refundedCents, tx.currency)} processed`,
      url: "/learn/billing",
      email: {
        templateKey: "billing.refund_processed",
        idempotencyKey: `refund:${p.id}:${amounts.refundedCents}`,
        payload: {
          product_name: productName,
          amount: moneyLabel(amounts.refundedCents, tx.currency),
          cta_url: appUrl("/learn/billing"),
        },
      },
    });
  }

  await admin
    .from("payment_transactions")
    .update({ raw: { whop: p, effects, matched_by: ctx.matchedBy } as unknown as Json })
    .eq("id", tx.id);

  return result;
}

// ---------------------------------------------------------------------------
// Memberships (recurring plans)
// ---------------------------------------------------------------------------

export async function syncMembershipFromWhop(
  whopMembershipId: string,
  opts: { knownUserId?: string | null } = {},
): Promise<SubscriptionRecordRow | null> {
  const { client } = await getWhopClient();
  const m = await client.memberships.retrieve({ id: whopMembershipId });
  return applyMembership(m, opts.knownUserId ?? null);
}

async function applyMembership(m: Whop.Membership, knownUserId: string | null): Promise<SubscriptionRecordRow | null> {
  const customInvoice = await findInvoiceForMembership(m);
  if (customInvoice) {
    await applyCustomInvoiceMembership(m, customInvoice);
    return null;
  }

  const admin = db();
  const { data: existingRow } = await admin.from("subscription_records").select("*").eq("whop_membership_id", m.id).maybeSingle();
  const existing = existingRow as SubscriptionRecordRow | null;

  const ctx = await resolveContext({
    metadata: m.metadata,
    checkoutConfigurationId: null,
    variantId: m.variant_id,
    whopUserId: m.user_id,
    email: null,
    existingUserId: existing?.user_id ?? knownUserId,
  });

  // One-time purchases are tracked through their payment, not here.
  const recurring = ctx.plan ? ctx.plan.plan_type === "recurring" : m.billing_period_days !== null;
  if (!recurring) return existing;

  const status = normalizeMembershipStatus(m.status);
  const periodEnd = m.current_period_end ?? m.expires_at;
  const { data: saved, error } = await admin
    .from("subscription_records")
    .upsert(
      {
        whop_membership_id: m.id,
        user_id: ctx.userId,
        plan_id: ctx.plan?.id ?? null,
        product_id: ctx.product?.id ?? null,
        status,
        current_period_start: m.current_period_start,
        current_period_end: periodEnd,
        cancel_at_period_end: m.cancel_at_period_end,
        canceled_at: m.canceled_at,
        manage_url: m.manage_url,
        last_synced_at: new Date().toISOString(),
        raw: m as unknown as Json,
      },
      { onConflict: "whop_membership_id" },
    )
    .select("*")
    .single();
  if (error || !saved) throw new Error(`subscription upsert failed: ${error?.message}`);
  const sub = saved as SubscriptionRecordRow;

  await admin
    .from("payment_transactions")
    .update({ subscription_record_id: sub.id })
    .eq("whop_membership_id", m.id)
    .is("subscription_record_id", null);

  if (!ctx.userId || !ctx.plan || !ctx.product) return sub;

  // Refunds and disputes on the membership's latest payment override its status.
  const { data: latest } = await admin
    .from("payment_transactions")
    .select("status, refunded_cents, total_cents")
    .eq("whop_membership_id", m.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const target = entitlementForMembership(
    {
      status,
      cancelAtPeriodEnd: m.cancel_at_period_end,
      currentPeriodEnd: periodEnd ? new Date(periodEnd) : null,
      refunded: latest?.status === "refunded",
      disputed: latest?.status === "disputed",
    },
    ctx.plan.grace_period_days,
  );

  if (target.status === "active") {
    const { allAccess, courseIds } = await productCourseIds(ctx.product);
    await grantAccess({
      userId: ctx.userId,
      courseIds,
      allAccess,
      source: entitlementSource(ctx.product, true),
      startsAt: new Date(m.created_at),
      expiresAt: target.expiresAt,
      productId: ctx.product.id,
      planId: ctx.plan.id,
      checkoutSessionId: ctx.session?.id ?? null,
      subscriptionRecordId: sub.id,
      whopMembershipId: m.id,
    });
  } else {
    await setSubscriptionAccess(sub.id, target);
  }

  // --- Lifecycle emails -------------------------------------------------------
  const productName = ctx.product.name;
  const becameCanceling =
    (m.cancel_at_period_end && !existing?.cancel_at_period_end) ||
    ((status === "canceled" || status === "canceling") && existing && !["canceled", "canceling", "expired"].includes(existing.status));
  if (becameCanceling) {
    await notify(ctx.userId, {
      category: "billing",
      type: "subscription_cancelled",
      title: `${productName} subscription cancelled`,
      url: "/learn/billing",
      email: {
        templateKey: "billing.cancellation_confirmation",
        idempotencyKey: `subscription-cancel:${m.id}:${periodEnd ?? "now"}`,
        payload: {
          product_name: productName,
          access_until:
            target.status === "active" && target.expiresAt
              ? `You keep access until ${formatDate(target.expiresAt)}.`
              : "Your access has ended.",
          cta_url: appUrl("/learn/billing"),
        },
      },
    });
  }

  const ended = target.status === "expired" || target.status === "revoked";
  const wasActive = !existing || ["trialing", "active", "past_due", "canceling"].includes(existing.status);
  if (ended && wasActive && existing) {
    await notify(ctx.userId, {
      category: "billing",
      type: "access_expired",
      title: `Your ${productName} access has ended`,
      url: "/learn/billing",
      email: {
        templateKey: "billing.access_expired",
        idempotencyKey: `subscription-ended:${m.id}:${status}`,
        payload: {
          course_title: productName,
          ended_at: formatDate(target.expiresAt ?? new Date()),
          cta_url: appUrl("/pricing"),
        },
      },
    });
  }

  return sub;
}

export async function applyMembershipObject(m: Whop.Membership) {
  return applyMembership(m, null);
}

export async function applyPaymentObject(p: Whop.Payment) {
  return applyPayment(p);
}
