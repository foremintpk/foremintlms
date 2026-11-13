import { describe, expect, it } from "vitest";
import {
  classifyWhopEvent,
  couponToPromoPayload,
  derivePaymentAmounts,
  eventTarget,
  mapBillingReason,
  mapPaymentStatus,
  moneyToCents,
  nextRetryDelayMs,
  parseForemintMetadata,
  planToVariantPayload,
  strikeThroughPrices,
  isDisputeResolvedInOurFavour,
} from "@/lib/services/payments/mapping";
import type { CouponRow, PlanRow } from "@/lib/services/payments/types";

const usd = (amount: string) => ({ amount, currency: "usd", decimals: 2 });

function plan(overrides: Partial<PlanRow> = {}): PlanRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    product_id: "22222222-2222-4222-8222-222222222222",
    name: "Lifetime access",
    description: null,
    plan_type: "one_time",
    currency: "usd",
    price_cents: 4900,
    compare_at_price_cents: null,
    access_duration_days: null,
    billing_period_days: null,
    trial_days: null,
    grace_period_days: 3,
    stock_limit: null,
    units_sold: 0,
    available_from: null,
    available_until: null,
    promo_label: null,
    visibility: "public",
    is_featured: false,
    sort_order: 0,
    whop_plan_id: null,
    whop_synced_at: null,
    whop_sync_error: null,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
    ...overrides,
  };
}

describe("webhook event classification", () => {
  it("maps the events that change access", () => {
    expect(classifyWhopEvent("payment.succeeded")).toBe("payment_succeeded");
    expect(classifyWhopEvent("payment.failed")).toBe("payment_failed");
    expect(classifyWhopEvent("payment.pending")).toBe("payment_pending");
    expect(classifyWhopEvent("membership.activated")).toBe("membership_activated");
    expect(classifyWhopEvent("membership.deactivated")).toBe("membership_deactivated");
    expect(classifyWhopEvent("membership.cancel_at_period_end_changed")).toBe("membership_updated");
    expect(classifyWhopEvent("refund.created")).toBe("refund");
    expect(classifyWhopEvent("refund.updated")).toBe("refund");
    expect(classifyWhopEvent("dispute.created")).toBe("dispute");
    expect(classifyWhopEvent("dispute_alert.created")).toBe("dispute");
  });

  it("ignores events that don't affect learners", () => {
    expect(classifyWhopEvent("payout.created")).toBe("ignore");
    expect(classifyWhopEvent("product.updated")).toBe("ignore");
    expect(classifyWhopEvent("something.new")).toBe("ignore");
  });

  it("finds the object to re-fetch for each event kind", () => {
    expect(eventTarget("payment_succeeded", { id: "pay_1" })).toEqual({ kind: "payment", id: "pay_1" });
    expect(eventTarget("membership_deactivated", { id: "mem_1" })).toEqual({ kind: "membership", id: "mem_1" });
    expect(eventTarget("refund", { id: "rf_1", payment_id: "pay_9" })).toEqual({ kind: "payment", id: "pay_9" });
    expect(eventTarget("dispute", { id: "dp_1", payment: { id: "pay_7" } })).toEqual({ kind: "payment", id: "pay_7" });
    expect(eventTarget("payment_succeeded", {})).toBeNull();
    expect(eventTarget("ignore", { id: "x" })).toBeNull();
  });
});

describe("money", () => {
  it("converts decimal strings to cents without float drift", () => {
    expect(moneyToCents(usd("10.43"))).toBe(1043);
    expect(moneyToCents(usd("0.10"))).toBe(10);
    expect(moneyToCents(usd("19.99"))).toBe(1999);
    expect(moneyToCents(null)).toBeNull();
    expect(moneyToCents({ amount: "abc", currency: "usd" })).toBeNull();
  });
});

