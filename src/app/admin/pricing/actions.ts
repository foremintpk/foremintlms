"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/guards";
import { fail, ok, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { pricingPlanSchema } from "@/lib/domain/pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureCourseProduct, syncPlanToWhop, syncProductAndPlans } from "@/lib/services/payments/catalog";
import { isWhopReady } from "@/lib/services/payments/whop";
import { WHOP_MIN_PAID_CENTS } from "@/lib/services/payments/mapping";
import type { PlanRow } from "@/lib/services/payments/types";

const uuid = z.uuid();

function refresh(productId?: string) {
  revalidatePath("/admin/pricing");
  if (productId) revalidatePath(`/admin/pricing/${productId}`);
  revalidatePath("/admin/bundles");
}

export async function ensureCourseProductAction(input: { courseId: string }): Promise<ActionResult<{ productId: string }>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const courseId = uuid.parse(input.courseId);
    const product = await ensureCourseProduct(courseId, actor.id);
    await audit({ actor, action: "product.ensure", entityType: "product", entityId: product.id, summary: `Pricing product for course ${courseId}` });
    refresh(product.id);
    return ok({ productId: product.id }, "Pricing product ready");
  });
}

const productSchema = z.object({
  productId: uuid,
  name: z.string().trim().min(1, "Give the product a name").max(200),
  description: z.string().trim().max(1500).nullable().optional(),
  status: z.enum(["active", "archived"]),
  is_featured: z.boolean().default(false),
});

export async function updateProductAction(input: z.input<typeof productSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const data = productSchema.parse(input);
    const { error } = await createAdminClient()
      .from("products")
      .update({ name: data.name, description: data.description || null, status: data.status, is_featured: data.is_featured })
      .eq("id", data.productId);
    if (error) throw new Error(error.message);
    await audit({ actor, action: "product.update", entityType: "product", entityId: data.productId, summary: `Updated product ${data.name}`, metadata: { status: data.status } });
    refresh(data.productId);
    return ok(null, "Product saved");
  });
}

/** Extra checks on top of the shared schema: Whop's minimum charge. */
function checkPlan(plan: z.infer<typeof pricingPlanSchema>): ActionResult<never> | null {
  if (plan.plan_type !== "free" && plan.price_cents < WHOP_MIN_PAID_CENTS) {
    return fail("Check the highlighted fields.", { price_cents: ["Whop requires paid plans to cost at least 1.00."] });
  }
  return null;
}

export async function createPlanAction(productIdArg: string, input: { plan: unknown }): Promise<ActionResult<{ planId: string }>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const productId = uuid.parse(productIdArg);
    const plan = pricingPlanSchema.parse(input.plan);
    const invalid = checkPlan(plan);
    if (invalid) return invalid;
    const admin = createAdminClient();
    const { data: last } = await admin.from("pricing_plans").select("sort_order").eq("product_id", productId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const { data, error } = await admin
      .from("pricing_plans")
      .insert({ ...plan, product_id: productId, sort_order: ((last?.sort_order as number | undefined) ?? -1) + 1 })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await audit({ actor, action: "plan.create", entityType: "pricing_plan", entityId: data.id, summary: `Created plan ${plan.name}`, metadata: { ...plan } });
    let message = "Plan created";
    if (plan.plan_type !== "free" && (await isWhopReady())) {
      const sync = await syncPlanToWhop(data.id);
      message = sync.ok ? "Plan created and synced to Whop" : `Plan created, but Whop sync failed: ${sync.message}`;
    }
    refresh(productId);
    return ok({ planId: data.id }, message);
  });
}

export async function updatePlanAction(planIdArg: string, input: { plan: unknown }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const planId = uuid.parse(planIdArg);
    const plan = pricingPlanSchema.parse(input.plan);
    const invalid = checkPlan(plan);
    if (invalid) return invalid;
    const admin = createAdminClient();
    const { data: before } = await admin.from("pricing_plans").select("*").eq("id", planId).single();
    const prev = before as PlanRow | null;
    if (!prev) throw new UserFacingError("Plan not found.");
    if (prev.units_sold > 0 && prev.plan_type !== plan.plan_type) {
      throw new UserFacingError("This plan has buyers, so its type can't change. Archive it and create a new plan instead.");
    }
    if (plan.stock_limit != null && plan.stock_limit < prev.units_sold) {
      return fail("Check the highlighted fields.", { stock_limit: [`${prev.units_sold} have already been sold.`] });
    }
    const { error } = await admin.from("pricing_plans").update(plan).eq("id", planId);
    if (error) throw new Error(error.message);
    await audit({
      actor,
      action: "plan.update",
      entityType: "pricing_plan",
      entityId: planId,
      summary: `Updated plan ${plan.name}`,
      metadata: { before: { price_cents: prev.price_cents, visibility: prev.visibility, plan_type: prev.plan_type }, after: { ...plan } },
    });
    let message = "Plan saved";
    if (plan.plan_type !== "free" && prev.whop_plan_id && (await isWhopReady())) {
      const sync = await syncPlanToWhop(planId);
      message = sync.ok ? "Plan saved and synced to Whop" : `Plan saved, but Whop sync failed: ${sync.message}`;
    }
    refresh(prev.product_id);
    return ok(null, message);
  });
}

