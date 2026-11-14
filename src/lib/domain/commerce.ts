import { z } from "zod";
import { formatDate } from "@/lib/format";
import { formatMinor, isSupportedCurrency, majorStringToMinor, minorToMajorString } from "./invoicing";

/**
 * Public course packages (course selector, guest checkout, advisor cart).
 * Pure rules shared by the server services, route handlers and the UI, and
 * covered by unit tests. Money is always an integer number of minor units;
 * the server recomputes every amount from the database before charging.
 */

// ---------------------------------------------------------------------------
// Access periods
// ---------------------------------------------------------------------------

/** "30", "90", "365"… or "lifetime". */
export type DurationKey = string;

export const DURATION_PRESETS: DurationKey[] = ["30", "60", "90", "180", "365", "lifetime"];

export const durationKeySchema = z
  .string()
  .trim()
  .regex(/^([1-9][0-9]{0,3}|lifetime)$/, "Choose an access period");

export function durationDays(key: DurationKey): number | null {
  return key === "lifetime" ? null : Number(key);
}

export function durationKeyFromDays(days: number | null | undefined): DurationKey {
  return days === null || days === undefined ? "lifetime" : String(days);
}

export function durationLabel(key: DurationKey): string {
  if (key === "lifetime") return "Lifetime";
  const days = Number(key);
  if (days === 365) return "1 year";
  if (days % 30 === 0 && days <= 330) return `${days} days`;
  return `${days} days`;
}

/** "30 days of access" / "Lifetime access". */
export function durationAccessLabel(key: DurationKey): string {
  return key === "lifetime" ? "Lifetime access" : `${durationLabel(key)} of access`;
}

// ---------------------------------------------------------------------------
// Selector settings
// ---------------------------------------------------------------------------

export const selectorSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  durations: z.array(durationKeySchema).min(1).max(12).default(DURATION_PRESETS),
  default_duration: durationKeySchema.default("30"),
  currency: z.string().regex(/^[a-z]{3}$/).default("usd"),
  /** 0 = no limit. */
  max_courses: z.number().int().min(0).max(100).default(0),
});
export type SelectorSettings = z.infer<typeof selectorSettingsSchema>;

export function parseSelectorSettings(value: unknown): SelectorSettings {
  const parsed = selectorSettingsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : selectorSettingsSchema.parse({});
}

/**
 * The period a cart uses: the visitor's choice when it is offered, else the
 * configured default when courses are sold for it, else the first offered
 * period that has courses.
 */
export function resolveDuration(requested: DurationKey | null | undefined, offered: DurationKey[], settings: Pick<SelectorSettings, "default_duration">): DurationKey | null {
  if (requested && offered.includes(requested)) return requested;
  if (offered.includes(settings.default_duration)) return settings.default_duration;
  return offered[0] ?? null;
}

