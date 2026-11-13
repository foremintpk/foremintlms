import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripHtml } from "@/lib/sanitize";
import { slugify } from "@/lib/format";
import { UserFacingError } from "@/lib/actions";
import { describeWhopError, getWhopClient } from "./whop";
import { couponToPromoPayload, planToVariantPayload, strikeThroughPrices } from "./mapping";
import type { CouponRow, PlanRow, ProductRow } from "./types";

/**
 * Keeps Whop's catalog (products → variants, promo codes) in step with ours.
 * Our tables stay the source of truth; Whop ids and the last sync error are
 * recorded on each row so admins can see what is live.
 */

async function uniqueProductSlug(base: string): Promise<string> {
  const admin = createAdminClient();
  const root = slugify(base) || "product";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const { data } = await admin.from("products").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

/** The sellable product for a course, created on first use. */
export async function ensureCourseProduct(courseId: string, actorId: string): Promise<ProductRow> {
  const admin = createAdminClient();
  const { data: existing } = await admin.from("products").select("*").eq("course_id", courseId).maybeSingle();
  if (existing) return existing as ProductRow;

  const { data: course } = await admin
    .from("courses")
    .select("id, title, slug, short_description, thumbnail_url")
    .eq("id", courseId)
    .maybeSingle();
  if (!course) throw new UserFacingError("Course not found.");

  const { data: created, error } = await admin
    .from("products")
    .insert({
      kind: "course",
      name: course.title,
      slug: await uniqueProductSlug(course.slug),
      description: course.short_description,
      image_url: course.thumbnail_url,
      course_id: course.id,
      created_by: actorId,
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") {
      const { data: raced } = await admin.from("products").select("*").eq("course_id", courseId).single();
      if (raced) return raced as ProductRow;
    }
    throw new Error(`product insert failed: ${error.message}`);
  }
  await admin.from("product_courses").upsert({ product_id: created.id, course_id: course.id }, { onConflict: "product_id,course_id", ignoreDuplicates: true });
  return created as ProductRow;
}

export async function createGroupProduct(
  input: { kind: "bundle" | "membership"; name: string; description: string | null; grantsAllCourses: boolean; courseIds: string[] },
  actorId: string,
): Promise<ProductRow> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("products")
    .insert({
      kind: input.kind,
      name: input.name,
      slug: await uniqueProductSlug(input.name),
      description: input.description,
      grants_all_courses: input.kind === "membership" ? input.grantsAllCourses : false,
      created_by: actorId,
    })
    .select("*")
    .single();
  if (error) throw new Error(`product insert failed: ${error.message}`);
  if (input.kind === "bundle") await admin.from("course_bundles").insert({ product_id: data.id });
  await setProductCourses(data.id, input.grantsAllCourses && input.kind === "membership" ? [] : input.courseIds);
  return data as ProductRow;
}

export async function setProductCourses(productId: string, courseIds: string[]) {
  const admin = createAdminClient();
  const unique = [...new Set(courseIds)];
  await admin.from("product_courses").delete().eq("product_id", productId).not("course_id", "in", `(${unique.length ? unique.join(",") : "00000000-0000-0000-0000-000000000000"})`);
  if (unique.length) {
    const rows = unique.map((course_id, i) => ({ product_id: productId, course_id, sort_order: i }));
    const { error } = await admin.from("product_courses").upsert(rows, { onConflict: "product_id,course_id" });
    if (error) throw new Error(`product_courses upsert failed: ${error.message}`);
  }
}

/** Courses a product unlocks, or "all" for an all-access membership. */
export async function productCourseIds(product: Pick<ProductRow, "id" | "kind" | "course_id" | "grants_all_courses">): Promise<{ allAccess: boolean; courseIds: string[] }> {
  if (product.kind === "membership" && product.grants_all_courses) return { allAccess: true, courseIds: [] };
  const admin = createAdminClient();
  const { data } = await admin.from("product_courses").select("course_id").eq("product_id", product.id).order("sort_order");
  const ids = (data ?? []).map((r) => r.course_id as string);
  if (product.kind === "course" && product.course_id && !ids.includes(product.course_id)) ids.unshift(product.course_id);
  return { allAccess: false, courseIds: ids };
}

