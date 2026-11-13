import { describe, expect, it } from "vitest";
import {
  accessExpiryFromDuration,
  compactNumber,
  computeMrr,
  monthlyEquivalentCents,
  percentChange,
  previousRange,
  ratePercent,
  resolveDateRange,
} from "@/lib/services/admin/metrics";

describe("monthlyEquivalentCents", () => {
  it("treats 28–31 day periods as exactly monthly", () => {
    expect(monthlyEquivalentCents(1900, 30)).toBe(1900);
    expect(monthlyEquivalentCents(1900, 31)).toBe(1900);
  });
  it("normalises yearly, quarterly, half-yearly and weekly plans", () => {
    expect(monthlyEquivalentCents(12000, 365)).toBe(1000);
    expect(monthlyEquivalentCents(3000, 90)).toBe(1000);
    expect(monthlyEquivalentCents(6000, 182)).toBe(1000);
    expect(monthlyEquivalentCents(1200, 7)).toBe(5200);
  });
  it("scales irregular periods linearly", () => {
    expect(monthlyEquivalentCents(1000, 60)).toBe(500);
  });
  it("returns 0 for missing periods or free plans", () => {
    expect(monthlyEquivalentCents(1000, null)).toBe(0);
    expect(monthlyEquivalentCents(0, 30)).toBe(0);
  });
});

describe("computeMrr", () => {
  it("sums paying statuses per currency and ignores trials and ended subscriptions", () => {
    const mrr = computeMrr([
      { status: "active", price_cents: 1900, currency: "usd", billing_period_days: 30 },
      { status: "canceling", price_cents: 12000, currency: "usd", billing_period_days: 365 },
      { status: "past_due", price_cents: 1500, currency: "gbp", billing_period_days: 30 },
      { status: "trialing", price_cents: 1900, currency: "usd", billing_period_days: 30 },
      { status: "canceled", price_cents: 1900, currency: "usd", billing_period_days: 30 },
      { status: "expired", price_cents: 1900, currency: "usd", billing_period_days: 30 },
    ]);
    expect(mrr).toEqual({ usd: 2900, gbp: 1500 });
  });
});

describe("rates and changes", () => {
  it("computes percentages safely", () => {
    expect(ratePercent(1, 3)).toBe(33.3);
    expect(ratePercent(5, 0)).toBe(0);
  });
  it("reports change versus the previous period", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(10, 0)).toBeNull();
  });
  it("formats compact numbers", () => {
    expect(compactNumber(1284)).toBe("1,284");
    expect(compactNumber(12_900)).toBe("12.9K");
  });
});

describe("resolveDateRange", () => {
  const now = new Date("2026-11-14T15:30:00Z");

  it("defaults to the last 30 days with daily buckets", () => {
    const r = resolveDateRange({}, now);
    expect(r.key).toBe("30d");
    expect(r.bucket).toBe("day");
    expect(r.to.toISOString()).toBe("2026-11-14T23:59:59.999Z");
    expect(r.from.toISOString()).toBe("2026-10-16T00:00:00.000Z");
  });

  it("uses weekly buckets for 90 days and monthly for 12 months", () => {
    expect(resolveDateRange({ range: "90d" }, now).bucket).toBe("week");
    expect(resolveDateRange({ range: "12m" }, now).bucket).toBe("month");
  });

  it("accepts a valid custom range and picks a bucket by span", () => {
    const r = resolveDateRange({ range: "custom", from: "2026-01-01", to: "2026-06-30" }, now);
    expect(r.key).toBe("custom");
    expect(r.bucket).toBe("month");
    expect(r.to.toISOString()).toBe("2026-06-30T23:59:59.999Z");
  });

  it("falls back when a custom range is invalid", () => {
    expect(resolveDateRange({ range: "custom", from: "2026-06-30", to: "2026-01-01" }, now).key).toBe("30d");
    expect(resolveDateRange({ range: "custom", from: "nope", to: "2026-01-01" }, now).key).toBe("30d");
    expect(resolveDateRange({ range: "999d" }, now).key).toBe("30d");
  });

  it("computes the previous window of equal length", () => {
    const r = resolveDateRange({ range: "7d" }, now);
    const prev = previousRange(r);
    expect(prev.to.getTime()).toBe(r.from.getTime() - 1);
    expect(r.to.getTime() - r.from.getTime()).toBe(prev.to.getTime() - prev.from.getTime());
  });
});

describe("accessExpiryFromDuration", () => {
  const now = new Date("2026-11-14T12:00:00Z");
  it("returns null for lifetime access", () => {
    expect(accessExpiryFromDuration("lifetime", null, now)).toBeNull();
  });
  it("adds whole days for presets", () => {
    expect(accessExpiryFromDuration("30", null, now)?.toISOString()).toBe("2026-12-14T12:00:00.000Z");
  });
  it("ends a custom grant at the end of the chosen UTC day", () => {
    expect(accessExpiryFromDuration("custom", "2027-01-31", now)?.toISOString()).toBe("2027-01-31T23:59:59.000Z");
  });
  it("rejects past or malformed custom dates and bad presets", () => {
    expect(() => accessExpiryFromDuration("custom", "2026-11-01", now)).toThrow(/future/);
    expect(() => accessExpiryFromDuration("custom", "31/01/2027", now)).toThrow(/end date/);
    expect(() => accessExpiryFromDuration("-5", null, now)).toThrow(/duration/);
  });
});