/** Sort access periods the way people read them: 30, 60, 90 … lifetime. */
export function sortDurations(keys: DurationKey[]): DurationKey[] {
  return [...new Set(keys)].sort((a, b) => (durationDays(a) ?? Number.MAX_SAFE_INTEGER) - (durationDays(b) ?? Number.MAX_SAFE_INTEGER));
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

export const learnerEmailSchema = z
  .string()
  .trim()
  .min(3, "Enter the student's email address")
  .max(254, "That email address is too long")
  .email("Enter a valid email address, like name@example.com")
  .transform((v) => v.toLowerCase());

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** "st••••@example.com" — enough for the learner to recognise, not enough to harvest. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "••••";
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(2, Math.min(6, local.length - visible.length)))}@${domain}`;
}

// ---------------------------------------------------------------------------
// Basket and coupons
// ---------------------------------------------------------------------------

export interface BasketLine {
  courseId: string;
  planId: string;
  productId: string;
  title: string;
  priceMinor: number;
}

export interface CouponRule {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  /** numeric(10,2): percent (0–100) or major units for fixed amounts. */
  amount: number | string;
  currency: string | null;
  status: "active" | "disabled" | "archived";
  applies_to: "all" | "plans" | "packages";
  starts_at: string | null;
  expires_at: string | null;
  max_redemptions: number | null;
  redemptions_count: number;
  plan_ids: string[];
  course_ids: string[];
  min_subtotal_cents: number | null;
  max_redemptions_per_customer: number | null;
  new_customers_only: boolean;
}

export type CouponRejection =
  | "not_found"
  | "inactive"
  | "not_started"
  | "expired"
  | "exhausted"
  | "plans_only"
  | "currency"
  | "not_eligible"
  | "min_subtotal"
  | "customer_limit"
  | "new_customers_only"
  | "empty_cart";

export interface CouponContext {
  lines: BasketLine[];
  currency: string;
  now: Date;
  /** Paid orders this learner email already made with the coupon (null = email not known yet). */
  customerRedemptions?: number | null;
  /** The learner email already has paid purchases (null = not known yet). */
  returningCustomer?: boolean | null;
}

export type CouponEvaluation =
  | { ok: true; discountMinor: number; allocations: Record<string, number>; eligibleCourseIds: string[]; label: string }
  | { ok: false; reason: CouponRejection; message: string };

export const couponCodeSchema = z
  .string()
  .trim()
  .min(3, "Enter a discount code")
  .max(40, "That code is too long")
  .regex(/^[A-Za-z0-9_-]+$/, "Codes use letters, numbers, dashes and underscores");

export function couponLabel(rule: Pick<CouponRule, "discount_type" | "amount" | "currency">): string {
  if (rule.discount_type === "percent") return `${Number(rule.amount)}% off`;
  const currency = (rule.currency ?? "usd").toLowerCase();
  const minor = isSupportedCurrency(currency) ? majorStringToMinor(String(rule.amount), currency) : Math.round(Number(rule.amount) * 100);
  return `${formatMinor(minor ?? 0, currency)} off`;
}

function reject(reason: CouponRejection, message: string): CouponEvaluation {
  return { ok: false, reason, message };
}

/**
 * Split a discount across lines in proportion to their price, exactly
 * (largest remainder), so the per-course snapshot always sums to the total.
 */
export function allocateDiscount(lines: { courseId: string; priceMinor: number }[], discountMinor: number): Record<string, number> {
  const out: Record<string, number> = {};
  const total = lines.reduce((s, l) => s + l.priceMinor, 0);
  if (total <= 0 || discountMinor <= 0) {
    for (const l of lines) out[l.courseId] = 0;
    return out;
  }
  const shares = lines.map((l) => {
    const exact = (l.priceMinor * discountMinor) / total;
    return { id: l.courseId, base: Math.floor(exact), rest: exact - Math.floor(exact) };
  });
  let left = discountMinor - shares.reduce((s, x) => s + x.base, 0);
  for (const s of [...shares].sort((a, b) => b.rest - a.rest)) {
    if (left <= 0) break;
    s.base += 1;
    left -= 1;
  }
  for (const s of shares) out[s.id] = s.base;
  return out;
}

/**
 * Is this coupon valid for this basket, and for how much? Server-side only
 * as the authority; the same function renders the UI preview.
 */
export function evaluateCoupon(rule: CouponRule | null, ctx: CouponContext): CouponEvaluation {
  if (!rule) return reject("not_found", "That code isn't valid. Check the spelling and try again.");
  if (ctx.lines.length === 0) return reject("empty_cart", "Add a course before applying a code.");
  if (rule.status !== "active") return reject("inactive", "This code is no longer active.");
  if (rule.applies_to === "plans") return reject("plans_only", "This code can't be used for course packages.");
  if (rule.starts_at && new Date(rule.starts_at) > ctx.now) return reject("not_started", "This code isn't active yet.");
  if (rule.expires_at && new Date(rule.expires_at) <= ctx.now) return reject("expired", "This code has expired.");
  if (rule.max_redemptions !== null && rule.redemptions_count >= rule.max_redemptions) {
    return reject("exhausted", "This code has reached its usage limit.");
  }
  const currency = ctx.currency.toLowerCase();
  if (rule.currency && rule.currency.toLowerCase() !== currency) {
    return reject("currency", `This code only works for payments in ${rule.currency.toUpperCase()}.`);
  }
  const subtotal = ctx.lines.reduce((s, l) => s + l.priceMinor, 0);
  if (rule.min_subtotal_cents !== null && subtotal < rule.min_subtotal_cents) {
    return reject("min_subtotal", `Spend at least ${formatMinor(rule.min_subtotal_cents, currency)} to use this code.`);
  }
  const eligible = ctx.lines.filter(
    (l) => (rule.course_ids.length === 0 || rule.course_ids.includes(l.courseId)) && (rule.plan_ids.length === 0 || rule.plan_ids.includes(l.planId)),
  );
  if (eligible.length === 0) return reject("not_eligible", "This code doesn't apply to the courses in your package.");
  if (rule.max_redemptions_per_customer !== null && (ctx.customerRedemptions ?? 0) >= rule.max_redemptions_per_customer) {
    return reject("customer_limit", "This code has already been used with this email address.");
  }
  if (rule.new_customers_only && ctx.returningCustomer === true) {
    return reject("new_customers_only", "This code is for first-time students only.");
  }

  const eligibleSubtotal = eligible.reduce((s, l) => s + l.priceMinor, 0);
  let discount: number;
  if (rule.discount_type === "percent") {
    // Exact: percent has two decimals, so work in basis points.
    const basisPoints = Math.round(Number(rule.amount) * 100);
    if (!Number.isFinite(basisPoints) || basisPoints <= 0) return reject("inactive", "This code is no longer active.");
    discount = Math.floor((eligibleSubtotal * Math.min(basisPoints, 10_000)) / 10_000);
  } else {
    const fixed = majorStringToMinor(String(rule.amount), isSupportedCurrency(currency) ? currency : "usd");
    if (fixed === null || fixed <= 0) return reject("inactive", "This code is no longer active.");
    discount = fixed;
  }
  // Never below zero, and never more than the courses it applies to.
  discount = Math.max(0, Math.min(discount, eligibleSubtotal));
  return {
    ok: true,
    discountMinor: discount,
    allocations: allocateDiscount(eligible, discount),
    eligibleCourseIds: eligible.map((l) => l.courseId),
    label: couponLabel(rule),
  };
}

/** Whop refuses card payments below 1.00 (100 minor units for 2-decimal currencies). */
export const MINIMUM_CHARGE_MINOR = 100;

export type TotalCheck = { ok: true; free: boolean } | { ok: false; message: string };

export function checkPayableTotal(totalMinor: number, currency: string): TotalCheck {
  if (totalMinor === 0) return { ok: true, free: true };
  if (totalMinor < MINIMUM_CHARGE_MINOR) {
    return { ok: false, message: `The total after discount must be 0 or at least ${formatMinor(MINIMUM_CHARGE_MINOR, currency)}.` };
  }
  return { ok: true, free: false };
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export type OrderStatus =
  | "draft"
  | "pending_payment"
  | "payment_processing"
  | "paid"
  | "fulfillment_pending"
  | "fulfilled"
  | "failed"
  | "expired"
  | "cancelled"
  | "refunded"
  | "partially_refunded"
  | "under_review";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  draft: "Draft",
  pending_payment: "Pending payment",
  payment_processing: "Payment processing",
  paid: "Paid",
  fulfillment_pending: "Fulfilment pending",
  fulfilled: "Fulfilled",
  failed: "Payment failed",
  expired: "Expired",
  cancelled: "Cancelled",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
  under_review: "Under review",
};

/** Statuses in which the order's Whop link may still be paid. */
export const PAYABLE_ORDER_STATUSES: OrderStatus[] = ["pending_payment", "payment_processing", "failed"];

export function isOrderPayable(order: { status: string; expires_at: string; whop_checkout_url: string | null }, now = new Date()): boolean {
  return PAYABLE_ORDER_STATUSES.includes(order.status as OrderStatus) && Boolean(order.whop_checkout_url) && new Date(order.expires_at) > now;
}

export function isOrderSettled(status: string): boolean {
  return ["paid", "fulfillment_pending", "fulfilled", "refunded", "partially_refunded"].includes(status);
}

/** Everything that defines what is being bought, in a stable order. */
export function orderFingerprintSource(input: { courseIds: string[]; duration: DurationKey; currency: string; couponCode: string | null; totalMinor: number; email: string }): string {
  return [
    [...input.courseIds].sort().join(","),
    input.duration,
    input.currency.toLowerCase(),
    (input.couponCode ?? "").toUpperCase(),
    String(input.totalMinor),
    normalizeEmail(input.email),
  ].join("|");
}

export interface OrderPaymentFacts {
  accountId: string | null;
  currency: string;
  subtotalMinor: number | null;
  totalMinor: number | null;
  taxMinor: number | null;
  promoCodeId: string | null;
}

export type OrderPaymentCheck = { ok: true } | { ok: false; reason: string };

/**
 * A succeeded Whop payment only fulfils an order when it is for our Whop
 * account, in the order's currency, for exactly the order's total before tax,
 * with no Whop-side promo code (discounts are applied by Foremint, so a
 * promo code would mean the buyer paid a different amount than we quoted).
 */
export function verifyOrderPayment(
  order: { currency: string; total_minor: number; status: string },
  payment: OrderPaymentFacts,
  expectedAccountId: string,
): OrderPaymentCheck {
  if (payment.accountId && payment.accountId !== expectedAccountId) {
    return { ok: false, reason: `Payment belongs to Whop account ${payment.accountId}, not ${expectedAccountId}.` };
  }
  if (payment.currency.toLowerCase() !== order.currency.toLowerCase()) {
    return { ok: false, reason: `Paid in ${payment.currency.toUpperCase()}, the order is in ${order.currency.toUpperCase()}.` };
  }
  if (payment.promoCodeId) {
    return { ok: false, reason: `A Whop promo code (${payment.promoCodeId}) was applied at checkout; the amount differs from the order total.` };
  }
  const preTax = payment.subtotalMinor ?? (payment.totalMinor !== null ? payment.totalMinor - (payment.taxMinor ?? 0) : null);
  if (preTax === null) return { ok: false, reason: "Whop did not report the paid amount." };
  if (preTax !== order.total_minor) {
    return {
      ok: false,
      reason: `Paid ${minorToMajorString(preTax, order.currency)} before tax, the order total is ${minorToMajorString(order.total_minor, order.currency)}.`,
    };
  }
  if (["cancelled", "expired"].includes(order.status)) {
    return { ok: false, reason: `The order was already ${order.status} when the payment arrived.` };
  }
  return { ok: true };
}

/** Access window for one purchased course, counted from the verified payment time (UTC). */
export function orderAccessWindow(durationDaysValue: number | null, paidAt: Date): { startsAt: Date; expiresAt: Date | null } {
  if (durationDaysValue === null) return { startsAt: paidAt, expiresAt: null };
  return { startsAt: paidAt, expiresAt: new Date(paidAt.getTime() + durationDaysValue * 86_400_000) };
}

export function orderAccessSummary(durationDaysValue: number | null, paidAt: Date | null): string {
  if (durationDaysValue === null) return "Lifetime access to each course.";
  if (!paidAt) return `${durationDaysValue} days of access to each course, starting when the payment is confirmed.`;
  const { expiresAt } = orderAccessWindow(durationDaysValue, paidAt);
  return `${durationDaysValue} days of access to each course, until ${formatDate(expiresAt)}.`;
}

export function courseTitlesText(titles: string[], max = 10): string {
  const shown = titles.slice(0, max);
  const rest = titles.length - shown.length;
  return shown.join(", ") + (rest > 0 ? ` and ${rest} more` : "");
}
