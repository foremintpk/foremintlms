import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomBytes, createHash } from "node:crypto";
import { cleanupUsers, hasSupabase, makeUser, runId, service, skipReason } from "./helpers";

/**
 * Course-package orders against the real database. Whop is stubbed (no
 * network, no money): the stub records the objects checkout creates and
 * returns the payments each test prepares — exactly what the webhook path
 * sees after re-fetching a payment from Whop. Emails are captured.
 */

vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {}, updateTag: () => {}, revalidateTag: () => {}, revalidatePath: () => {} }));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {} }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, getAll: () => [], set: () => {} }) }));

const emails: { templateKey: string; to: string; idempotencyKey: string; payload?: Record<string, unknown> }[] = [];
vi.mock("@/lib/services/email/outbox", () => ({
  enqueueEmail: async (input: { templateKey: string; to: string; idempotencyKey: string; payload?: Record<string, unknown> }) => {
    emails.push(input);
    return { queued: true };
  },
}));
vi.mock("@/lib/services/account", async (orig) => ({ ...(await orig<typeof import("@/lib/services/account")>()), listAdminUserIds: async () => [] }));

const whop = {
  seq: 0,
  variants: new Map<string, Record<string, unknown>>(),
  checkouts: new Map<string, Record<string, unknown>>(),
  payments: new Map<string, Record<string, unknown>>(),
  deletedCheckouts: [] as string[],
  archivedVariants: [] as string[],
};
vi.mock("@/lib/services/payments/whop", () => {
  const config = { apiKey: "test", companyId: "biz_it", webhookSecret: "ws_test", environment: "sandbox" as const };
  return {
    WHOP_API_VERSION: "test",
    isWhopReady: async () => true,
    describeWhopError: () => "Whop error",
    isWhopNotFound: () => false,
    getWhopConfig: async () => config,
    getWhopClient: async () => ({
      config,
      client: {
        products: { create: async () => ({ id: "prod_it_package" }), update: async () => ({}) },
        variants: {
          create: async (body: Record<string, unknown>) => {
            const id = `plan_it_${runId}_${++whop.seq}`;
            whop.variants.set(id, body);
            return { id };
          },
          update: async ({ id }: { id: string }) => {
            whop.archivedVariants.push(id);
            return { id };
          },
        },
        checkoutConfigurations: {
          create: async (body: Record<string, unknown>) => {
            const id = `ch_it_${runId}_${++whop.seq}`;
            whop.checkouts.set(id, body);
            return { id, purchase_url: `https://sandbox.whop.com/checkout/${id}/` };
          },
          delete: async ({ id }: { id: string }) => {
            whop.deletedCheckouts.push(id);
            return { id, deleted: true };
          },
        },
        payments: {
          retrieve: async ({ id }: { id: string }) => whop.payments.get(id),
          list: async ({ variant_id }: { variant_id?: string }) => {
            const rows = [...whop.payments.values()].filter((p) => !variant_id || p.variant_id === variant_id);
            return { async *[Symbol.asyncIterator]() { yield* rows; } };
          },
        },
        memberships: { retrieve: async () => ({}) },
      },
    }),
  };
});

const hasServerEnv = hasSupabase && Boolean(process.env.ENCRYPTION_KEY && process.env.CRON_SECRET);

function money(amount: string) {
  return { amount, currency: "usd", decimals: 2, display_decimals: 2 };
}

