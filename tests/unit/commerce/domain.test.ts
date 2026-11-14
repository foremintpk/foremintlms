import { describe, expect, it } from "vitest";
import {
  allocateDiscount,
  checkPayableTotal,
  durationLabel,
  evaluateCoupon,
  isOrderPayable,
  learnerEmailSchema,
  maskEmail,
  orderAccessWindow,
  orderFingerprintSource,
  parseSelectorSettings,
  resolveDuration,
  sortDurations,
  verifyOrderPayment,
  type BasketLine,
  type CouponRule,
} from "@/lib/domain/commerce";

const NOW = new Date("2026-11-15T12:00:00Z");

// The spec's example basket: $20 + $15 + $25 + $20 + $30 = $110.
const lines: BasketLine[] = [
  { courseId: "amazon", planId: "p-amazon", productId: "x", title: "Amazon FBA", priceMinor: 2000 },
  { courseId: "shopify", planId: "p-shopify", productId: "x", title: "Shopify", priceMinor: 1500 },
  { courseId: "seo", planId: "p-seo", productId: "x", title: "SEO", priceMinor: 2500 },
  { courseId: "wp", planId: "p-wp", productId: "x", title: "WordPress", priceMinor: 2000 },
  { courseId: "dm", planId: "p-dm", productId: "x", title: "Digital Marketing", priceMinor: 3000 },
];

function coupon(overrides: Partial<CouponRule> = {}): CouponRule {
  return {
    id: "c1",
    code: "SAVE10",
    discount_type: "percent",
    amount: 10,
    currency: null,
    status: "active",
    applies_to: "packages",
    starts_at: null,
    expires_at: null,
    max_redemptions: null,
    redemptions_count: 0,
    plan_ids: [],
    course_ids: [],
    min_subtotal_cents: null,
    max_redemptions_per_customer: null,
    new_customers_only: false,
    ...overrides,
  };
}

const ctx = { lines, currency: "usd", now: NOW };