// ---------------------------------------------------------------------------
// Whop sync
// ---------------------------------------------------------------------------

export interface SyncResult {
  ok: boolean;
  message: string;
}

export async function syncProductToWhop(productId: string): Promise<SyncResult> {
  const admin = createAdminClient();
  const { data } = await admin.from("products").select("*").eq("id", productId).single();
  const product = data as ProductRow | null;
  if (!product) throw new UserFacingError("Product not found.");
  const { client, config } = await getWhopClient();

  const description = stripHtml(product.description ?? "").slice(0, 1500) || null;
  try {
    let whopId = product.whop_product_id;
    const metadata = { foremint_product_id: product.id, foremint_kind: product.kind };
    if (whopId) {
      await client.products.update({ id: whopId, title: product.name.slice(0, 80), description, metadata });
    } else {
      const created = await client.products.create(
        { account_id: config.companyId, title: product.name.slice(0, 80), description, metadata },
        { idempotencyKey: `foremint-product-${product.id}` },
      );
      whopId = created.id;
    }
    await admin
      .from("products")
      .update({ whop_product_id: whopId, whop_synced_at: new Date().toISOString(), whop_sync_error: null })
      .eq("id", product.id);
    return { ok: true, message: "Product synced to Whop." };
  } catch (err) {
    const message = describeWhopError(err);
    await admin.from("products").update({ whop_sync_error: message }).eq("id", product.id);
    return { ok: false, message };
  }
}

export async function syncPlanToWhop(planId: string): Promise<SyncResult> {
  const admin = createAdminClient();
  const { data: planData } = await admin.from("pricing_plans").select("*").eq("id", planId).single();
  const plan = planData as PlanRow | null;
  if (!plan) throw new UserFacingError("Plan not found.");
  if (plan.plan_type === "free") {
    return { ok: true, message: "Free plans are fulfilled by Foremint directly and don't need Whop." };
  }

  const { data: productData } = await admin.from("products").select("*").eq("id", plan.product_id).single();
  let product = productData as ProductRow;
  if (!product.whop_product_id) {
    const productSync = await syncProductToWhop(product.id);
    if (!productSync.ok) return productSync;
    const { data: refreshed } = await admin.from("products").select("*").eq("id", product.id).single();
    product = refreshed as ProductRow;
  }

  let payload;
  try {
    payload = planToVariantPayload(plan, product.id);
  } catch (err) {
    const message = (err as Error).message;
    await admin.from("pricing_plans").update({ whop_sync_error: message }).eq("id", plan.id);
    return { ok: false, message };
  }

  const { client, config } = await getWhopClient();
  try {
    let variantId = plan.whop_plan_id;
    if (variantId) {
      const remote = await client.variants.retrieve({ id: variantId });
      if (remote.billing_type !== payload.billing_type) {
        // Billing type can't change on an existing variant: retire it and
        // create a fresh one. Existing subscribers keep the old variant.
        await client.variants.update({ id: variantId, visibility: "archived" });
        variantId = null;
      }
    }
    const { billing_type, ...updatable } = payload;
    if (variantId) {
      await client.variants.update({ id: variantId, ...updatable, ...strikeThroughPrices(plan) });
    } else {
      const created = await client.variants.create(
        { account_id: config.companyId, product_id: product.whop_product_id!, billing_type, ...updatable },
        { idempotencyKey: `foremint-plan-${plan.id}-${billing_type}-${plan.updated_at}` },
      );
      variantId = created.id;
      const strike = strikeThroughPrices(plan);
      if (strike.strike_through_initial_price !== null || strike.strike_through_renewal_price !== null) {
        await client.variants.update({ id: variantId, ...strike });
      }
    }
    await admin
      .from("pricing_plans")
      .update({ whop_plan_id: variantId, whop_synced_at: new Date().toISOString(), whop_sync_error: null })
      .eq("id", plan.id);
    return { ok: true, message: "Plan synced to Whop." };
  } catch (err) {
    const message = describeWhopError(err);
    await admin.from("pricing_plans").update({ whop_sync_error: message }).eq("id", plan.id);
    return { ok: false, message };
  }
}

