import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl } from "@/lib/env";
import { planAvailability } from "@/lib/domain/pricing";
import { computeAccessWindow, isEntitlementActive, type EntitlementLike } from "@/lib/domain/access";
import { grantAccess } from "@/lib/services/entitlements";
import type { SessionUser } from "@/lib/auth/session";
import type { Json } from "@/types/database";
import { describeWhopError, getWhopClient, isWhopReady } from "./whop";
import { productCourseIds, syncPlanToWhop } from "./catalog";
import type { PlanRow, ProductRow } from "./types";

export type CheckoutUnavailableReason =
  | "not_found"
  | "archived"
  | "not_started"
  | "ended"
  | "sold_out"
  | "course_unavailable"
  | "payments_unavailable"
  | "not_synced"
  | "provider_error";

export type CheckoutOutcome =
  | { kind: "redirect"; url: string }
  | { kind: "granted"; path: string }
  | { kind: "owned"; path: string }
  | { kind: "unavailable"; reason: CheckoutUnavailableReason };

async function firstCourseSlug(courseIds: string[]): Promise<string | null> {
  if (!courseIds.length) return null;
  const { data } = await createAdminClient().from("courses").select("id, slug, status").in("id", courseIds);
  const byId = new Map((data ?? []).map((c) => [c.id as string, c]));
  for (const id of courseIds) {
    const c = byId.get(id);
    if (c && c.status === "published") return c.slug as string;
  }
  return null;
}

/** Does the learner already hold everything this product would give them? */
async function alreadyOwns(userId: string, product: ProductRow, plan: PlanRow, allAccess: boolean, courseIds: string[]): Promise<boolean> {
  const admin = createAdminClient();
  if (plan.plan_type === "recurring") {
    const { count } = await admin
      .from("subscription_records")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("product_id", product.id)
      .in("status", ["trialing", "active", "past_due", "canceling"]);
    if ((count ?? 0) > 0) return true;
  }
  const { data } = await admin
    .from("course_entitlements")
    .select("id, status, scope, course_id, starts_at, expires_at")
    .eq("user_id", userId)
    .eq("status", "active");
  const active = ((data ?? []) as EntitlementLike[]).filter((e) => isEntitlementActive(e));
  if (active.some((e) => e.scope === "all_access")) return true;
  if (allAccess) return false;
  if (!courseIds.length) return false;
  const covered = new Set(active.map((e) => e.course_id));
  // Lifetime/long access already held for every course: nothing to buy.
  return courseIds.every((id) => covered.has(id)) && active.filter((e) => e.course_id && courseIds.includes(e.course_id)).every((e) => e.expires_at === null);
}

/**
 * Start a purchase. Access is never granted here for paid plans — only the
 * verified payment webhook does that.
 */
export async function startCheckout(user: SessionUser, planId: string): Promise<CheckoutOutcome> {
  const admin = createAdminClient();
  const { data: planData } = await admin.from("pricing_plans").select("*").eq("id", planId).maybeSingle();
  const plan = planData as PlanRow | null;
  if (!plan) return { kind: "unavailable", reason: "not_found" };
  const { data: productData } = await admin.from("products").select("*").eq("id", plan.product_id).maybeSingle();
  const product = productData as ProductRow | null;
  if (!product || product.status !== "active") return { kind: "unavailable", reason: "archived" };

  // Hidden plans are private offers: purchasable from their direct link, never listed.
  const availability = planAvailability(plan);
  if (!availability.available) return { kind: "unavailable", reason: (availability.reason ?? "archived") as CheckoutUnavailableReason };

  const { allAccess, courseIds } = await productCourseIds(product);
  if (!allAccess) {
    const { data: courses } = courseIds.length
      ? await admin.from("courses").select("id, status").in("id", courseIds)
      : { data: [] };
    if (!(courses ?? []).some((c) => c.status === "published")) return { kind: "unavailable", reason: "course_unavailable" };
  }

  const firstSlug = allAccess ? null : await firstCourseSlug(courseIds);
  const learnPath = firstSlug ? `/learn/courses/${firstSlug}` : "/learn/courses";

  if (await alreadyOwns(user.id, product, plan, allAccess, courseIds)) {
    return { kind: "owned", path: plan.plan_type === "recurring" ? "/learn/billing" : learnPath };
  }

  if (plan.plan_type === "free") {
    const window = computeAccessWindow(plan, new Date());
    await grantAccess({
      userId: user.id,
      courseIds,
      allAccess,
      source: "free",
      startsAt: window.startsAt,
      expiresAt: window.expiresAt,
      productId: product.id,
      planId: plan.id,
    });
    return { kind: "granted", path: learnPath };
  }

  if (!(await isWhopReady())) return { kind: "unavailable", reason: "payments_unavailable" };
  // A plan nobody has synced yet is created in Whop on its first checkout
  // (idempotent), so publishing a price is enough to start selling.
  let whopPlanId = plan.whop_plan_id;
  if (!whopPlanId) {
    const synced = await syncPlanToWhop(plan.id);
    if (!synced.ok) {
      console.error("[checkout] on-demand Whop sync failed", synced.message);
      return { kind: "unavailable", reason: "not_synced" };
    }
    const { data: refreshed } = await admin.from("pricing_plans").select("whop_plan_id").eq("id", plan.id).single();
    whopPlanId = refreshed?.whop_plan_id ?? null;
    if (!whopPlanId) return { kind: "unavailable", reason: "not_synced" };
  }

  const { data: session, error } = await admin
    .from("checkout_sessions")
    .insert({
      user_id: user.id,
      plan_id: plan.id,
      product_id: product.id,
      status: "created",
      metadata: { course_ids: courseIds, all_access: allAccess } as Json,
    })
    .select("id")
    .single();
  if (error || !session) throw new Error(`checkout session insert failed: ${error?.message}`);

  try {
    const { client, config } = await getWhopClient();
    const configuration = await client.checkoutConfigurations.create(
      {
        account_id: config.companyId,
        variant_id: whopPlanId,
        metadata: {
          foremint_user_id: user.id,
          checkout_session_id: session.id,
          plan_id: plan.id,
          product_id: product.id,
          context: `${product.kind}:${plan.plan_type}`,
          course_ids: allAccess ? "all" : courseIds.join(",").slice(0, 480),
        },
        redirect_url: appUrl(`/checkout/success?session=${session.id}`),
      },
      { idempotencyKey: `foremint-checkout-${session.id}` },
    );
    if (!configuration.purchase_url) throw new Error("Whop returned no purchase URL");
    await admin
      .from("checkout_sessions")
      .update({ whop_checkout_id: configuration.id, purchase_url: configuration.purchase_url })
      .eq("id", session.id);
    return { kind: "redirect", url: configuration.purchase_url };
  } catch (err) {
    console.error("[checkout] Whop checkout configuration failed", describeWhopError(err));
    await admin
      .from("checkout_sessions")
      .update({ status: "failed", metadata: { course_ids: courseIds, all_access: allAccess, error: describeWhopError(err) } as Json })
      .eq("id", session.id);
    return { kind: "unavailable", reason: "provider_error" };
  }
}