describe("coupon evaluation (TEST B)", () => {
  it("SAVE10 on $110 is $11 off, charging $99", () => {
    const r = evaluateCoupon(coupon(), ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.discountMinor).toBe(1100);
    expect(11000 - r.discountMinor).toBe(9900);
    expect(Object.values(r.allocations).reduce((s, v) => s + v, 0)).toBe(1100);
  });

  it("fixed discounts are exact and never exceed the eligible amount", () => {
    const r = evaluateCoupon(coupon({ discount_type: "fixed", amount: "500.00", currency: "usd" }), ctx);
    expect(r.ok && r.discountMinor).toBe(11000);
    const small = evaluateCoupon(coupon({ discount_type: "fixed", amount: "12.34", currency: "usd" }), ctx);
    expect(small.ok && small.discountMinor).toBe(1234);
  });

  it("percentages with decimals use exact integer maths", () => {
    const r = evaluateCoupon(coupon({ amount: 12.5 }), ctx);
    expect(r.ok && r.discountMinor).toBe(1375);
  });

  it.each([
    [{ status: "disabled" as const }, "inactive"],
    [{ status: "archived" as const }, "inactive"],
    [{ expires_at: "2026-11-01T00:00:00Z" }, "expired"],
    [{ starts_at: "2026-12-01T00:00:00Z" }, "not_started"],
    [{ max_redemptions: 5, redemptions_count: 5 }, "exhausted"],
    [{ applies_to: "plans" as const }, "plans_only"],
    [{ discount_type: "fixed" as const, amount: 5, currency: "eur" }, "currency"],
    [{ course_ids: ["not-in-cart"] }, "not_eligible"],
    [{ plan_ids: ["not-in-cart"] }, "not_eligible"],
    [{ min_subtotal_cents: 20000 }, "min_subtotal"],
  ])("rejects %o with %s", (overrides, reason) => {
    const r = evaluateCoupon(coupon(overrides), ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe(reason);
  });

  it("rejects unknown codes and empty baskets", () => {
    expect(evaluateCoupon(null, ctx)).toMatchObject({ ok: false, reason: "not_found" });
    expect(evaluateCoupon(coupon(), { ...ctx, lines: [] })).toMatchObject({ ok: false, reason: "empty_cart" });
  });

  it("applies course restrictions to eligible courses only", () => {
    const r = evaluateCoupon(coupon({ amount: 50, course_ids: ["seo", "dm"] }), ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.discountMinor).toBe(2750); // 50% of 25 + 30
    expect(r.eligibleCourseIds.sort()).toEqual(["dm", "seo"]);
    expect(r.allocations.amazon).toBeUndefined();
  });

  it("enforces per-customer limits and first-time-only codes when the email is known", () => {
    expect(evaluateCoupon(coupon({ max_redemptions_per_customer: 1 }), { ...ctx, customerRedemptions: 1 })).toMatchObject({ ok: false, reason: "customer_limit" });
    expect(evaluateCoupon(coupon({ max_redemptions_per_customer: 1 }), { ...ctx, customerRedemptions: 0 }).ok).toBe(true);
    expect(evaluateCoupon(coupon({ new_customers_only: true }), { ...ctx, returningCustomer: true })).toMatchObject({ ok: false, reason: "new_customers_only" });
    expect(evaluateCoupon(coupon({ new_customers_only: true }), { ...ctx, returningCustomer: null }).ok).toBe(true);
  });
});

describe("discount allocation", () => {
  it("splits exactly with largest remainders", () => {
    const a = allocateDiscount([{ courseId: "a", priceMinor: 1000 }, { courseId: "b", priceMinor: 1000 }, { courseId: "c", priceMinor: 1000 }], 100);
    expect(a.a + a.b + a.c).toBe(100);
    expect(Math.max(a.a, a.b, a.c) - Math.min(a.a, a.b, a.c)).toBeLessThanOrEqual(1);
  });
});

describe("totals and minimums", () => {
  it("allows free orders, refuses totals Whop can't charge", () => {
    expect(checkPayableTotal(0, "usd")).toEqual({ ok: true, free: true });
    expect(checkPayableTotal(50, "usd").ok).toBe(false);
    expect(checkPayableTotal(100, "usd")).toEqual({ ok: true, free: false });
  });
});

describe("payment verification", () => {
  const order = { currency: "usd", total_minor: 9900, status: "pending_payment" };
  const facts = { accountId: "biz_1", currency: "usd", subtotalMinor: 9900, totalMinor: 9900, taxMinor: null, promoCodeId: null };

  it("accepts the exact amount on our account", () => {
    expect(verifyOrderPayment(order, facts, "biz_1")).toEqual({ ok: true });
    expect(verifyOrderPayment(order, { ...facts, subtotalMinor: null, totalMinor: 10890, taxMinor: 990 }, "biz_1")).toEqual({ ok: true });
  });

  it.each([
    [{ accountId: "biz_other" }, /account/],
    [{ currency: "eur" }, /EUR/],
    [{ subtotalMinor: 11000 }, /110\.00/],
    [{ promoCodeId: "promo_1" }, /promo code/],
    [{ subtotalMinor: null, totalMinor: null }, /did not report/],
  ])("holds %o for review", (overrides, reason) => {
    const r = verifyOrderPayment(order, { ...facts, ...overrides }, "biz_1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(reason);
  });

  it("holds payments for cancelled or expired orders", () => {
    expect(verifyOrderPayment({ ...order, status: "cancelled" }, facts, "biz_1").ok).toBe(false);
  });
});

describe("access periods", () => {
  it("counts the window from the verified payment time", () => {
    const paid = new Date("2026-11-14T10:00:00Z");
    expect(orderAccessWindow(30, paid).expiresAt?.toISOString()).toBe("2026-12-14T10:00:00.000Z");
    expect(orderAccessWindow(null, paid).expiresAt).toBeNull();
  });

  it("labels, sorts and resolves periods", () => {
    expect(durationLabel("30")).toBe("30 days");
    expect(durationLabel("365")).toBe("1 year");
    expect(durationLabel("lifetime")).toBe("Lifetime");
    expect(sortDurations(["lifetime", "90", "30"])).toEqual(["30", "90", "lifetime"]);
    expect(resolveDuration("90", ["30", "90"], { default_duration: "30" })).toBe("90");
    expect(resolveDuration("60", ["30", "90"], { default_duration: "30" })).toBe("30");
    expect(resolveDuration(null, ["90", "lifetime"], { default_duration: "30" })).toBe("90");
    expect(resolveDuration(null, [], { default_duration: "30" })).toBeNull();
  });

  it("falls back to defaults for invalid settings", () => {
    expect(parseSelectorSettings({ durations: [] }).durations.length).toBeGreaterThan(0);
    expect(parseSelectorSettings({ max_courses: 3, currency: "gbp" })).toMatchObject({ max_courses: 3, currency: "gbp" });
  });
});

describe("orders", () => {
  it("is payable only while open, linked and unexpired", () => {
    const base = { status: "pending_payment", expires_at: "2026-11-16T00:00:00Z", whop_checkout_url: "https://whop.com/checkout/ch_1/" };
    expect(isOrderPayable(base, NOW)).toBe(true);
    expect(isOrderPayable({ ...base, expires_at: "2026-11-15T00:00:00Z" }, NOW)).toBe(false);
    expect(isOrderPayable({ ...base, status: "paid" }, NOW)).toBe(false);
    expect(isOrderPayable({ ...base, whop_checkout_url: null }, NOW)).toBe(false);
  });

  it("fingerprints independent of course order and email case", () => {
    const a = orderFingerprintSource({ courseIds: ["b", "a"], duration: "30", currency: "USD", couponCode: "save10", totalMinor: 9900, email: "Sam@Example.com " });
    const b = orderFingerprintSource({ courseIds: ["a", "b"], duration: "30", currency: "usd", couponCode: "SAVE10", totalMinor: 9900, email: "sam@example.com" });
    expect(a).toBe(b);
  });

  it("normalises and validates learner emails; masks them for shared pages", () => {
    expect(learnerEmailSchema.parse("  Sam@Example.COM ")).toBe("sam@example.com");
    expect(learnerEmailSchema.safeParse("not-an-email").success).toBe(false);
    expect(maskEmail("student@example.com")).toBe("st•••••@example.com");
  });
});
