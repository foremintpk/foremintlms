import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  checkPayableTotal,
  durationAccessLabel,
  durationLabel,
  evaluateCoupon,
  normalizeEmail,
  resolveDuration,
  type BasketLine,
  type CouponEvaluation,
  type CouponRule,
  type DurationKey,
  type SelectorSettings,
} from "@/lib/domain/commerce";
import { getSelectorCatalog, SELECTOR_PLAN_COLUMNS, selectorPrices } from "./catalog";
import { getSelectorSettings } from "./settings";

/**
 * The authoritative price of a basket. Reads courses, selector prices and the
 * coupon fresh from the database (never from a cache or the browser) and
 * returns exactly what an order would charge. Used by every cart response,
 * by checkout right before the order is created, and by the advisor.
 */

export interface QuoteLine extends BasketLine {
  slug: string;
  category: string | null;
  thumbnailUrl: string | null;
  compareAtMinor: number | null;
  discountMinor: number;
}

export interface Quote {
  settings: SelectorSettings;
  currency: string;
  duration: DurationKey | null;
  durations: { key: DurationKey; label: string; coveredCount: number }[];
  lines: QuoteLine[];
  unavailable: { courseId: string; title: string | null; message: string }[];
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  couponCode: string | null;
  coupon: { rule: CouponRule | null; evaluation: CouponEvaluation } | null;
  maxCourses: number | null;
  blockers: string[];
  free: boolean;
}

export interface QuoteInput {
  courseIds: string[];
  duration: DurationKey | null;
  couponCode: string | null;
  /** The learner email, when known: enables per-customer coupon rules. */
  email?: string | null;
  now?: Date;
}

const COUPON_COLUMNS =
  "id, code, discount_type, amount, currency, status, applies_to, starts_at, expires_at, max_redemptions, redemptions_count, plan_ids, course_ids, min_subtotal_cents, max_redemptions_per_customer, new_customers_only";

export async function loadCouponByCode(code: string): Promise<CouponRule | null> {
  const { data } = await createAdminClient().from("coupons").select(COUPON_COLUMNS).eq("code", code.trim()).maybeSingle();
  if (!data) return null;
  return { ...data, amount: Number(data.amount) } as CouponRule;
}

/** Paid orders this email already placed with a coupon, and whether it has bought before at all. */
async function customerContext(couponId: string, email: string): Promise<{ redemptions: number; returning: boolean }> {
  const admin = createAdminClient();
  const normalized = normalizeEmail(email);
  const [{ count: used }, { count: paidOrders }, { data: profile }] = await Promise.all([
    admin.from("public_course_orders").select("id", { count: "exact", head: true }).eq("coupon_id", couponId).eq("learner_email", normalized).not("paid_at", "is", null),
    admin.from("public_course_orders").select("id", { count: "exact", head: true }).eq("learner_email", normalized).not("paid_at", "is", null),
    admin.from("profile_private").select("user_id").eq("email", normalized).maybeSingle(),
  ]);
  let returning = (paidOrders ?? 0) > 0;
  if (!returning && profile?.user_id) {
    const { count } = await admin.from("payment_transactions").select("id", { count: "exact", head: true }).eq("user_id", profile.user_id).eq("status", "succeeded");
    returning = (count ?? 0) > 0;
  }
  return { redemptions: used ?? 0, returning };
}

