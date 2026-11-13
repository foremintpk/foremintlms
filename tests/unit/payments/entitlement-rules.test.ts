import { describe, expect, it } from "vitest";
import { computeAccessWindow } from "@/lib/domain/access";
import { entitlementForMembership, normalizeMembershipStatus } from "@/lib/domain/subscriptions";
import { pricingPlanSchema, planAvailability } from "@/lib/domain/pricing";
import { computeTotals } from "@/lib/domain/billing";

const DAY = 86_400_000;
const start = new Date("2026-11-14T00:00:00Z");

describe("access windows granted by a purchase", () => {
  it("fixed-term plans end N days after payment", () => {
    const w = computeAccessWindow({ plan_type: "one_time", access_duration_days: 90, billing_period_days: null, grace_period_days: 0 }, start);
    expect(w.expiresAt?.toISOString()).toBe(new Date(start.getTime() + 90 * DAY).toISOString());
  });
  it("lifetime plans never expire", () => {
    expect(computeAccessWindow({ plan_type: "one_time", access_duration_days: null, billing_period_days: null, grace_period_days: 0 }, start).expiresAt).toBeNull();
  });
  it("subscriptions run to the paid period end plus grace", () => {
    const periodEnd = new Date(start.getTime() + 30 * DAY);
    const w = computeAccessWindow({ plan_type: "recurring", access_duration_days: null, billing_period_days: 30, grace_period_days: 3 }, start, periodEnd);
    expect(w.expiresAt?.toISOString()).toBe(new Date(periodEnd.getTime() + 3 * DAY).toISOString());
  });
});

describe("membership state → access", () => {
  const now = new Date("2026-11-20T00:00:00Z");
  const periodEnd = new Date("2026-12-14T00:00:00Z");

  it("active memberships keep access through the period plus grace", () => {
    const t = entitlementForMembership({ status: "active", cancelAtPeriodEnd: false, currentPeriodEnd: periodEnd }, 3, now);
    expect(t.status).toBe("active");
    expect(t.expiresAt?.getTime()).toBe(periodEnd.getTime() + 3 * DAY);
  });
  it("cancel-at-period-end keeps access only until the period ends", () => {
    const t = entitlementForMembership({ status: "active", cancelAtPeriodEnd: true, currentPeriodEnd: periodEnd }, 3, now);
    expect(t).toMatchObject({ status: "active" });
    expect(t.expiresAt?.getTime()).toBe(periodEnd.getTime());
  });
  it("past-due memberships keep access during grace, then expire", () => {
    const inGrace = entitlementForMembership({ status: "past_due", cancelAtPeriodEnd: false, currentPeriodEnd: new Date(now.getTime() - DAY) }, 3, now);
    expect(inGrace.status).toBe("active");
    const after = entitlementForMembership({ status: "past_due", cancelAtPeriodEnd: false, currentPeriodEnd: new Date(now.getTime() - 5 * DAY) }, 3, now);
    expect(after.status).toBe("expired");
  });
  it("refunds revoke and disputes suspend immediately", () => {
    expect(entitlementForMembership({ status: "active", cancelAtPeriodEnd: false, currentPeriodEnd: periodEnd, refunded: true }, 3, now).status).toBe("revoked");
    expect(entitlementForMembership({ status: "active", cancelAtPeriodEnd: false, currentPeriodEnd: periodEnd, disputed: true }, 3, now).status).toBe("suspended");
  });
  it("an old successful payment never keeps an expired membership alive", () => {
    expect(entitlementForMembership({ status: "expired", cancelAtPeriodEnd: false, currentPeriodEnd: new Date(now.getTime() - DAY) }, 3, now).status).toBe("expired");
  });
  it("normalises provider spellings", () => {
    expect(normalizeMembershipStatus("cancelled")).toBe("canceled");
    expect(normalizeMembershipStatus("ACTIVE")).toBe("active");
    expect(normalizeMembershipStatus("weird")).toBe("unresolved");
  });
});

describe("plan validation", () => {
  const ok = { name: "Monthly", plan_type: "recurring", currency: "usd", price_cents: 1900, billing_period_days: 30 };
  it("accepts a valid subscription", () => expect(pricingPlanSchema.safeParse(ok).success).toBe(true));
  it("requires a billing interval for subscriptions", () => expect(pricingPlanSchema.safeParse({ ...ok, billing_period_days: null }).success).toBe(false));
  it("free plans must cost 0", () => expect(pricingPlanSchema.safeParse({ ...ok, plan_type: "free", billing_period_days: null }).success).toBe(false));
  it("trials only on subscriptions", () =>
    expect(pricingPlanSchema.safeParse({ ...ok, plan_type: "one_time", billing_period_days: null, trial_days: 7 }).success).toBe(false));
  it("original price must exceed the price", () => expect(pricingPlanSchema.safeParse({ ...ok, compare_at_price_cents: 1000 }).success).toBe(false));
  it("availability windows and stock", () => {
    const now = new Date("2026-11-14T00:00:00Z");
    expect(planAvailability({ plan_type: "one_time", price_cents: 100, currency: "usd", available_until: "2026-11-01T00:00:00Z" }, now).reason).toBe("ended");
    expect(planAvailability({ plan_type: "one_time", price_cents: 100, currency: "usd", available_from: "2026-12-01T00:00:00Z" }, now).reason).toBe("not_started");
    expect(planAvailability({ plan_type: "one_time", price_cents: 100, currency: "usd", stock_limit: 5, units_sold: 5 }, now).reason).toBe("sold_out");
    expect(planAvailability({ plan_type: "one_time", price_cents: 100, currency: "usd" }, now).available).toBe(true);
  });
});

describe("document totals", () => {
  it("uses the provider total as the authority", () => {
    expect(computeTotals([{ description: "x", quantity: 1, unitAmountCents: 1000 }], { providerTotalCents: 900 })).toMatchObject({ totalCents: 900, mismatch: true });
    expect(computeTotals([{ description: "x", quantity: 2, unitAmountCents: 1000 }], { discountCents: 500, taxCents: 150 })).toMatchObject({
      subtotalCents: 2000,
      totalCents: 1650,
      mismatch: false,
    });
  });
});
