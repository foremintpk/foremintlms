"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/guards";
import { fail, ok, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncCouponToWhop } from "@/lib/services/payments/catalog";
import { isWhopReady } from "@/lib/services/payments/whop";
import type { CouponRow } from "@/lib/services/payments/types";

const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{3,40}$/, "Use 3–40 letters, numbers, dashes or underscores"),
    description: z.string().trim().max(300).nullable().optional(),
    discount_type: z.enum(["percent", "fixed"]),
    amount: z.number().positive("Enter a discount above zero"),
    currency: z.string().regex(/^[a-z]{3}$/).nullable().optional(),
    max_redemptions: z.number().int().positive().nullable().optional(),
    expires_at: z.string().datetime({ offset: true }).nullable().optional(),
    plan_ids: z.array(z.uuid()).max(100).default([]),
    new_customers_only: z.boolean().default(false),
    // Where the code works: plans = Whop promo code at plan checkout; packages = applied
    // by Foremint to course packages (never sent to Whop); all = both.
    applies_to: z.enum(["all", "plans", "packages"]).default("packages"),
    course_ids: z.array(z.uuid()).max(200).default([]),
    min_subtotal_cents: z.number().int().positive("Enter an amount above zero").nullable().optional(),
    max_redemptions_per_customer: z.number().int().positive().max(1000).nullable().optional(),
    starts_at: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .superRefine((c, ctx) => {
    if (c.discount_type === "percent" && c.amount > 100) ctx.addIssue({ code: "custom", path: ["amount"], message: "A percentage can't exceed 100" });
    if (c.discount_type === "fixed" && !c.currency) ctx.addIssue({ code: "custom", path: ["currency"], message: "Fixed discounts need a currency" });
    if (c.expires_at && new Date(c.expires_at) <= new Date()) ctx.addIssue({ code: "custom", path: ["expires_at"], message: "Choose a future date" });
    if (c.starts_at && c.applies_to !== "packages") {
      ctx.addIssue({ code: "custom", path: ["starts_at"], message: "Whop promo codes can't have a start date — use it for course-package codes only" });
    }
    if (c.starts_at && c.expires_at && new Date(c.expires_at) <= new Date(c.starts_at)) ctx.addIssue({ code: "custom", path: ["expires_at"], message: "The end must be after the start" });
    if (c.applies_to === "plans" && (c.course_ids.length || c.min_subtotal_cents || c.max_redemptions_per_customer)) {
      ctx.addIssue({ code: "custom", path: ["applies_to"], message: "Course limits, minimum spend and per-customer limits apply to course packages only" });
    }
  });

/** Codes that exist as Whop promo codes. Package-only codes are applied by Foremint. */
const syncsToWhop = (appliesTo: string) => appliesTo !== "packages";

function refresh() {
  revalidatePath("/admin/coupons");
}

export async function createCouponAction(input: unknown): Promise<ActionResult<{ couponId: string }>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const data = couponSchema.parse(input);
    const admin = createAdminClient();
    const { data: row, error } = await admin
      .from("coupons")
      .insert({
        code: data.code.toUpperCase(),
        description: data.description || null,
        discount_type: data.discount_type,
        amount: data.amount,
        currency: data.discount_type === "fixed" ? data.currency : null,
        max_redemptions: data.max_redemptions ?? null,
        expires_at: data.expires_at ?? null,
        plan_ids: data.plan_ids,
        new_customers_only: data.new_customers_only,
        applies_to: data.applies_to,
        course_ids: data.applies_to === "plans" ? [] : data.course_ids,
        min_subtotal_cents: data.applies_to === "plans" ? null : (data.min_subtotal_cents ?? null),
        max_redemptions_per_customer: data.applies_to === "plans" ? null : (data.max_redemptions_per_customer ?? null),
        starts_at: data.starts_at ?? null,
        status: "active",
        created_by: actor.id,
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") return fail("Check the highlighted fields.", { code: ["That code already exists"] });
      throw new Error(error.message);
    }
    await audit({ actor, action: "coupon.create", entityType: "coupon", entityId: row.id, summary: `Created coupon ${data.code.toUpperCase()}`, metadata: { ...data } });
    let message = syncsToWhop(data.applies_to) ? "Coupon created" : "Coupon created for course packages";
    if (syncsToWhop(data.applies_to) && (await isWhopReady())) {
      const sync = await syncCouponToWhop(row.id);
      message = sync.ok ? "Coupon created and synced to Whop" : `Coupon created, but Whop sync failed: ${sync.message}`;
    }
    refresh();
    return ok({ couponId: row.id }, message);
  });
}

export async function setCouponStatusAction(input: { couponId: string; status: "active" | "disabled" | "archived" }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const couponId = z.uuid().parse(input.couponId);
    const status = z.enum(["active", "disabled", "archived"]).parse(input.status);
    const admin = createAdminClient();
    const { data } = await admin.from("coupons").update({ status }).eq("id", couponId).select("code, whop_promo_code_id, applies_to").single();
    if (!data) throw new UserFacingError("Coupon not found.");
    await audit({ actor, action: "coupon.status", entityType: "coupon", entityId: couponId, summary: `${data.code} → ${status}` });
    let message = status === "active" ? "Coupon activated" : status === "disabled" ? "Coupon paused" : "Coupon archived";
    if (data.whop_promo_code_id && syncsToWhop(data.applies_to) && (await isWhopReady())) {
      const sync = await syncCouponToWhop(couponId);
      if (!sync.ok) message = `${message}, but Whop wasn't updated: ${sync.message}`;
    }
    refresh();
    return ok(null, message);
  });
}

export async function syncCouponAction(input: { couponId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const couponId = z.uuid().parse(input.couponId);
    const { data: coupon } = await createAdminClient().from("coupons").select("applies_to").eq("id", couponId).maybeSingle();
    if (!coupon) throw new UserFacingError("Coupon not found.");
    if (!syncsToWhop(coupon.applies_to)) throw new UserFacingError("Course-package codes are applied by Foremint and aren't sent to Whop.");
    if (!(await isWhopReady())) throw new UserFacingError("Connect Whop in Admin → Integrations before syncing.");
    const result = await syncCouponToWhop(couponId);
    await audit({ actor, action: "coupon.sync_whop", entityType: "coupon", entityId: couponId, summary: result.message });
    refresh();
    return result.ok ? ok(null, result.message) : fail(result.message);
  });
}

export async function deleteCouponAction(couponIdArg: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const couponId = z.uuid().parse(couponIdArg);
    const admin = createAdminClient();
    const { data } = await admin.from("coupons").select("*").eq("id", couponId).single();
    const coupon = data as CouponRow | null;
    if (!coupon) throw new UserFacingError("Coupon not found.");
    if (coupon.whop_promo_code_id || coupon.redemptions_count > 0) {
      throw new UserFacingError("This coupon is live on Whop or has been used, so it can't be deleted. Archive it instead.");
    }
    await admin.from("coupons").delete().eq("id", couponId);
    await audit({ actor, action: "coupon.delete", entityType: "coupon", entityId: couponId, summary: `Deleted coupon ${coupon.code}` });
    refresh();
    return ok(null, "Coupon deleted");
  });
}