describe("payment status mapping", () => {
  const base = { refunded_amount: usd("0.00"), total: usd("49.00") };
  it("paid → succeeded", () => expect(mapPaymentStatus({ ...base, status: "paid", substatus: "succeeded" })).toBe("succeeded"));
  it("full refund", () => expect(mapPaymentStatus({ ...base, status: "paid", substatus: "refunded", refunded_amount: usd("49.00") })).toBe("refunded"));
  it("refund detected from amounts even without substatus", () =>
    expect(mapPaymentStatus({ status: "paid", substatus: "succeeded", refunded_amount: usd("49.00"), total: usd("49.00") })).toBe("refunded"));
  it("partial refund", () => expect(mapPaymentStatus({ ...base, status: "paid", substatus: "partially_refunded", refunded_amount: usd("10.00") })).toBe("partially_refunded"));
  it("open dispute", () => expect(mapPaymentStatus({ ...base, status: "paid", substatus: "dispute_needs_response" })).toBe("disputed"));
  it("lost dispute stays disputed", () => expect(mapPaymentStatus({ ...base, status: "paid", substatus: "dispute_lost" })).toBe("disputed"));
  it("won dispute returns to succeeded", () => expect(mapPaymentStatus({ ...base, status: "paid", substatus: "dispute_won" })).toBe("succeeded"));
  it("failed attempt", () => expect(mapPaymentStatus({ ...base, status: "open", substatus: "failed" })).toBe("failed"));
  it("pending settlement", () => expect(mapPaymentStatus({ ...base, status: "pending", substatus: "pending" })).toBe("pending"));
  it("void", () => expect(mapPaymentStatus({ ...base, status: "void", substatus: "canceled" })).toBe("voided"));
  it("dispute outcome helper", () => {
    expect(isDisputeResolvedInOurFavour("dispute_won")).toBe(true);
    expect(isDisputeResolvedInOurFavour("dispute_lost")).toBe(false);
  });
});

describe("payment amounts", () => {
  it("derives the discount with exclusive tax", () => {
    const a = derivePaymentAmounts({
      status: "paid",
      substatus: "succeeded",
      subtotal: usd("100.00"),
      total: usd("88.00"),
      tax_amount: usd("8.00"),
      tax_behavior: "exclusive",
      refunded_amount: usd("0.00"),
      billing_reason: "one_time",
    });
    expect(a).toEqual({ subtotalCents: 10000, discountCents: 2000, taxCents: 800, totalCents: 8800, refundedCents: 0 });
  });
  it("derives the discount with inclusive tax", () => {
    const a = derivePaymentAmounts({
      status: "paid",
      substatus: "succeeded",
      subtotal: usd("100.00"),
      total: usd("90.00"),
      tax_amount: usd("15.00"),
      tax_behavior: "inclusive",
      refunded_amount: null,
      billing_reason: null,
    });
    expect(a.discountCents).toBe(1000);
    expect(a.taxCents).toBe(1500);
  });
  it("never reports a negative discount", () => {
    const a = derivePaymentAmounts({ status: "paid", substatus: null, subtotal: usd("10.00"), total: usd("12.00"), tax_amount: null, tax_behavior: null, refunded_amount: null, billing_reason: null });
    expect(a.discountCents).toBe(0);
  });
  it("maps billing reasons", () => {
    expect(mapBillingReason("subscription_create")).toBe("initial");
    expect(mapBillingReason("subscription_cycle")).toBe("renewal");
    expect(mapBillingReason("one_time")).toBe("one_time");
    expect(mapBillingReason("manual")).toBe("other");
    expect(mapBillingReason(null)).toBe("other");
  });
});

describe("checkout metadata", () => {
  const valid = {
    foremint_user_id: "33333333-3333-4333-8333-333333333333",
    checkout_session_id: "44444444-4444-4444-8444-444444444444",
    plan_id: "11111111-1111-4111-8111-111111111111",
    product_id: "22222222-2222-4222-8222-222222222222",
    context: "course:one_time",
    course_ids: "a,b",
  };
  it("accepts our metadata and ignores extra keys", () => {
    expect(parseForemintMetadata(valid)?.checkout_session_id).toBe(valid.checkout_session_id);
  });
  it("rejects missing or malformed ids", () => {
    expect(parseForemintMetadata({ ...valid, foremint_user_id: "not-a-uuid" })).toBeNull();
    expect(parseForemintMetadata({})).toBeNull();
    expect(parseForemintMetadata(null)).toBeNull();
  });
});