export async function quoteBasket(input: QuoteInput): Promise<Quote> {
  const now = input.now ?? new Date();
  const settings = await getSelectorSettings();
  const currency = settings.currency;
  const ids = [...new Set(input.courseIds)].slice(0, 100);
  const admin = createAdminClient();

  const [coursesRes, productsRes, catalog] = await Promise.all([
    ids.length
      ? admin.from("courses").select("id, slug, title, status, visibility, is_free, thumbnail_url, course_categories(name, image_url)").in("id", ids)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? admin.from("products").select(`id, course_id, status, pricing_plans(${SELECTOR_PLAN_COLUMNS})`).eq("kind", "course").in("course_id", ids)
      : Promise.resolve({ data: [], error: null }),
    getSelectorCatalog(),
  ]);
  if (coursesRes.error) throw new Error(`quote courses: ${coursesRes.error.message}`);
  if (productsRes.error) throw new Error(`quote products: ${productsRes.error.message}`);

  type CourseRow = { id: string; slug: string; title: string; status: string; visibility: string; is_free: boolean; thumbnail_url: string | null; course_categories: { name: string; image_url: string | null } | null };
  const courses = new Map(((coursesRes.data ?? []) as unknown as CourseRow[]).map((c) => [c.id, c]));
  const offers = new Map<string, { productId: string; prices: ReturnType<typeof selectorPrices> }>();
  for (const p of (productsRes.data ?? []) as unknown as { id: string; course_id: string | null; status: string; pricing_plans: Parameters<typeof selectorPrices>[0] }[]) {
    if (!p.course_id || p.status !== "active") continue;
    offers.set(p.course_id, { productId: p.id, prices: selectorPrices(p.pricing_plans ?? [], { currency, durations: settings.durations, now }) });
  }

  const offeredKeys = catalog.durations.map((d) => d.key);
  const duration = resolveDuration(input.duration, offeredKeys, settings);
  const durations = catalog.durations.map((d) => ({
    key: d.key,
    label: d.label,
    coveredCount: ids.filter((id) => offers.get(id)?.prices[d.key]).length,
  }));

  const lines: QuoteLine[] = [];
  const unavailable: Quote["unavailable"] = [];
  for (const id of ids) {
    const course = courses.get(id);
    const sellable = course && course.status === "published" && course.visibility === "public" && !course.is_free;
    const offer = offers.get(id);
    const price = duration && offer ? offer.prices[duration] : undefined;
    if (!sellable || !offer) {
      unavailable.push({ courseId: id, title: course?.title ?? null, message: `${course?.title ?? "A course"} is no longer available to buy.` });
    } else if (!price) {
      unavailable.push({
        courseId: id,
        title: course.title,
        message: duration ? `${course.title} isn't offered with ${durationAccessLabel(duration).toLowerCase()}.` : `${course.title} has no price yet.`,
      });
    } else {
      lines.push({
        courseId: id,
        planId: price.planId,
        productId: offer.productId,
        title: course.title,
        slug: course.slug,
        category: course.course_categories?.name ?? null,
        thumbnailUrl: course.thumbnail_url ?? course.course_categories?.image_url ?? null,
        priceMinor: price.priceMinor,
        compareAtMinor: price.compareAtMinor,
        discountMinor: 0,
      });
    }
  }

  const subtotal = lines.reduce((s, l) => s + l.priceMinor, 0);
  let discount = 0;
  let coupon: Quote["coupon"] = null;
  const couponCode = input.couponCode?.trim() ? input.couponCode.trim().toUpperCase() : null;
  if (couponCode) {
    const rule = await loadCouponByCode(couponCode);
    const ctx = rule && input.email && (rule.max_redemptions_per_customer !== null || rule.new_customers_only) ? await customerContext(rule.id, input.email) : null;
    const evaluation = evaluateCoupon(rule, {
      lines,
      currency,
      now,
      customerRedemptions: ctx?.redemptions ?? null,
      returningCustomer: ctx?.returning ?? null,
    });
    coupon = { rule, evaluation };
    if (evaluation.ok) {
      discount = evaluation.discountMinor;
      for (const line of lines) line.discountMinor = evaluation.allocations[line.courseId] ?? 0;
    }
  }
  const total = subtotal - discount;

  const maxCourses = settings.max_courses > 0 ? settings.max_courses : null;
  const blockers: string[] = [];
  if (!settings.enabled) blockers.push("Course packages aren't available to buy right now.");
  if (lines.length === 0) blockers.push("Add at least one course to your learning package.");
  if (unavailable.length) blockers.push(unavailable.length === 1 ? `${unavailable[0].message} Remove it or choose another access period.` : "Some courses aren't available for this access period. Remove them or choose another period.");
  if (maxCourses && ids.length > maxCourses) blockers.push(`You can choose up to ${maxCourses} courses per order.`);
  if (coupon && !coupon.evaluation.ok) blockers.push(`${coupon.evaluation.message} Remove the code to continue without it.`);
  const totalCheck = checkPayableTotal(total, currency);
  if (!totalCheck.ok && lines.length) blockers.push(totalCheck.message);

  return {
    settings,
    currency,
    duration,
    durations,
    lines,
    unavailable,
    subtotalMinor: subtotal,
    discountMinor: discount,
    totalMinor: total,
    couponCode,
    coupon,
    maxCourses,
    blockers,
    free: totalCheck.ok && totalCheck.free && lines.length > 0,
  };
}

export function quoteDurationLabel(q: Pick<Quote, "duration">): string | null {
  return q.duration ? durationLabel(q.duration) : null;
}
