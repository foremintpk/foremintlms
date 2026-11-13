import { describe, expect, it } from "vitest";
import { entitlementForMembership } from "@/lib/domain/subscriptions";
import { pricingPlanSchema } from "@/lib/domain/pricing";

const DAY = 86_400_000;
const now = new Date("2026-11-14T12:00:00Z");

describe("entitlementForMembership — completed split-pay plans", () => {
  it("keeps access until the final period end", () => {
    const end = new Date(now.getTime() + 10 * DAY);
    expect(entitlementForMembership({ status: "completed", cancelAtPeriodEnd: false, currentPeriodEnd: end }, 3, now)).toMatchObject({
      status: "active",
      expiresAt: end,
    });
  });

  it("keeps access indefinitely when no period end is reported", () => {
    const result = entitlementForMembership({ status: "completed", cancelAtPeriodEnd: false, currentPeriodEnd: null }, 3, now);
    expect(result.status).toBe("active");
    expect(result.expiresAt).toBeNull();
  });

  it("still revokes on refund even when completed", () => {
    expect(entitlementForMembership({ status: "completed", cancelAtPeriodEnd: false, currentPeriodEnd: null, refunded: true }, 3, now).status).toBe("revoked");
  });
});

describe("pricingPlanSchema — Whop minimum charge", () => {
  const base = { name: "Lifetime", plan_type: "one_time" as const, currency: "usd", grace_period_days: 3, visibility: "public" as const, is_featured: false };

  it("rejects paid plans under 1.00", () => {
    expect(pricingPlanSchema.safeParse({ ...base, price_cents: 99 }).success).toBe(false);
  });

  it("accepts paid plans of 1.00 or more", () => {
    expect(pricingPlanSchema.safeParse({ ...base, price_cents: 100 }).success).toBe(true);
  });
});
