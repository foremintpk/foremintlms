import { z } from "zod";
import { accessDurationLabel, billingPeriodLabel, formatMoney } from "@/lib/format";

/** Pricing plan validation shared by the admin form and the server action. */
export const pricingPlanSchema = z
  .object({
    name: z.string().trim().min(1, "Give the plan a name").max(120),
    description: z.string().trim().max(500).optional().nullable(),
    plan_type: z.enum(["free", "one_time", "recurring"]),
    currency: z.string().regex(/^[a-z]{3}$/, "Use a 3-letter currency code").default("usd"),
    price_cents: z.number().int().min(0),
    compare_at_price_cents: z.number().int().min(0).nullable().optional(),
    access_duration_days: z.number().int().positive().max(3650).nullable().optional(),
    billing_period_days: z.number().int().positive().max(730).nullable().optional(),
    trial_days: z.number().int().min(0).max(365).nullable().optional(),
    grace_period_days: z.number().int().min(0).max(60).default(3),
    stock_limit: z.number().int().min(0).nullable().optional(),
    available_from: z.string().datetime({ offset: true }).nullable().optional(),
    available_until: z.string().datetime({ offset: true }).nullable().optional(),
    promo_label: z.string().trim().max(60).nullable().optional(),
    visibility: z.enum(["public", "hidden", "archived"]).default("public"),
    is_featured: z.boolean().default(false),
  })
  .superRefine((p, ctx) => {
    if (p.plan_type === "free" && p.price_cents !== 0) {
      ctx.addIssue({ code: "custom", path: ["price_cents"], message: "Free plans cost 0" });
    }
    if (p.plan_type !== "free" && p.price_cents < 50) {
      ctx.addIssue({ code: "custom", path: ["price_cents"], message: "Paid plans must cost at least 0.50" });
    }
    if (p.plan_type === "recurring" && !p.billing_period_days) {
      ctx.addIssue({ code: "custom", path: ["billing_period_days"], message: "Choose a billing interval" });
    }
    if (p.plan_type !== "recurring" && p.trial_days) {
      ctx.addIssue({ code: "custom", path: ["trial_days"], message: "Trials are only available on subscriptions" });
    }
    if (p.plan_type === "recurring" && p.access_duration_days) {
      ctx.addIssue({ code: "custom", path: ["access_duration_days"], message: "Subscriptions grant access while active" });
    }
    if (p.compare_at_price_cents != null && p.compare_at_price_cents <= p.price_cents) {
      ctx.addIssue({ code: "custom", path: ["compare_at_price_cents"], message: "The original price must be higher than the price" });
    }
    if (p.available_from && p.available_until && new Date(p.available_until) <= new Date(p.available_from)) {
      ctx.addIssue({ code: "custom", path: ["available_until"], message: "The end date must be after the start date" });
    }
  });

export type PricingPlanInput = z.infer<typeof pricingPlanSchema>;

export interface PlanLike {
  plan_type: "free" | "one_time" | "recurring";
  price_cents: number;
  currency: string;
  compare_at_price_cents?: number | null;
  access_duration_days?: number | null;
  billing_period_days?: number | null;
  trial_days?: number | null;
  stock_limit?: number | null;
  units_sold?: number;
  available_from?: string | null;
  available_until?: string | null;
  visibility?: "public" | "hidden" | "archived";
}

export type Unavailable = "archived" | "not_started" | "ended" | "sold_out" | null;

export function planAvailability(plan: PlanLike, now: Date = new Date()): { available: boolean; reason: Unavailable } {
  if (plan.visibility === "archived") return { available: false, reason: "archived" };
  if (plan.available_from && new Date(plan.available_from) > now) return { available: false, reason: "not_started" };
  if (plan.available_until && new Date(plan.available_until) <= now) return { available: false, reason: "ended" };
  if (plan.stock_limit != null && (plan.units_sold ?? 0) >= plan.stock_limit) return { available: false, reason: "sold_out" };
  return { available: true, reason: null };
}

export function planPriceLabel(plan: PlanLike): string {
  if (plan.plan_type === "free") return "Free";
  const price = formatMoney(plan.price_cents, plan.currency, { compact: true });
  if (plan.plan_type === "recurring") return `${price} / ${billingPeriodLabel(plan.billing_period_days)}`;
  return price;
}

export function planAccessLabel(plan: PlanLike): string {
  if (plan.plan_type === "recurring") {
    const trial = plan.trial_days ? ` · ${plan.trial_days}-day free trial` : "";
    return `Access while subscribed${trial}`;
  }
  return accessDurationLabel(plan.access_duration_days);
}

export function remainingStock(plan: PlanLike): number | null {
  if (plan.stock_limit == null) return null;
  return Math.max(0, plan.stock_limit - (plan.units_sold ?? 0));
}

/** Display-only estimate; Whop applies the authoritative discount at checkout. */
export function applyCouponEstimate(
  priceCents: number,
  coupon: { discount_type: "percent" | "fixed"; amount: number },
): number {
  if (coupon.discount_type === "percent") return Math.max(0, Math.round(priceCents * (1 - coupon.amount / 100)));
  return Math.max(0, priceCents - Math.round(coupon.amount * 100));
}