describe("plan → Whop variant", () => {
  it("one-time plans charge an initial price and carry the access length", () => {
    const v = planToVariantPayload(plan({ access_duration_days: 90, price_cents: 4900 }), "prod-local");
    expect(v).toMatchObject({ billing_type: "one_time", initial_price: 49, renewal_price: null, expiration_days: 90, visibility: "hidden" });
    expect(v.metadata).toEqual({ foremint_plan_id: plan().id, foremint_product_id: "prod-local" });
  });
  it("subscriptions charge the renewal price each period, with trial", () => {
    const v = planToVariantPayload(plan({ plan_type: "recurring", price_cents: 1900, billing_period_days: 30, trial_days: 7 }), "p");
    expect(v).toMatchObject({ billing_type: "renewal", initial_price: 0, renewal_price: 19, billing_period: 30, trial_period_days: 7, expiration_days: null });
  });
  it("limited stock syncs the remaining places", () => {
    const v = planToVariantPayload(plan({ stock_limit: 50, units_sold: 12 }), "p");
    expect(v).toMatchObject({ unlimited_stock: false, stock: 38 });
    expect(planToVariantPayload(plan(), "p")).toMatchObject({ unlimited_stock: true, stock: null });
  });
  it("archived plans are archived on Whop; others stay hidden from Whop's storefront", () => {
    expect(planToVariantPayload(plan({ visibility: "archived" }), "p").visibility).toBe("archived");
    expect(planToVariantPayload(plan({ visibility: "hidden" }), "p").visibility).toBe("hidden");
  });
  it("refuses free plans and prices below Whop's minimum", () => {
    expect(() => planToVariantPayload(plan({ plan_type: "free", price_cents: 0 }), "p")).toThrow(/Free plans/);
    expect(() => planToVariantPayload(plan({ price_cents: 99 }), "p")).toThrow(/at least 1.00/);
  });
  it("truncates titles to Whop's 30-character limit", () => {
    expect(planToVariantPayload(plan({ name: "A very long plan name that keeps going" }), "p").title).toHaveLength(30);
  });
  it("puts the strike-through price on the charged side", () => {
    expect(strikeThroughPrices(plan({ compare_at_price_cents: 9900 }))).toEqual({ strike_through_initial_price: 99, strike_through_renewal_price: null });
    expect(strikeThroughPrices(plan({ plan_type: "recurring", compare_at_price_cents: 2900 }))).toEqual({ strike_through_initial_price: null, strike_through_renewal_price: 29 });
  });
});

describe("coupon → Whop promo code", () => {
  const coupon: CouponRow = {
    id: "c1",
    code: "launch20",
    description: null,
    discount_type: "percent",
    amount: 20,
    currency: null,
    max_redemptions: 100,
    redemptions_count: 30,
    starts_at: null,
    expires_at: "2027-01-01T00:00:00Z",
    plan_ids: [],
    new_customers_only: true,
    status: "active",
    whop_promo_code_id: null,
    whop_synced_at: null,
    whop_sync_error: null,
    created_by: null,
    created_at: "",
    updated_at: "",
  };
  it("maps percentage codes with remaining stock", () => {
    expect(couponToPromoPayload(coupon, ["plan_a"])).toMatchObject({
      code: "LAUNCH20",
      promo_type: "percentage",
      amount_off: 20,
      base_currency: "usd",
      new_users_only: true,
      unlimited_stock: false,
      stock: 70,
      variant_ids: ["plan_a"],
    });
  });
  it("maps fixed codes in their currency", () => {
    expect(couponToPromoPayload({ ...coupon, discount_type: "fixed", amount: 10, currency: "gbp", max_redemptions: null }, [])).toMatchObject({
      promo_type: "flat_amount",
      base_currency: "gbp",
      unlimited_stock: true,
    });
  });
});

describe("webhook retry backoff", () => {
  it("grows exponentially and caps at six hours", () => {
    expect(nextRetryDelayMs(1)).toBe(60_000);
    expect(nextRetryDelayMs(2)).toBe(120_000);
    expect(nextRetryDelayMs(5)).toBe(16 * 60_000);
    expect(nextRetryDelayMs(30)).toBe(360 * 60_000);
  });
});
