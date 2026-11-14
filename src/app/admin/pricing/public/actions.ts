"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/guards";
import { fail, ok, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { SETTINGS_TAG } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { durationDays, durationKeySchema, durationLabel, selectorSettingsSchema, sortDurations } from "@/lib/domain/commerce";
import { isSupportedCurrency } from "@/lib/domain/invoicing";
import { pricingPlanSchema } from "@/lib/domain/pricing";
import { ensureCourseProduct, syncPlanToWhop } from "@/lib/services/payments/catalog";
import { WHOP_MIN_PAID_CENTS } from "@/lib/services/payments/mapping";
import { isWhopReady } from "@/lib/services/payments/whop";
import { getSelectorSettings } from "@/lib/services/commerce/settings";
import { PUBLIC_TAGS, refreshPublic } from "@/lib/services/admin/revalidate";
import type { Json } from "@/types/database";

/**
 * Admin → Public course pricing. Selector prices are ordinary one-time
 * pricing plans on the course product (also sellable on the course page)
 * flagged `in_course_selector`, so there is one pricing engine.
 */

function refresh() {
  refreshPublic(PUBLIC_TAGS.pricing, PUBLIC_TAGS.courses);
  revalidatePath("/admin/pricing/public");
  revalidatePath("/admin/pricing");
}

const settingsInput = z.object({
  selector: selectorSettingsSchema,
  linkTtlHours: z.number().int().min(1, "At least 1 hour").max(720, "At most 30 days"),
});

export async function saveSelectorSettingsAction(input: z.input<typeof settingsInput>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const data = settingsInput.parse(input);
    const durations = sortDurations(data.selector.durations);
    if (!durations.includes(data.selector.default_duration)) {
      return fail("Check the highlighted fields.", { default_duration: ["The default period must be one of the offered periods."] });
    }
    if (!isSupportedCurrency(data.selector.currency)) return fail("Check the highlighted fields.", { currency: ["Choose a supported currency."] });
    const selector = { ...data.selector, durations };
    const { error } = await createAdminClient()
      .from("platform_settings")
      .upsert(
        [
          {
            key: "commerce.selector",
            value: selector as unknown as Json,
            is_public: true,
            description: "Course selector (/courses/select): enabled, access periods offered, default period, currency, maximum courses per order (0 = unlimited).",
            updated_by: actor.id,
          },
          { key: "commerce.order_link_ttl_hours", value: data.linkTtlHours as unknown as Json, is_public: false, description: "Hours a generated course-package payment link stays payable.", updated_by: actor.id },
        ],
        { onConflict: "key" },
      );
    if (error) throw new Error(`settings save failed: ${error.message}`);
    await audit({ actor, action: "settings.updated", entityType: "platform_settings", entityId: "commerce.selector", summary: "Public course pricing settings", metadata: { selector, linkTtlHours: data.linkTtlHours } });
    updateTag(SETTINGS_TAG);
    refresh();
    return ok(null, "Selector settings saved");
  });
}

const priceInput = z
  .object({
    courseId: z.uuid(),
    duration: durationKeySchema,
    priceMinor: z.number().int().min(WHOP_MIN_PAID_CENTS, "Paid prices must be at least 1.00").max(1_000_000_000),
    compareAtMinor: z.number().int().positive().nullable().optional(),
    promoLabel: z.string().trim().max(60, "Keep the label under 60 characters").nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.compareAtMinor != null && v.compareAtMinor <= v.priceMinor) {
      ctx.addIssue({ code: "custom", path: ["compareAtMinor"], message: "The original price must be higher than the price" });
    }
  });

function planName(duration: string): string {
  return duration === "lifetime" ? "Lifetime access" : `${durationLabel(duration).replace(/ days$/, "-day")} access`.replace("1 year access", "1-year access");
}

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Write one selector price: update the plan already offered for this period
 * (or a public one-time plan for the same period, so the course page doesn't
 * get a duplicate), else create a new public one-time plan.
 */