function payment(id: string, order: { whop_plan_id: string | null; whop_checkout_configuration_id: string | null; id: string }, opts: { amount: string; tax?: string; status?: string; refunded?: string; promo?: string | null; payer?: string; account?: string; metadataOnly?: boolean }) {
  const p = {
    id,
    account_id: opts.account ?? "biz_it",
    currency: "usd",
    subtotal: money(opts.amount),
    total: money(opts.tax ? (Number(opts.amount) + Number(opts.tax)).toFixed(2) : opts.amount),
    tax_amount: opts.tax ? money(opts.tax) : null,
    status: opts.status ?? "paid",
    substatus: "succeeded",
    refunded_amount: opts.refunded ? money(opts.refunded) : null,
    refunded_at: opts.refunded ? new Date().toISOString() : null,
    paid_at: new Date().toISOString(),
    membership_id: null,
    metadata: { foremint_public_order_id: order.id },
    billing_reason: "one_time",
    failure_message: null,
    payment_instrument: null,
    payments_failed: 0,
    recovery_url: null,
    line_items: [],
    member_id: null,
    user: opts.payer ? { id: "user_payer", email: opts.payer, name: "Payer" } : null,
    customer_email: opts.payer ?? null,
    checkout_configuration_id: opts.metadataOnly ? "ch_someone_else" : order.whop_checkout_configuration_id,
    variant_id: opts.metadataOnly ? "plan_someone_else" : order.whop_plan_id,
    promo_code_id: opts.promo ?? null,
  };
  whop.payments.set(id, p);
  return p as never;
}

