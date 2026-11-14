import { z } from "zod";
import type { CouponRow, PlanRow, TransactionStatus } from "./types";

/**
 * Pure translation between Whop's API shapes and our tables. No I/O, so
 * every rule here is unit tested (tests/unit/payments).
 */

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

export interface WhopMoney {
  amount: string;
  currency: string;
  decimals?: number;
}

/**
 * Whop Money → integer minor units (cents). Our tables store cents and the UI
 * formats with two decimals, so amounts are normalised to hundredths.
 */
export function moneyToCents(money: WhopMoney | null | undefined): number | null {
  if (!money || money.amount === undefined || money.amount === null) return null;
  const value = Number(money.amount);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

export function centsToMajor(cents: number): number {
  return Math.round(cents) / 100;
}

// ---------------------------------------------------------------------------
// Webhook events
// ---------------------------------------------------------------------------

export type WhopEventAction =
  | "payment_succeeded"
  | "payment_failed"
  | "payment_pending"
  | "payment_canceled"
  | "membership_activated"
  | "membership_deactivated"
  | "membership_updated"
  | "refund"
  | "dispute"
  | "ignore";

/**
 * Event names come from the SDK's `Whop.WebhookEvent` enum (@whop/sdk 2.8).
 * Anything not listed is stored but not acted upon.
 */
const EVENT_ACTIONS: Record<string, WhopEventAction> = {
  "payment.succeeded": "payment_succeeded",
  "payment.failed": "payment_failed",
  "payment.created": "payment_pending",
  "payment.pending": "payment_pending",
  "payment.authorized": "payment_pending",
  "payment.requires_action": "payment_pending",
  "payment.canceled": "payment_canceled",
  "membership.activated": "membership_activated",
  "membership.deactivated": "membership_deactivated",
  "membership.updated": "membership_updated",
  "membership.cancel_at_period_end_changed": "membership_updated",
  "refund.created": "refund",
  "refund.updated": "refund",
  "dispute.created": "dispute",
  "dispute.updated": "dispute",
  "dispute_alert.created": "dispute",
};

export function classifyWhopEvent(type: string): WhopEventAction {
  return EVENT_ACTIONS[type] ?? "ignore";
}

export const HANDLED_WHOP_EVENTS = Object.keys(EVENT_ACTIONS);

/** The object an event is about, which we always re-fetch from the API. */
export function eventTarget(action: WhopEventAction, data: unknown): { kind: "payment" | "membership"; id: string } | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : null);
  switch (action) {
    case "payment_succeeded":
    case "payment_failed":
    case "payment_pending":
    case "payment_canceled": {
      const id = str(d.id);
      return id ? { kind: "payment", id } : null;
    }
    case "membership_activated":
    case "membership_deactivated":
    case "membership_updated": {
      const id = str(d.id);
      return id ? { kind: "membership", id } : null;
    }
    case "refund": {
      const id = str(d.payment_id) ?? str((d.payment as Record<string, unknown> | undefined)?.id);
      return id ? { kind: "payment", id } : null;
    }
    case "dispute": {
      const payment = d.payment as Record<string, unknown> | undefined;
      const id = str(payment?.id) ?? str(d.payment_id);
      return id ? { kind: "payment", id } : null;
    }
    default:
      return null;
  }
}