async function upsertSelectorPlan(
  admin: AdminClient,
  currency: string,
  productId: string,
  duration: string,
  values: { priceMinor: number; compareAtMinor: number | null; promoLabel: string | null },
): Promise<{ planId: string; target: { id: string; price_cents: number } | null }> {
  const days = durationDays(duration);
  let plansQuery = admin
    .from("pricing_plans")
    .select("id, in_course_selector, visibility, price_cents, whop_plan_id")
    .eq("product_id", productId)
    .eq("plan_type", "one_time")
    .eq("currency", currency)
    .neq("visibility", "archived");
  plansQuery = days === null ? plansQuery.is("access_duration_days", null) : plansQuery.eq("access_duration_days", days);
  const { data: plans } = await plansQuery.order("in_course_selector", { ascending: false }).order("sort_order");
  const target = (plans ?? []).find((p) => p.in_course_selector) ?? (plans ?? []).find((p) => p.visibility === "public") ?? null;

  if (target) {
    const { error } = await admin
      .from("pricing_plans")
      .update({ price_cents: values.priceMinor, compare_at_price_cents: values.compareAtMinor, promo_label: values.promoLabel, visibility: "public", in_course_selector: true })
      .eq("id", target.id);
    if (error) {
      if (error.code === "23505") throw new UserFacingError("Another price is already offered for this access period.");
      throw new Error(error.message);
    }
    return { planId: target.id, target };
  }
  const plan = pricingPlanSchema.parse({
    name: planName(duration),
    plan_type: "one_time",
    currency,
    price_cents: values.priceMinor,
    compare_at_price_cents: values.compareAtMinor,
    access_duration_days: days,
    promo_label: values.promoLabel,
    visibility: "public",
  });
  const { data: last } = await admin.from("pricing_plans").select("sort_order").eq("product_id", productId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { data: created, error } = await admin
    .from("pricing_plans")
    .insert({ ...plan, product_id: productId, in_course_selector: true, sort_order: ((last?.sort_order as number | undefined) ?? -1) + 1 })
    .select("id")
    .single();
  if (error || !created) {
    if (error?.code === "23505") throw new UserFacingError("Another price is already offered for this access period.");
    throw new Error(error?.message ?? "plan insert failed");
  }
  return { planId: created.id, target: null };
}

/** Set (create or change) the selector price of a course for one access period. */
export async function setSelectorPriceAction(input: z.input<typeof priceInput>): Promise<ActionResult<{ planId: string }>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const data = priceInput.parse(input);
    const settings = await getSelectorSettings();
    const admin = createAdminClient();
    const { data: course } = await admin.from("courses").select("id, title, is_free, status").eq("id", data.courseId).maybeSingle();
    if (!course) throw new UserFacingError("Course not found.");
    if (course.status === "archived") throw new UserFacingError("Archived courses can't be priced.");
    if (course.is_free) throw new UserFacingError("This course is free, so it isn't sold in the selector.");
    const product = await ensureCourseProduct(course.id, actor.id);
    if (product.status !== "active") throw new UserFacingError("This course's pricing product is archived. Reactivate it in Pricing & plans first.");

    const { planId, target } = await upsertSelectorPlan(admin, settings.currency, product.id, data.duration, {
      priceMinor: data.priceMinor,
      compareAtMinor: data.compareAtMinor ?? null,
      promoLabel: data.promoLabel || null,
    });

    await audit({
      actor,
      action: target ? "plan.update" : "plan.create",
      entityType: "pricing_plan",
      entityId: planId,
      summary: `Selector price for ${course.title} (${durationLabel(data.duration)}): ${data.priceMinor} ${settings.currency}`,
      metadata: { courseId: course.id, duration: data.duration, priceMinor: data.priceMinor, before: target ? { price_cents: target.price_cents } : null },
    });

    // The same plan is sold on the course page through Whop: keep its variant in step.
    let message = target ? "Price updated" : "Price added";
    if (await isWhopReady()) {
      const sync = await syncPlanToWhop(planId);
      if (!sync.ok) message = `${message}, but the Whop sync failed: ${sync.message}`;
    }
    refresh();
    return ok({ planId }, message);
  });
}

const bulkInput = z
  .object({
    duration: durationKeySchema,
    mode: z.enum(["fixed", "percent"]),
    priceMinor: z.number().int().min(WHOP_MIN_PAID_CENTS, "Paid prices must be at least 1.00").max(1_000_000_000).optional(),
    percent: z.number().min(1, "At least 1%").max(1000, "At most 1000%").optional(),
    sourceDuration: durationKeySchema.optional(),
    rounding: z.enum(["exact", "whole", "ninety_nine"]).default("exact"),
    overwrite: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "fixed" && v.priceMinor == null) ctx.addIssue({ code: "custom", path: ["priceMinor"], message: "Enter a price" });
    if (v.mode === "percent" && v.percent == null) ctx.addIssue({ code: "custom", path: ["percent"], message: "Enter a percentage" });
    if (v.mode === "percent" && !v.sourceDuration) ctx.addIssue({ code: "custom", path: ["sourceDuration"], message: "Choose the period to base prices on" });
    if (v.mode === "percent" && v.sourceDuration === v.duration) ctx.addIssue({ code: "custom", path: ["sourceDuration"], message: "Choose a different period" });
  });

function roundPrice(minor: number, rounding: "exact" | "whole" | "ninety_nine"): number {
  if (rounding === "whole") return Math.max(WHOP_MIN_PAID_CENTS, Math.round(minor / 100) * 100);
  if (rounding === "ninety_nine") return Math.max(WHOP_MIN_PAID_CENTS - 1, Math.ceil(minor / 100) * 100 - 1);
  return minor;
}

/**
 * Price one access period for every paid course at once: one fixed price, or
 * a percentage of each course's price for another period (e.g. 30 days =
 * 60% of the 90-day price), optionally rounded. Every result is stored as an
 * explicit per-course price that admins can still edit individually.
 */
