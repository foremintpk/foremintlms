/**
 * Pure shaping helpers for public data (unit tested). No I/O here.
 */
import { planAccessLabel, planAvailability, planPriceLabel, remainingStock } from "@/lib/domain/pricing";
import type { CourseLevel, OutlineModule, PublicPlan } from "./types";

export interface RawPlan {
  id: string;
  product_id: string;
  name: string;
  description: string | null;
  plan_type: "free" | "one_time" | "recurring";
  currency: string;
  price_cents: number;
  compare_at_price_cents: number | null;
  access_duration_days: number | null;
  billing_period_days: number | null;
  trial_days: number | null;
  stock_limit: number | null;
  units_sold: number;
  available_from: string | null;
  available_until: string | null;
  promo_label: string | null;
  visibility: "public" | "hidden" | "archived";
  is_featured: boolean;
  sort_order: number;
}

export const PLAN_COLUMNS =
  "id, product_id, name, description, plan_type, currency, price_cents, compare_at_price_cents, access_duration_days, billing_period_days, trial_days, stock_limit, units_sold, available_from, available_until, promo_label, visibility, is_featured, sort_order";

export function toPublicPlan(plan: RawPlan, now: Date): PublicPlan {
  const availability = planAvailability(plan, now);
  return {
    ...plan,
    units_sold: plan.units_sold ?? 0,
    available: availability.available,
    unavailableReason: availability.reason,
    priceLabel: planPriceLabel(plan),
    accessLabel: planAccessLabel(plan),
    remaining: remainingStock(plan),
  };
}

export function sortPlans<T extends { sort_order: number; price_cents: number }>(plans: T[]): T[] {
  return [...plans].sort((a, b) => a.sort_order - b.sort_order || a.price_cents - b.price_cents);
}

/**
 * Summarise a course's price for cards: "Free", a single plan's label, or
 * "From …" when several plans exist. Only currently purchasable plans count.
 */
export function summarizeCoursePrice(
  isFree: boolean,
  plans: PublicPlan[],
): { priceLabel: string | null; accessLabel: string | null } {
  const available = plans.filter((p) => p.available);
  if (isFree || available.some((p) => p.plan_type === "free")) {
    const freePlan = available.find((p) => p.plan_type === "free");
    return { priceLabel: "Free", accessLabel: freePlan ? freePlan.accessLabel : "Free access" };
  }
  if (available.length === 0) return { priceLabel: null, accessLabel: null };
  const cheapest = [...available].sort((a, b) => a.price_cents - b.price_cents)[0];
  return {
    priceLabel: available.length > 1 ? `From ${cheapest.priceLabel}` : cheapest.priceLabel,
    accessLabel: cheapest.accessLabel,
  };
}

export function averageRating(ratings: number[]): { average: number; count: number } | null {
  const valid = ratings.filter((r) => Number.isFinite(r) && r >= 1 && r <= 5);
  if (valid.length === 0) return null;
  const avg = valid.reduce((s, r) => s + r, 0) / valid.length;
  return { average: Math.round(avg * 10) / 10, count: valid.length };
}

export interface RawModule {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
}

export interface RawLesson {
  id: string;
  module_id: string;
  title: string;
  lesson_type: string;
  sort_order: number;
  duration_minutes: number | null;
  is_preview: boolean;
}

/** Group lessons under their modules in curriculum order; drop empty modules. */
export function buildOutline(modules: RawModule[], lessons: RawLesson[]): OutlineModule[] {
  const byModule = new Map<string, RawLesson[]>();
  for (const l of lessons) {
    const list = byModule.get(l.module_id) ?? [];
    list.push(l);
    byModule.set(l.module_id, list);
  }
  return [...modules]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      lessons: (byModule.get(m.id) ?? [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((l) => ({
          id: l.id,
          title: l.title,
          lesson_type: l.lesson_type,
          duration_minutes: l.duration_minutes,
          is_preview: l.is_preview,
        })),
    }))
    .filter((m) => m.lessons.length > 0);
}

export const LEVEL_LABEL: Record<CourseLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  all_levels: "All levels",
};

export type CatalogSort = "featured" | "newest" | "title";
export type CatalogPrice = "free" | "paid";

export interface CatalogQuery {
  q: string;
  category: string | null;
  level: CourseLevel | null;
  price: CatalogPrice | null;
  sort: CatalogSort;
  page: number;
}

type Raw = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Parse and whitelist catalog search params. */
export function parseCatalogQuery(raw: Raw): CatalogQuery {
  const levels: CourseLevel[] = ["beginner", "intermediate", "advanced", "all_levels"];
  const level = first(raw.level);
  const price = first(raw.price);
  const sort = first(raw.sort);
  const category = first(raw.category);
  return {
    q: (first(raw.q) ?? "").trim().slice(0, 100),
    category: category && /^[a-z0-9-]{1,120}$/.test(category) ? category : null,
    level: level && (levels as string[]).includes(level) ? (level as CourseLevel) : null,
    price: price === "free" || price === "paid" ? price : null,
    sort: sort === "newest" || sort === "title" ? sort : "featured",
    page: Math.min(Math.max(Number.parseInt(first(raw.page) ?? "1", 10) || 1, 1), 500),
  };
}

/** Values for the required legal-document placeholders. */
export function legalPlaceholderValues(input: {
  legalEntityName: string;
  businessAddress: string;
  supportEmail: string;
  jurisdiction: string;
  siteUrl: string;
}): Record<string, string> {
  return {
    entity_name: input.legalEntityName,
    business_address: input.businessAddress,
    support_email: input.supportEmail,
    jurisdiction: input.jurisdiction,
    site_url: input.siteUrl,
  };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Optional placeholders render as nothing when unset (unlike required ones,
 * which show a visible "[missing value]" marker). The registration number is
 * rendered inline after the address: ", registration no. 123" or nothing.
 */
export function fillRegistrationNumber(text: string, registrationNumber: string): string {
  const value = registrationNumber.trim() ? `, registration no. ${escapeHtml(registrationNumber.trim())}` : "";
  return text.replace(/\{\{\s*registration_number\s*\}\}/gi, value);
}

/** Escape a JSON-LD payload for safe embedding inside a <script> tag. */
export function serializeJsonLd(data: unknown): string {
  const ls = String.fromCharCode(0x2028);
  const ps = String.fromCharCode(0x2029);
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .split(ls).join("\\u2028")
    .split(ps).join("\\u2029");
}