/** Sync a product and all of its paid plans. */
export async function syncProductAndPlans(productId: string): Promise<{ synced: number; failed: number; messages: string[] }> {
  const admin = createAdminClient();
  const productResult = await syncProductToWhop(productId);
  if (!productResult.ok) return { synced: 0, failed: 1, messages: [productResult.message] };
  const { data: plans } = await admin
    .from("pricing_plans")
    .select("id, name, plan_type")
    .eq("product_id", productId)
    .neq("plan_type", "free");
  let synced = 0;
  let failed = 0;
  const messages: string[] = [];
  for (const plan of plans ?? []) {
    const result = await syncPlanToWhop(plan.id);
    if (result.ok) synced++;
    else {
      failed++;
      messages.push(`${plan.name}: ${result.message}`);
    }
  }
  return { synced, failed, messages };
}

export async function syncCouponToWhop(couponId: string): Promise<SyncResult> {
  const admin = createAdminClient();
  const { data } = await admin.from("coupons").select("*").eq("id", couponId).single();
  const coupon = data as CouponRow | null;
  if (!coupon) throw new UserFacingError("Coupon not found.");
  const { client, config } = await getWhopClient();

  try {
    if (coupon.whop_promo_code_id) {
      // Promo codes are immutable on Whop apart from their active state.
      if (coupon.status === "active") await client.promoCodes.activate({ id: coupon.whop_promo_code_id });
      else await client.promoCodes.deactivate({ id: coupon.whop_promo_code_id });
    } else {
      let variantIds: string[] = [];
      if (coupon.plan_ids.length) {
        const { data: plans } = await admin.from("pricing_plans").select("id, whop_plan_id, name").in("id", coupon.plan_ids);
        const unsynced = (plans ?? []).filter((p) => !p.whop_plan_id);
        if (unsynced.length) {
          const message = `Sync these plans to Whop first: ${unsynced.map((p) => p.name).join(", ")}.`;
          await admin.from("coupons").update({ whop_sync_error: message }).eq("id", coupon.id);
          return { ok: false, message };
        }
        variantIds = (plans ?? []).map((p) => p.whop_plan_id as string);
      }
      const payload = couponToPromoPayload(coupon, variantIds);
      const created = await client.promoCodes.create(
        {
          account_id: config.companyId,
          code: payload.code,
          amount_off: payload.amount_off,
          base_currency: payload.base_currency as never,
          promo_type: payload.promo_type,
          new_users_only: payload.new_users_only,
          one_per_customer: payload.one_per_customer,
          promo_duration_months: payload.promo_duration_months,
          expires_at: payload.expires_at,
          unlimited_stock: payload.unlimited_stock,
          stock: payload.stock,
          variant_ids: payload.variant_ids.length ? payload.variant_ids : undefined,
        },
        { idempotencyKey: `foremint-coupon-${coupon.id}` },
      );
      if (coupon.status !== "active") await client.promoCodes.deactivate({ id: created.id });
      await admin.from("coupons").update({ whop_promo_code_id: created.id }).eq("id", coupon.id);
    }
    await admin.from("coupons").update({ whop_synced_at: new Date().toISOString(), whop_sync_error: null }).eq("id", coupon.id);
    return { ok: true, message: "Coupon synced to Whop." };
  } catch (err) {
    const message = describeWhopError(err);
    await admin.from("coupons").update({ whop_sync_error: message }).eq("id", coupon.id);
    return { ok: false, message };
  }
}