export async function setPeriodPricesAction(input: z.input<typeof bulkInput>): Promise<ActionResult<{ created: number; updated: number; skipped: number }>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const data = bulkInput.parse(input);
    const settings = await getSelectorSettings();
    if (!settings.durations.includes(data.duration)) throw new UserFacingError(`Enable ${durationLabel(data.duration).toLowerCase()} in the settings first.`);
    const admin = createAdminClient();
    const { data: courses } = await admin.from("courses").select("id, title").neq("status", "archived").eq("is_free", false);
    const targetDays = durationDays(data.duration);
    const sourceDays = data.sourceDuration ? durationDays(data.sourceDuration) : null;

    const selectorPlan = async (productId: string, days: number | null) => {
      let q = admin.from("pricing_plans").select("id, price_cents").eq("product_id", productId).eq("in_course_selector", true).eq("currency", settings.currency).neq("visibility", "archived");
      q = days === null ? q.is("access_duration_days", null) : q.eq("access_duration_days", days);
      return (await q.limit(1).maybeSingle()).data;
    };

    let created = 0;
    let updated = 0;
    let skipped = 0;
    for (const course of courses ?? []) {
      const { data: product } = await admin.from("products").select("id, status").eq("kind", "course").eq("course_id", course.id).maybeSingle();
      if (product && product.status !== "active") {
        skipped++;
        continue;
      }
      if (product && !data.overwrite && (await selectorPlan(product.id, targetDays))) {
        skipped++;
        continue;
      }
      let price: number;
      if (data.mode === "fixed") {
        price = data.priceMinor!;
      } else {
        const source = product ? await selectorPlan(product.id, sourceDays) : null;
        if (!source) {
          skipped++;
          continue;
        }
        price = Math.round((source.price_cents * data.percent!) / 100);
      }
      price = roundPrice(price, data.rounding);
      if (price < WHOP_MIN_PAID_CENTS - 1) {
        skipped++;
        continue;
      }
      const productId = product?.id ?? (await ensureCourseProduct(course.id, actor.id)).id;
      const res = await upsertSelectorPlan(admin, settings.currency, productId, data.duration, { priceMinor: Math.max(price, WHOP_MIN_PAID_CENTS), compareAtMinor: null, promoLabel: null });
      if (res.target) updated++;
      else created++;
    }

    await audit({
      actor,
      action: "plan.bulk_selector_prices",
      entityType: "pricing_plan",
      entityId: null,
      summary: `Bulk ${durationLabel(data.duration)} selector prices: ${created} added, ${updated} updated, ${skipped} skipped`,
      metadata: { ...data },
    });
    refresh();
    const label = durationLabel(data.duration);
    // New plans are pushed to Whop on their first single-course checkout and by the daily catalogue sync.
    return ok({ created, updated, skipped }, `${label} prices: ${created} added, ${updated} updated${skipped ? `, ${skipped} skipped` : ""}`);
  });
}

const planIdInput = z.object({ planId: z.uuid() });

/** Stop offering a price in the selector. The plan itself is kept (it may be sold on the course page). */
export async function removeSelectorPriceAction(input: z.input<typeof planIdInput>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const { planId } = planIdInput.parse(input);
    const { data, error } = await createAdminClient().from("pricing_plans").update({ in_course_selector: false }).eq("id", planId).select("name").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new UserFacingError("Price not found.");
    await audit({ actor, action: "plan.selector_off", entityType: "pricing_plan", entityId: planId, summary: `Removed ${data.name} from the course selector` });
    refresh();
    return ok(null, "Removed from the selector — the plan is still available on the course page");
  });
}

/** Offer an existing public one-time plan in the selector at its current price. */
export async function offerPlanInSelectorAction(input: z.input<typeof planIdInput>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const { planId } = planIdInput.parse(input);
    const admin = createAdminClient();
    const { data: plan } = await admin.from("pricing_plans").select("id, name, plan_type, visibility, price_cents").eq("id", planId).maybeSingle();
    if (!plan) throw new UserFacingError("Plan not found.");
    if (plan.plan_type !== "one_time" || plan.visibility !== "public") throw new UserFacingError("Only public one-time plans can be offered in the selector.");
    if (plan.price_cents < WHOP_MIN_PAID_CENTS) throw new UserFacingError("Paid prices must be at least 1.00.");
    const { error } = await admin.from("pricing_plans").update({ in_course_selector: true }).eq("id", planId);
    if (error) {
      if (error.code === "23505") throw new UserFacingError("Another price is already offered for this access period.");
      throw new Error(error.message);
    }
    await audit({ actor, action: "plan.selector_on", entityType: "pricing_plan", entityId: planId, summary: `Offered ${plan.name} in the course selector` });
    refresh();
    return ok(null, "Now offered in the selector");
  });
}

const featuredInput = z.object({ courseId: z.uuid(), featured: z.boolean() });

export async function setCourseFeaturedAction(input: z.input<typeof featuredInput>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const data = featuredInput.parse(input);
    const { data: course, error } = await createAdminClient().from("courses").update({ is_featured: data.featured }).eq("id", data.courseId).select("title").maybeSingle();
    if (error) throw new Error(error.message);
    if (!course) throw new UserFacingError("Course not found.");
    await audit({ actor, action: "course.featured", entityType: "course", entityId: data.courseId, summary: `${course.title}: ${data.featured ? "featured" : "not featured"}` });
    refresh();
    return ok(null, data.featured ? "Course featured" : "Course no longer featured");
  });
}
