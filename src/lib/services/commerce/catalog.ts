import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { SETTINGS_TAG } from "@/lib/settings";
import { planAvailability } from "@/lib/domain/pricing";
import { durationKeyFromDays, durationLabel, sortDurations, resolveDuration, type DurationKey } from "@/lib/domain/commerce";
import type { SelectorCatalog, SelectorCourse, SelectorPrice } from "@/lib/domain/commerce-view";
import { getCourseCardsByIds } from "@/lib/services/public/catalog";
import { PUBLIC_TAGS } from "@/lib/services/public/tags";
import { getSelectorSettings } from "./settings";

/**
 * The course selector's catalog: published public courses whose course
 * product offers a selector price (pricing_plans.in_course_selector) for an
 * access period the admin enabled. Read with the anonymous client and cached;
 * the cart and checkout always re-read prices with fresh, uncached queries.
 */

interface PlanLite {
  id: string;
  plan_type: "free" | "one_time" | "recurring";
  currency: string;
  price_cents: number;
  compare_at_price_cents: number | null;
  access_duration_days: number | null;
  visibility: "public" | "hidden" | "archived";
  in_course_selector: boolean;
  available_from: string | null;
  available_until: string | null;
  stock_limit: number | null;
  units_sold: number;
  promo_label: string | null;
}

export const SELECTOR_PLAN_COLUMNS =
  "id, plan_type, currency, price_cents, compare_at_price_cents, access_duration_days, visibility, in_course_selector, available_from, available_until, stock_limit, units_sold, promo_label";

/** Selector prices for one course product, keyed by access period. Pure; shared with the cart. */
export function selectorPrices(plans: PlanLite[], opts: { currency: string; durations: DurationKey[]; now: Date }): Record<DurationKey, SelectorPrice & { planId: string }> {
  const out: Record<DurationKey, SelectorPrice> = {};
  for (const plan of plans) {
    if (!plan.in_course_selector || plan.plan_type !== "one_time" || plan.visibility !== "public") continue;
    if (plan.currency.toLowerCase() !== opts.currency) continue;
    if (!planAvailability(plan, opts.now).available) continue;
    const key = durationKeyFromDays(plan.access_duration_days);
    if (!opts.durations.includes(key) || out[key]) continue;
    out[key] = { planId: plan.id, priceMinor: plan.price_cents, compareAtMinor: plan.compare_at_price_cents, promoLabel: plan.promo_label };
  }
  return out;
}

export async function getSelectorCatalog(): Promise<SelectorCatalog> {
  "use cache";
  cacheTag(PUBLIC_TAGS.courses, PUBLIC_TAGS.pricing, PUBLIC_TAGS.categories, SETTINGS_TAG);
  cacheLife("minutes");

  const settings = await getSelectorSettings();
  const now = new Date();
  const supabase = createPublicClient();

  const { data: courseRows, error: courseError } = await supabase
    .from("courses")
    .select("id")
    .eq("status", "published")
    .eq("visibility", "public")
    .eq("is_free", false)
    .order("is_featured", { ascending: false })
    .order("sort_order")
    .order("published_at", { ascending: false });
  if (courseError) throw new Error(`[selector] courses: ${courseError.message}`);
  const publishedIds = (courseRows ?? []).map((c) => c.id);

  const priceByCourse = new Map<string, Record<DurationKey, SelectorPrice>>();
  if (publishedIds.length) {
    const { data: products, error } = await supabase
      .from("products")
      .select(`id, course_id, pricing_plans(${SELECTOR_PLAN_COLUMNS})`)
      .eq("kind", "course")
      .eq("status", "active")
      .in("course_id", publishedIds);
    if (error) throw new Error(`[selector] products: ${error.message}`);
    for (const p of products ?? []) {
      if (!p.course_id) continue;
      const prices = selectorPrices((p.pricing_plans ?? []) as PlanLite[], { currency: settings.currency, durations: settings.durations, now });
      if (Object.keys(prices).length) priceByCourse.set(p.course_id, prices);
    }
  }

  const sellable = publishedIds.filter((id) => priceByCourse.has(id));
  const cards = await getCourseCardsByIds(sellable);
  const courses: SelectorCourse[] = cards.map((c) => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    shortDescription: c.short_description,
    thumbnailUrl: c.thumbnail_url,
    level: c.level,
    isFeatured: c.is_featured,
    category: c.category,
    instructors: c.instructors.map((i) => i.public_name),
    lessonCount: c.lessonCount,
    durationMinutes: c.durationMinutes,
    prices: priceByCourse.get(c.id) ?? {},
  }));

  const counts = new Map<DurationKey, number>();
  for (const c of courses) for (const key of Object.keys(c.prices)) counts.set(key, (counts.get(key) ?? 0) + 1);
  const durations = sortDurations([...counts.keys()]).map((key) => ({ key, label: durationLabel(key), courseCount: counts.get(key) ?? 0 }));

  const categories = new Map<string, string>();
  for (const c of courses) if (c.category) categories.set(c.category.slug, c.category.name);

  return {
    enabled: settings.enabled,
    currency: settings.currency,
    courses,
    durations,
    defaultDuration: resolveDuration(null, durations.map((d) => d.key), settings),
    maxCourses: settings.max_courses > 0 ? settings.max_courses : null,
    categories: [...categories].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** Is this course offered in the selector (for "Add to learning plan" on course pages)? */
export async function selectorOfferForCourse(courseId: string): Promise<{ offered: boolean; prices: Record<DurationKey, SelectorPrice>; defaultDuration: DurationKey | null; currency: string }> {
  const catalog = await getSelectorCatalog();
  const course = catalog.courses.find((c) => c.id === courseId);
  return { offered: Boolean(catalog.enabled && course), prices: course?.prices ?? {}, defaultDuration: catalog.defaultDuration, currency: catalog.currency };
}
