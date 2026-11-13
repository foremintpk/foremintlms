/**
 * Pure metric helpers for admin analytics (unit tested).
 */

const DAY_MS = 86_400_000;

/**
 * Monthly-equivalent price for a recurring plan, used for MRR.
 * Calendar-style periods map to exact fractions (yearly = /12, quarterly
 * = /3, weekly = ×52/12) so a "monthly" plan billed every 30 days counts
 * as exactly its price rather than 30.44/30 of it.
 */
export function monthlyEquivalentCents(priceCents: number, billingPeriodDays: number | null | undefined): number {
  if (!billingPeriodDays || billingPeriodDays <= 0 || priceCents <= 0) return 0;
  const d = billingPeriodDays;
  if (d >= 28 && d <= 31) return priceCents;
  if (d >= 364 && d <= 366) return Math.round(priceCents / 12);
  if (d >= 89 && d <= 92) return Math.round(priceCents / 3);
  if (d >= 180 && d <= 184) return Math.round(priceCents / 6);
  if (d === 7) return Math.round((priceCents * 52) / 12);
  if (d === 14) return Math.round((priceCents * 26) / 12);
  return Math.round((priceCents * 30) / d);
}

/** Statuses that count as recurring revenue (trials are not revenue yet). */
export const MRR_STATUSES = ["active", "canceling", "past_due"] as const;

export interface SubscriptionForMrr {
  status: string;
  price_cents: number | null;
  currency: string | null;
  billing_period_days: number | null;
}

/** MRR in minor units, grouped by currency (never summed across currencies). */
export function computeMrr(subs: SubscriptionForMrr[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of subs) {
    if (!(MRR_STATUSES as readonly string[]).includes(s.status)) continue;
    const currency = (s.currency ?? "usd").toLowerCase();
    out[currency] = (out[currency] ?? 0) + monthlyEquivalentCents(s.price_cents ?? 0, s.billing_period_days);
  }
  return out;
}

export function ratePercent(part: number, whole: number, digits = 1): number {
  if (!whole || whole <= 0) return 0;
  const f = 10 ** digits;
  return Math.round((part / whole) * 100 * f) / f;
}

export type RangeKey = "7d" | "30d" | "90d" | "12m" | "custom";
export type Bucket = "day" | "week" | "month";

export interface DateRange {
  key: RangeKey;
  from: Date;
  to: Date;
  bucket: Bucket;
  label: string;
}

const PRESETS: Record<Exclude<RangeKey, "custom">, { days: number; bucket: Bucket; label: string }> = {
  "7d": { days: 7, bucket: "day", label: "Last 7 days" },
  "30d": { days: 30, bucket: "day", label: "Last 30 days" },
  "90d": { days: 90, bucket: "week", label: "Last 90 days" },
  "12m": { days: 365, bucket: "month", label: "Last 12 months" },
};

function parseDay(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Resolve ?range= / ?from=&to= search params into a concrete window (UTC). */
export function resolveDateRange(params: { range?: string; from?: string; to?: string }, now: Date = new Date()): DateRange {
  const from = parseDay(params.from);
  const to = parseDay(params.to);
  if (params.range === "custom" && from && to && to >= from) {
    const end = new Date(to.getTime() + DAY_MS - 1);
    const span = (end.getTime() - from.getTime()) / DAY_MS;
    const bucket: Bucket = span > 120 ? "month" : span > 45 ? "week" : "day";
    return {
      key: "custom",
      from,
      to: end,
      bucket,
      label: `${from.toISOString().slice(0, 10)} – ${to.toISOString().slice(0, 10)}`,
    };
  }
  const key = (params.range && params.range in PRESETS ? params.range : "30d") as Exclude<RangeKey, "custom">;
  const preset = PRESETS[key];
  const endOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + DAY_MS - 1);
  const start = new Date(endOfToday.getTime() + 1 - preset.days * DAY_MS);
  return { key, from: start, to: endOfToday, bucket: preset.bucket, label: preset.label };
}

/** The window of equal length immediately before `range` (for deltas). */
export function previousRange(range: DateRange): { from: Date; to: Date } {
  const span = range.to.getTime() - range.from.getTime() + 1;
  return { from: new Date(range.from.getTime() - span), to: new Date(range.from.getTime() - 1) };
}

/** Signed change in percent; null when there is no baseline to compare. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Compact axis/tile number: 1,284 · 12.9K · 4.2M */
export function compactNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs < 10_000) return new Intl.NumberFormat("en-US").format(Math.round(n));
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/** Expiry for a manual access grant: N days, "lifetime" (null) or "custom" (end of a given UTC day). */
export function accessExpiryFromDuration(duration: string, customUntil: string | null | undefined, now: Date = new Date()): Date | null {
  if (duration === "lifetime") return null;
  if (duration === "custom") {
    if (!customUntil || !/^\d{4}-\d{2}-\d{2}$/.test(customUntil)) throw new Error("Choose an end date");
    const end = new Date(`${customUntil}T23:59:59.000Z`);
    if (end.getTime() <= now.getTime()) throw new Error("The end date must be in the future");
    return end;
  }
  const days = Number(duration);
  if (!Number.isInteger(days) || days <= 0 || days > 3650) throw new Error("Choose a duration");
  return new Date(now.getTime() + days * 86_400_000);
}

/** ISO timestamp for N days ago (used by list "time" filters on the server). */
export function daysAgoIso(days: number, now: Date = new Date()): string {
  return new Date(now.getTime() - days * DAY_MS).toISOString();
}
