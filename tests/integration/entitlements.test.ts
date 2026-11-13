import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanupUsers, hasSupabase, makeUser, runId, service, skipReason } from "./helpers";

// Next.js request-scope APIs are not available under Vitest.
vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {}, updateTag: () => {}, revalidateTag: () => {}, revalidatePath: () => {} }));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {} }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ getAll: () => [], set: () => {} }) }));

const hasServerEnv = hasSupabase && Boolean(process.env.ENCRYPTION_KEY && process.env.CRON_SECRET);

describe.skipIf(!hasServerEnv)("entitlement service against the database", () => {
  let userId = "";
  let courseId = "";
  let paymentId = "";
  let subscriptionId = "";

  beforeAll(async () => {
    const admin = service();
    const u = await makeUser("entitled");
    userId = u.id;
    const { data: course } = await admin
      .from("courses")
      .insert({ slug: `it-ent-${runId}`, title: "IT entitlements", status: "published", visibility: "public" })
      .select("id")
      .single();
    courseId = course!.id;
    const { data: payment } = await admin
      .from("payment_transactions")
      .insert({ whop_payment_id: `it_pay_${runId}`, user_id: userId, status: "succeeded", total_cents: 1000 })
      .select("id")
      .single();
    paymentId = payment!.id;
    const { data: sub } = await admin
      .from("subscription_records")
      .insert({ whop_membership_id: `it_mem_${runId}`, user_id: userId, status: "active" })
      .select("id")
      .single();
    subscriptionId = sub!.id;
  });

  afterAll(async () => {
    const admin = service();
    await admin.from("course_entitlements").delete().eq("user_id", userId);
    await admin.from("payment_transactions").delete().eq("id", paymentId);
    await admin.from("subscription_records").delete().eq("id", subscriptionId);
    await admin.from("courses").delete().eq("id", courseId);
    await cleanupUsers();
  });

  it("grants access once per payment, even when the webhook is delivered twice", async () => {
    const { grantAccess } = await import("@/lib/services/entitlements");
    const input = { userId, courseIds: [courseId], source: "purchase" as const, expiresAt: null, paymentTransactionId: paymentId, notifyUser: false };
    const first = await grantAccess(input);
    const second = await grantAccess(input);
    expect(first.entitlementIds).toHaveLength(1);
    expect(second.entitlementIds).toEqual(first.entitlementIds);
    const { count } = await service().from("course_entitlements").select("id", { count: "exact", head: true }).eq("payment_transaction_id", paymentId);
    expect(count).toBe(1);
    const { data: enrollment } = await service().from("enrollments").select("status").eq("user_id", userId).eq("course_id", courseId).single();
    expect(enrollment?.status).toBe("active");
  });

  it("extends subscription access on renewal and ends it on cancellation", async () => {
    const { grantAccess, setSubscriptionAccess } = await import("@/lib/services/entitlements");
    await grantAccess({ userId, courseIds: [courseId], source: "subscription", expiresAt: new Date(Date.now() + 86_400_000), subscriptionRecordId: subscriptionId, notifyUser: false });
    const later = new Date(Date.now() + 31 * 86_400_000);
    await setSubscriptionAccess(subscriptionId, { status: "active", expiresAt: later, reason: "renewed" });
    let { data } = await service().from("course_entitlements").select("status, expires_at").eq("subscription_record_id", subscriptionId).single();
    expect(data?.status).toBe("active");
    expect(new Date(data!.expires_at!).getTime()).toBeCloseTo(later.getTime(), -4);
    await setSubscriptionAccess(subscriptionId, { status: "expired", expiresAt: new Date(), reason: "cancelled" });
    ({ data } = await service().from("course_entitlements").select("status").eq("subscription_record_id", subscriptionId).single());
    expect(data?.status).toBe("expired");
  });

  it("revokes access for a refunded payment", async () => {
    const { revokeAccess } = await import("@/lib/services/entitlements");
    const affected = await revokeAccess({ paymentTransactionId: paymentId, reason: "Refunded" });
    expect(affected).toBe(1);
    const { data } = await service().from("course_entitlements").select("status, revoke_reason").eq("payment_transaction_id", paymentId).single();
    expect(data).toMatchObject({ status: "revoked", revoke_reason: "Refunded" });
  });

  it("expires time-limited access once its end date passes", async () => {
    const admin = service();
    const { data: ent } = await admin
      .from("course_entitlements")
      .insert({ user_id: userId, scope: "course", course_id: courseId, source: "manual", grant_reason: "test", starts_at: new Date(Date.now() - 10 * 86_400_000).toISOString(), expires_at: new Date(Date.now() - 60_000).toISOString() })
      .select("id")
      .single();
    const { expireDueEntitlements } = await import("@/lib/services/entitlements");
    expect(await expireDueEntitlements()).toBeGreaterThanOrEqual(1);
    const { data } = await admin.from("course_entitlements").select("status").eq("id", ent!.id).single();
    expect(data?.status).toBe("expired");
  });
});

describe.skipIf(hasServerEnv)("entitlement service against the database", () => {
  it.skip(`${skipReason} Also set ENCRYPTION_KEY and CRON_SECRET.`, () => {});
});