export async function setPlanVisibilityAction(input: { planId: string; visibility: "public" | "hidden" | "archived" }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const planId = uuid.parse(input.planId);
    const visibility = z.enum(["public", "hidden", "archived"]).parse(input.visibility);
    const admin = createAdminClient();
    const { data } = await admin.from("pricing_plans").update({ visibility }).eq("id", planId).select("product_id, name, whop_plan_id, plan_type").single();
    if (!data) throw new UserFacingError("Plan not found.");
    await audit({ actor, action: "plan.visibility", entityType: "pricing_plan", entityId: planId, summary: `${data.name} → ${visibility}` });
    if (data.whop_plan_id && data.plan_type !== "free" && (await isWhopReady())) await syncPlanToWhop(planId);
    refresh(data.product_id as string);
    return ok(null, visibility === "archived" ? "Plan archived" : visibility === "hidden" ? "Plan hidden" : "Plan published");
  });
}

export async function movePlanAction(input: { planId: string; direction: "up" | "down" }): Promise<ActionResult<null>> {
  return runAction(async () => {
    await assertAdmin();
    const planId = uuid.parse(input.planId);
    const admin = createAdminClient();
    const { data: plan } = await admin.from("pricing_plans").select("id, product_id").eq("id", planId).single();
    if (!plan) throw new UserFacingError("Plan not found.");
    const { data: siblings } = await admin.from("pricing_plans").select("id, sort_order").eq("product_id", plan.product_id).order("sort_order").order("created_at");
    const list = (siblings ?? []).map((s) => s.id as string);
    const i = list.indexOf(planId);
    const j = input.direction === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= list.length) return ok(null);
    [list[i], list[j]] = [list[j], list[i]];
    await Promise.all(list.map((id, idx) => admin.from("pricing_plans").update({ sort_order: idx }).eq("id", id)));
    refresh(plan.product_id as string);
    return ok(null);
  });
}

export async function deletePlanAction(planIdArg: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const planId = uuid.parse(planIdArg);
    const admin = createAdminClient();
    const { data } = await admin.from("pricing_plans").select("*").eq("id", planId).single();
    const plan = data as PlanRow | null;
    if (!plan) throw new UserFacingError("Plan not found.");
    const { count } = await admin.from("checkout_sessions").select("id", { count: "exact", head: true }).eq("plan_id", planId);
    if (plan.units_sold > 0 || (count ?? 0) > 0 || plan.whop_plan_id) {
      throw new UserFacingError("This plan has been offered at checkout, so it can't be deleted. Archive it instead.");
    }
    const { error } = await admin.from("pricing_plans").delete().eq("id", planId);
    if (error) throw new Error(error.message);
    await audit({ actor, action: "plan.delete", entityType: "pricing_plan", entityId: planId, summary: `Deleted draft plan ${plan.name}` });
    refresh(plan.product_id);
    return ok(null, "Plan deleted");
  });
}

export async function syncProductAction(input: { productId: string }): Promise<ActionResult<{ synced: number; failed: number }>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const productId = uuid.parse(input.productId);
    if (!(await isWhopReady())) throw new UserFacingError("Connect Whop in Admin → Integrations before syncing.");
    const result = await syncProductAndPlans(productId);
    await audit({ actor, action: "product.sync_whop", entityType: "product", entityId: productId, summary: `Synced ${result.synced} plan(s), ${result.failed} failed`, metadata: { messages: result.messages } });
    refresh(productId);
    if (result.failed > 0) return fail(result.messages.join(" ") || "Some plans could not be synced.");
    return ok({ synced: result.synced, failed: 0 }, result.synced ? `Synced product and ${result.synced} plan(s) to Whop` : "Product synced to Whop");
  });
}

export async function syncPlanAction(input: { planId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const planId = uuid.parse(input.planId);
    if (!(await isWhopReady())) throw new UserFacingError("Connect Whop in Admin → Integrations before syncing.");
    const result = await syncPlanToWhop(planId);
    const { data } = await createAdminClient().from("pricing_plans").select("product_id").eq("id", planId).single();
    await audit({ actor, action: "plan.sync_whop", entityType: "pricing_plan", entityId: planId, summary: result.message });
    refresh(data?.product_id as string | undefined);
    return result.ok ? ok(null, result.message) : fail(result.message);
  });
}