describe.skipIf(!hasServerEnv)("public course orders: checkout, payment, provisioning, security", () => {
  let admin = null as unknown as ReturnType<typeof service>;
  let courses: { id: string; title: string; priceMinor: number }[] = [];
  const orderIds: string[] = [];
  const cartIds: string[] = [];
  const couponIds: string[] = [];
  const paymentIds: string[] = [];
  const extraUsers: string[] = [];

  let svc: {
    checkoutCart: typeof import("@/lib/services/commerce/orders").checkoutCart;
    expireOrder: typeof import("@/lib/services/commerce/orders").expireOrder;
    refreshOrderFromWhop: typeof import("@/lib/services/commerce/orders").refreshOrderFromWhop;
    quoteBasket: typeof import("@/lib/services/commerce/pricing").quoteBasket;
    applyPaymentObject: typeof import("@/lib/services/payments/sync").applyPaymentObject;
    loadOrder: typeof import("@/lib/services/commerce/store").loadOrder;
    loadOrderByToken: typeof import("@/lib/services/commerce/store").loadOrderByToken;
    orderAccessToken: typeof import("@/lib/services/commerce/tokens").orderAccessToken;
    acceptAccessInvitation: typeof import("@/lib/services/invoicing/acceptance").acceptAccessInvitation;
    findAccessInvitationByToken: typeof import("@/lib/services/invoicing/invitations").findAccessInvitationByToken;
  };

  async function makeCart(courseIds: string[], couponCode: string | null = null) {
    const { data, error } = await admin
      .from("public_carts")
      .insert({ token_hash: createHash("sha256").update(randomBytes(32)).digest("hex"), course_ids: courseIds, access_duration: "90", coupon_code: couponCode })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    cartIds.push(data.id);
    return data;
  }

  async function makeCoupon(values: Record<string, unknown>) {
    const { data, error } = await admin
      .from("coupons")
      .insert({ code: `IT${runId}${couponIds.length}`.toUpperCase().replace(/[^A-Z0-9]/g, ""), discount_type: "percent", amount: 10, applies_to: "packages", status: "active", ...values })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    couponIds.push(data.id);
    return data;
  }

  async function checkout(courseIds: string[], email: string, couponCode: string | null = null) {
    const cart = await makeCart(courseIds, couponCode);
    const outcome = await svc.checkoutCart(cart, { email, source: "website" });
    if (outcome.ok) orderIds.push(outcome.order.id);
    return outcome;
  }

  async function pay(id: string, order: Parameters<typeof payment>[1], opts: Parameters<typeof payment>[2]) {
    paymentIds.push(id);
    return svc.applyPaymentObject(payment(id, order, opts));
  }

  beforeAll(async () => {
    admin = service();
    const orders = await import("@/lib/services/commerce/orders");
    svc = {
      checkoutCart: orders.checkoutCart,
      expireOrder: orders.expireOrder,
      refreshOrderFromWhop: orders.refreshOrderFromWhop,
      quoteBasket: (await import("@/lib/services/commerce/pricing")).quoteBasket,
      applyPaymentObject: (await import("@/lib/services/payments/sync")).applyPaymentObject,
      loadOrder: (await import("@/lib/services/commerce/store")).loadOrder,
      loadOrderByToken: (await import("@/lib/services/commerce/store")).loadOrderByToken,
      orderAccessToken: (await import("@/lib/services/commerce/tokens")).orderAccessToken,
      acceptAccessInvitation: (await import("@/lib/services/invoicing/acceptance")).acceptAccessInvitation,
      findAccessInvitationByToken: (await import("@/lib/services/invoicing/invitations")).findAccessInvitationByToken,
    };
    // Published courses that the selector sells for 90 days (seeded prices).
    const { data: plans } = await admin
      .from("pricing_plans")
      .select("price_cents, product_id")
      .eq("in_course_selector", true)
      .eq("access_duration_days", 90)
      .eq("currency", "usd")
      .eq("visibility", "public");
    const { data: products } = await admin.from("products").select("id, course_id").eq("kind", "course").eq("status", "active").in("id", (plans ?? []).map((p) => p.product_id));
    const { data: published } = await admin
      .from("courses")
      .select("id, title")
      .eq("status", "published")
      .eq("visibility", "public")
      .eq("is_free", false)
      .in("id", (products ?? []).map((p) => p.course_id!).filter(Boolean));
    courses = (published ?? [])
      .map((c) => {
        const product = (products ?? []).find((p) => p.course_id === c.id)!;
        const plan = (plans ?? []).find((p) => p.product_id === product.id)!;
        return { id: c.id, title: c.title, priceMinor: plan.price_cents };
      })
      .slice(0, 3);
    if (courses.length < 3) throw new Error("Integration test needs three published courses with 90-day selector prices.");
  });

  afterAll(async () => {
    if (!admin) return;
    if (orderIds.length) await admin.from("public_course_orders").delete().in("id", orderIds);
    if (paymentIds.length) await admin.from("payment_transactions").delete().in("whop_payment_id", paymentIds);
    if (couponIds.length) await admin.from("coupons").delete().in("id", couponIds);
    if (cartIds.length) await admin.from("public_carts").delete().in("id", cartIds);
    for (const id of extraUsers) await admin.auth.admin.deleteUser(id);
    // The stub's shared-product id was stored under its fake account key; remove only that key.
    const { data: setting } = await admin.from("platform_settings").select("value").eq("key", "commerce.whop_package_products").maybeSingle();
    if (setting?.value && typeof setting.value === "object") {
      const next = { ...(setting.value as Record<string, string>) };
      delete next["sandbox:biz_it"];
      await admin.from("platform_settings").update({ value: next }).eq("key", "commerce.whop_package_products");
    }
    await cleanupUsers();
  });

  it("prices the basket on the server and rejects unknown courses", async () => {
    const q = await svc.quoteBasket({ courseIds: courses.map((c) => c.id), duration: "90", couponCode: null });
    expect(q.lines).toHaveLength(3);
    expect(q.subtotalMinor).toBe(courses.reduce((s, c) => s + c.priceMinor, 0));
    expect(q.blockers).toEqual([]);
    const bad = await svc.quoteBasket({ courseIds: [courses[0].id, "9b6f1c1e-1d2a-4c55-9a3b-000000000000"], duration: "90", couponCode: null });
    expect(bad.unavailable).toHaveLength(1);
    expect(bad.blockers.length).toBeGreaterThan(0);
    const cart = await makeCart([courses[0].id, "9b6f1c1e-1d2a-4c55-9a3b-000000000000"]);
    const blocked = await svc.checkoutCart(cart, { email: `it+blocked-${runId}@example.com`, source: "website" });
    expect(blocked.ok).toBe(false);
  });

  it("refuses a total the visitor wasn't shown (price manipulation)", async () => {
    const cart = await makeCart([courses[0].id]);
    const res = await svc.checkoutCart(cart, { email: `it+tamper-${runId}@example.com`, source: "website", expectedTotalMinor: 100 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("price_changed");
  });

  it("validates coupons server-side (TEST B)", async () => {
    const ids = courses.map((c) => c.id);
    const expired = await makeCoupon({ expires_at: new Date(Date.now() - 86_400_000).toISOString() });
    const disabled = await makeCoupon({ status: "disabled" });
    const restricted = await makeCoupon({ course_ids: [courses[0].id], amount: 50 });
    const exhausted = await makeCoupon({ max_redemptions: 1, redemptions_count: 1 });
    const plansOnly = await makeCoupon({ applies_to: "plans" });
    const q = (code: string) => svc.quoteBasket({ courseIds: ids, duration: "90", couponCode: code });
    expect((await q(expired.code)).coupon?.evaluation).toMatchObject({ ok: false, reason: "expired" });
    expect((await q(disabled.code)).coupon?.evaluation).toMatchObject({ ok: false, reason: "inactive" });
    expect((await q(exhausted.code)).coupon?.evaluation).toMatchObject({ ok: false, reason: "exhausted" });
    expect((await q(plansOnly.code)).coupon?.evaluation).toMatchObject({ ok: false, reason: "plans_only" });
    expect((await q("NOSUCHCODE123")).coupon?.evaluation).toMatchObject({ ok: false, reason: "not_found" });
    const r = await q(restricted.code);
    expect(r.discountMinor).toBe(Math.floor(courses[0].priceMinor / 2));
    expect(r.totalMinor).toBe(r.subtotalMinor - Math.floor(courses[0].priceMinor / 2));
    // An invalid code blocks checkout instead of silently charging full price.
    expect((await q(expired.code)).blockers.join(" ")).toMatch(/expired/i);
  });

  it("existing student: coupon, exact Whop amount, payer ≠ learner, independent access, idempotent webhooks (TESTS C, D, E)", async () => {
    const learner = await makeUser("order-existing");
    // A longer, independent purchase they already own must stay untouched.
    await admin.from("course_entitlements").insert({ user_id: learner.id, course_id: courses[0].id, scope: "course", source: "manual", grant_reason: "IT prior purchase", status: "active", expires_at: null });
    const coupon = await makeCoupon({ amount: 10, max_redemptions_per_customer: 1 });
    const res = await checkout([courses[0].id, courses[1].id], learner.email, coupon.code);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const order = res.order;
    const subtotal = courses[0].priceMinor + courses[1].priceMinor;
    expect(order.subtotal_minor).toBe(subtotal);
    expect(order.discount_minor).toBe(Math.floor(subtotal / 10));
    expect(order.status).toBe("pending_payment");
    // The Whop variant is priced at the discounted total, single use, hidden.
    const variant = whop.variants.get(order.whop_plan_id!);
    expect(variant).toMatchObject({ initial_price: order.total_minor / 100, stock: 1, visibility: "hidden", billing_type: "one_time", expiration_days: 90 });
    expect(whop.checkouts.get(order.whop_checkout_configuration_id!)?.metadata).toMatchObject({ foremint_public_order_id: order.id });
    expect(emails.some((e) => e.templateKey === "order.payment_link" && e.to === learner.email)).toBe(true);
    // Same basket again → the same order and link (no second payment instrument).
    const again = await svc.checkoutCart((await admin.from("public_carts").select("*").eq("id", order.cart_id!).single()).data!, { email: learner.email, source: "website" });
    expect(again.ok && again.order.id).toBe(order.id);

    const payId = `pay_it_${runId}_existing`;
    const total = (order.total_minor / 100).toFixed(2);
    await pay(payId, order, { amount: total, payer: `it+parent-${runId}@example.com` });
    const paid = (await svc.loadOrder(order.id))!;
    expect(paid.status).toBe("fulfilled");
    expect(paid.learner_email).toBe(learner.email);
    expect(paid.payer_email).toBe(`it+parent-${runId}@example.com`);
    expect(whop.deletedCheckouts).toContain(order.whop_checkout_configuration_id);

    const { data: ents } = await admin.from("course_entitlements").select("course_id, expires_at, status, source, public_order_id").eq("user_id", learner.id);
    const fromOrder = (ents ?? []).filter((e) => e.public_order_id === order.id);
    expect(fromOrder).toHaveLength(2);
    const expected = new Date(paid.paid_at!).getTime() + 90 * 86_400_000;
    for (const e of fromOrder) expect(Math.abs(new Date(e.expires_at!).getTime() - expected)).toBeLessThan(2000);
    expect((ents ?? []).find((e) => e.source === "manual")).toMatchObject({ status: "active", expires_at: null });

    const keysAfterFirst = new Set(emails.map((e) => e.idempotencyKey));
    expect(emails.some((e) => e.templateKey === "order.payment_confirmed")).toBe(true);
    expect(emails.some((e) => e.templateKey === "order.courses_added")).toBe(true);
    const redemptions = (await admin.from("coupons").select("redemptions_count").eq("id", coupon.id).single()).data!.redemptions_count;
    expect(redemptions).toBe(1);

    // Replayed webhook: nothing new.
    await svc.applyPaymentObject(whop.payments.get(payId) as never);
    const { count } = await admin.from("course_entitlements").select("id", { count: "exact", head: true }).eq("public_order_id", order.id);
    expect(count).toBe(2);
    expect((await admin.from("coupons").select("redemptions_count").eq("id", coupon.id).single()).data!.redemptions_count).toBe(1);
    for (const e of emails) if (!keysAfterFirst.has(e.idempotencyKey)) throw new Error(`unexpected new email ${e.templateKey}`);
    // Only one account for the email.
    const { count: accounts } = await admin.from("profile_private").select("user_id", { count: "exact", head: true }).eq("email", learner.email);
    expect(accounts).toBe(1);

    // Per-customer limit: the same email can't reuse the coupon.
    const reuse = await svc.quoteBasket({ courseIds: [courses[2].id], duration: "90", couponCode: coupon.code, email: learner.email });
    expect(reuse.coupon?.evaluation).toMatchObject({ ok: false, reason: "customer_limit" });

    // Full refund ends the access it paid for, and only that.
    await pay(payId, order, { amount: total, refunded: total });
    const refunded = (await svc.loadOrder(order.id))!;
    expect(refunded.status).toBe("refunded");
    const { data: after } = await admin.from("course_entitlements").select("status, source").eq("user_id", learner.id);
    expect((after ?? []).filter((e) => e.source === "purchase").every((e) => e.status === "revoked")).toBe(true);
    expect((after ?? []).find((e) => e.source === "manual")?.status).toBe("active");
  }, 120_000);

  it("new student: a third party pays, the learner activates and gets access (TESTS C, D)", async () => {
    const learnerEmail = `it+order-new-${runId}@example.com`;
    const res = await checkout([courses[2].id], learnerEmail);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const order = res.order;
    // The order page token resolves this order only.
    expect((await svc.loadOrderByToken(svc.orderAccessToken(order.id)))?.id).toBe(order.id);
    expect(await svc.loadOrderByToken(`${svc.orderAccessToken(order.id).slice(0, -2)}xx`)).toBeNull();

    await pay(`pay_it_${runId}_sponsor`, order, { amount: (order.total_minor / 100).toFixed(2), tax: "3.00", payer: `it+institute-${runId}@example.com` });
    const paid = (await svc.loadOrder(order.id))!;
    expect(paid.status).toBe("paid");
    expect(paid.fulfillment_status).toBe("awaiting_activation");
    expect(paid.payer_email).toBe(`it+institute-${runId}@example.com`);
    expect(paid.paid_tax_minor).toBe(300);
    const { count: before } = await admin.from("course_entitlements").select("id", { count: "exact", head: true }).eq("public_order_id", order.id);
    expect(before).toBe(0);

    const activation = emails.find((e) => e.templateKey === "order.account_activation" && e.to === learnerEmail);
    expect(activation).toBeDefined();
    expect(String(activation!.payload?.cta_url)).toMatch(/\/join\/[A-Za-z0-9_-]{40,}$/);
    expect(JSON.stringify(activation!.payload)).not.toMatch(/password/i);
    const token = String(activation!.payload!.cta_url).split("/join/")[1];
    const invitation = await svc.findAccessInvitationByToken(token);
    expect(invitation?.kind).toBe("order_activation");

    // The learner creates their own account (what /join/[token] does) and accepts.
    const { data: created } = await admin.auth.admin.createUser({ email: learnerEmail, password: `It!${runId}-Activate9`, email_confirm: true });
    extraUsers.push(created.user!.id);
    await svc.acceptAccessInvitation(invitation!, { id: created.user!.id, email: learnerEmail });
    const done = (await svc.loadOrder(order.id))!;
    expect(done.status).toBe("fulfilled");
    expect(done.learner_user_id).toBe(created.user!.id);
    const { data: ents } = await admin.from("course_entitlements").select("user_id, course_id, expires_at").eq("public_order_id", order.id);
    expect(ents).toHaveLength(1);
    expect(ents![0]).toMatchObject({ user_id: created.user!.id, course_id: courses[2].id });
    // The link can't be used twice.
    await expect(svc.acceptAccessInvitation(invitation!, { id: created.user!.id, email: learnerEmail })).rejects.toThrow();
  }, 120_000);

  it("holds wrong amounts and Whop promo codes for review; ignores forged metadata (TEST H)", async () => {
    const res = await checkout([courses[1].id], `it+review-${runId}@example.com`);
    if (!res.ok) throw new Error(res.error);
    const order = res.order;
    await pay(`pay_it_${runId}_forged`, order, { amount: (order.total_minor / 100).toFixed(2), metadataOnly: true });
    expect((await svc.loadOrder(order.id))!.status).toBe("pending_payment");

    await pay(`pay_it_${runId}_short`, order, { amount: "1.00" });
    const held = (await svc.loadOrder(order.id))!;
    expect(held.status).toBe("under_review");
    expect(held.status_reason).toMatch(/before tax/);
    const { count } = await admin.from("course_entitlements").select("id", { count: "exact", head: true }).eq("public_order_id", order.id);
    expect(count).toBe(0);

    const res2 = await checkout([courses[0].id], `it+promo-${runId}@example.com`);
    if (!res2.ok) throw new Error(res2.error);
    await pay(`pay_it_${runId}_promo`, res2.order, { amount: (res2.order.total_minor / 100).toFixed(2), promo: "promo_it" });
    expect((await svc.loadOrder(res2.order.id))!.status).toBe("under_review");
  }, 90_000);

  it("free orders (100% coupons) are fulfilled without Whop", async () => {
    const learner = await makeUser("order-free");
    const coupon = await makeCoupon({ amount: 100 });
    const res = await checkout([courses[1].id], learner.email, coupon.code);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.result.free).toBe(true);
    expect(res.order.whop_plan_id).toBeNull();
    const order = (await svc.loadOrder(res.order.id))!;
    expect(order.status).toBe("fulfilled");
    expect(order.payment_status).toBe("not_required");
  });

  it("expires unpaid links and holds a late payment for review", async () => {
    const res = await checkout([courses[2].id], `it+expire-${runId}@example.com`);
    if (!res.ok) throw new Error(res.error);
    const expired = await svc.expireOrder(res.order);
    expect(expired.status).toBe("expired");
    expect(whop.deletedCheckouts).toContain(res.order.whop_checkout_configuration_id);
    expect(whop.archivedVariants).toContain(res.order.whop_plan_id);
    await pay(`pay_it_${runId}_late`, res.order, { amount: (res.order.total_minor / 100).toFixed(2) });
    expect((await svc.loadOrder(res.order.id))!.status).toBe("under_review");
  });

  it("refreshes an order directly from Whop (missed webhook)", async () => {
    const learner = await makeUser("order-refresh");
    const res = await checkout([courses[0].id], learner.email);
    if (!res.ok) throw new Error(res.error);
    paymentIds.push(`pay_it_${runId}_refresh`);
    payment(`pay_it_${runId}_refresh`, res.order, { amount: (res.order.total_minor / 100).toFixed(2) });
    const refreshed = await svc.refreshOrderFromWhop(res.order);
    expect(refreshed.status).toBe("fulfilled");
  });
});

if (!hasServerEnv) {
  describe("public course orders", () => {
    it.skip(skipReason, () => {});
  });
}