/** Exponential backoff for failed webhook processing: 1m, 2m, 4m … capped at 6h. */
export function nextRetryDelayMs(attempts: number): number {
  const minutes = Math.min(2 ** Math.max(0, attempts - 1), 360);
  return minutes * 60_000;
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export interface WhopPaymentLike {
  status: string | null;
  substatus: string | null;
  subtotal: WhopMoney | null;
  total: WhopMoney | null;
  tax_amount: WhopMoney | null;
  tax_behavior: string | null;
  refunded_amount: WhopMoney | null;
  billing_reason: string | null;
}

const DISPUTE_OPEN = new Set([
  "dispute_warning",
  "dispute_needs_response",
  "dispute_warning_needs_response",
  "dispute_under_review",
  "dispute_warning_under_review",
  "open_dispute",
  "resolution_needs_response",
  "resolution_under_review",
  "open_resolution",
]);
const DISPUTE_LOST = new Set(["dispute_lost", "resolution_lost"]);

/** Whop receipt status + dashboard substatus → our transaction status. */
export function mapPaymentStatus(p: Pick<WhopPaymentLike, "status" | "substatus" | "refunded_amount" | "total">): TransactionStatus {
  const status = (p.status ?? "").toLowerCase();
  const sub = (p.substatus ?? "").toLowerCase();
  const refunded = moneyToCents(p.refunded_amount) ?? 0;
  const total = moneyToCents(p.total) ?? 0;

  if (DISPUTE_OPEN.has(sub) || DISPUTE_LOST.has(sub)) return "disputed";
  if (sub === "refunded" || sub === "auto_refunded" || (total > 0 && refunded >= total)) return "refunded";
  if (sub === "partially_refunded" || refunded > 0) return "partially_refunded";
  if (status === "paid") return "succeeded";
  if (status === "void") return "voided";
  if (status === "uncollectible" || sub === "failed" || sub === "blocked" || sub === "uncollectible" || sub === "past_due" || sub === "price_too_low") return "failed";
  if (sub === "canceled") return "voided";
  return "pending";
}

export function isDisputeResolvedInOurFavour(substatus: string | null): boolean {
  const s = (substatus ?? "").toLowerCase();
  return s === "dispute_won" || s === "resolution_won" || s === "dispute_warning_closed" || s === "dispute_closed";
}

export interface PaymentAmounts {
  subtotalCents: number | null;
  discountCents: number;
  taxCents: number | null;
  totalCents: number;
  refundedCents: number;
}

/**
 * Whop reports `subtotal` (before discounts/tax), `total` (after discounts,
 * plus tax when exclusive) and `tax_amount`. The discount is derived; it is
 * never negative.
 */
export function derivePaymentAmounts(p: WhopPaymentLike): PaymentAmounts {
  const subtotal = moneyToCents(p.subtotal);
  const total = moneyToCents(p.total) ?? 0;
  const tax = moneyToCents(p.tax_amount);
  const exclusive = (p.tax_behavior ?? "").toLowerCase() === "exclusive";
  const netOfTax = exclusive && tax !== null ? total - tax : total;
  const discount = subtotal !== null ? Math.max(0, subtotal - netOfTax) : 0;
  return {
    subtotalCents: subtotal,
    discountCents: discount,
    taxCents: tax,
    totalCents: total,
    refundedCents: moneyToCents(p.refunded_amount) ?? 0,
  };
}

export function mapBillingReason(reason: string | null | undefined): "initial" | "renewal" | "one_time" | "other" {
  switch ((reason ?? "").toLowerCase()) {
    case "subscription_create":
      return "initial";
    case "subscription_cycle":
      return "renewal";
    case "one_time":
      return "one_time";
    default:
      return "other";
  }
}

// ---------------------------------------------------------------------------
// Metadata we attach to checkout configurations (inherited by payments and
// memberships). Never trusted on its own: the checkout session row must
// exist and belong to the same user.
// ---------------------------------------------------------------------------

export const foremintMetadataSchema = z.object({
  foremint_user_id: z.uuid(),
  checkout_session_id: z.uuid(),
  plan_id: z.uuid(),
  product_id: z.uuid(),
  context: z.string().max(60).optional(),
});

export type ForemintMetadata = z.infer<typeof foremintMetadataSchema>;

export function parseForemintMetadata(metadata: unknown): ForemintMetadata | null {
  const result = foremintMetadataSchema.safeParse(metadata ?? {});
  return result.success ? result.data : null;
}

// ---------------------------------------------------------------------------
// Catalog → Whop variant / promo code payloads
// ---------------------------------------------------------------------------

export const WHOP_MIN_PAID_CENTS = 100;

interface VariantBase {
  currency: string;
  unlimited_stock: boolean;
  /** Only sent when stock is limited. */
  stock?: number;
  visibility: "hidden" | "archived";
  title: string;
  description: string | null;
  release_method: "buy_now";
  metadata: Record<string, string>;
}

/**
 * Whop validates price fields as numbers even where they don't apply (it
 * rejects `renewal_price: null` on one-time variants), so each billing type
 * sends only its own fields, with 0 for "none".
 */
export type VariantPayload =
  | (VariantBase & {
      billing_type: "one_time";
      initial_price: number;
      renewal_price: 0;
      /** Days of access; null = lifetime. */
      expiration_days: number | null;
    })
  | (VariantBase & {
      billing_type: "renewal";
      /** Extra amount on the first charge only; the first period itself is billed at renewal_price. */
      initial_price: 0;
      renewal_price: number;
      billing_period: number;
      /** 0 = no free trial. */
      trial_period_days: number;
    });

/**
 * Our plan → a Whop variant. Variants are kept hidden on Whop's storefront so
 * purchases always start from Foremint checkout, which enforces availability
 * windows and attaches the metadata that links a payment to a learner.
 */
export function planToVariantPayload(plan: PlanRow, productId: string): VariantPayload {
  if (plan.plan_type === "free") throw new Error("Free plans are fulfilled by Foremint and are not synced to Whop.");
  if (plan.price_cents < WHOP_MIN_PAID_CENTS) throw new Error("Whop requires paid plans to cost at least 1.00.");
  const remaining = plan.stock_limit === null ? null : Math.max(0, plan.stock_limit - plan.units_sold);
  const base: VariantBase = {
    currency: plan.currency,
    unlimited_stock: remaining === null,
    ...(remaining === null ? {} : { stock: remaining }),
    visibility: plan.visibility === "archived" ? "archived" : "hidden",
    title: plan.name.slice(0, 30),
    description: plan.description ? plan.description.slice(0, 1000) : null,
    release_method: "buy_now",
    metadata: { foremint_plan_id: plan.id, foremint_product_id: productId },
  };
  if (plan.plan_type === "recurring") {
    if (!plan.billing_period_days) throw new Error("Subscriptions need a billing period.");
    return {
      ...base,
      billing_type: "renewal",
      initial_price: 0,
      renewal_price: centsToMajor(plan.price_cents),
      billing_period: plan.billing_period_days,
      trial_period_days: plan.trial_days ?? 0,
    };
  }
  return {
    ...base,
    billing_type: "one_time",
    initial_price: centsToMajor(plan.price_cents),
    renewal_price: 0,
    expiration_days: plan.access_duration_days,
  };
}

/** The "was" price shown struck through on Whop's checkout; only the field that applies to the plan type. */
export function strikeThroughPrices(plan: PlanRow): { strike_through_initial_price: number | null } | { strike_through_renewal_price: number | null } {
  const value = plan.compare_at_price_cents === null ? null : centsToMajor(plan.compare_at_price_cents);
  return plan.plan_type === "recurring" ? { strike_through_renewal_price: value } : { strike_through_initial_price: value };
}

export interface PromoCodePayload {
  code: string;
  amount_off: number;
  base_currency: string;
  promo_type: "percentage" | "flat_amount";
  new_users_only: boolean;
  one_per_customer: boolean;
  promo_duration_months: number;
  expires_at: string | null;
  unlimited_stock: boolean;
  stock: number | null;
  variant_ids: string[];
}

/**
 * Our coupon → a Whop promo code. Discounts apply to the first payment only
 * (`promo_duration_months: 1`), which matches how the coupon is presented.
 */
export function couponToPromoPayload(coupon: CouponRow, whopVariantIds: string[]): PromoCodePayload {
  const remaining = coupon.max_redemptions === null ? null : Math.max(0, coupon.max_redemptions - coupon.redemptions_count);
  return {
    code: coupon.code.toUpperCase(),
    amount_off: Number(coupon.amount),
    base_currency: (coupon.currency ?? "usd").toLowerCase(),
    promo_type: coupon.discount_type === "percent" ? "percentage" : "flat_amount",
    new_users_only: coupon.new_customers_only,
    one_per_customer: true,
    promo_duration_months: 1,
    expires_at: coupon.expires_at,
    unlimited_stock: remaining === null,
    stock: remaining,
    variant_ids: whopVariantIds,
  };
}

/** Whop variant visibility for a plan, used to detect drift during sync. */
export function expectedVariantVisibility(plan: Pick<PlanRow, "visibility">): "hidden" | "archived" {
  return plan.visibility === "archived" ? "archived" : "hidden";
}
