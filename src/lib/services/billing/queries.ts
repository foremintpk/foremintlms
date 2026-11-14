import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { escapeLike, type ListParams } from "@/lib/list-params";
import type {
  BillingDocumentRow,
  CouponRow,
  PaymentTransactionRow,
  PlanRow,
  ProductRow,
  ReconciliationLogRow,
  SubscriptionRecordRow,
  WebhookEventRow,
} from "@/lib/services/payments/types";

/**
 * Read models for billing pages. Callers MUST have run the matching guard
 * (requireUser for the learner's own data, requireAdmin for the rest):
 * these use the service role and filter explicitly.
 */

const db = () => createAdminClient();

async function namesFor(productIds: (string | null)[], planIds: (string | null)[]) {
  const pIds = [...new Set(productIds.filter(Boolean))] as string[];
  const plIds = [...new Set(planIds.filter(Boolean))] as string[];
  const [products, plans] = await Promise.all([
    pIds.length ? db().from("products").select("id, name, kind").in("id", pIds) : Promise.resolve({ data: [] }),
    plIds.length ? db().from("pricing_plans").select("id, name, plan_type, billing_period_days, price_cents, currency").in("id", plIds) : Promise.resolve({ data: [] }),
  ]);
  return {
    product: new Map(((products.data ?? []) as Pick<ProductRow, "id" | "name" | "kind">[]).map((p) => [p.id, p])),
    plan: new Map(
      ((plans.data ?? []) as Pick<PlanRow, "id" | "name" | "plan_type" | "billing_period_days" | "price_cents" | "currency">[]).map((p) => [p.id, p]),
    ),
  };
}

async function peopleFor(userIds: (string | null)[]) {
  const ids = [...new Set(userIds.filter(Boolean))] as string[];
  if (!ids.length) return new Map<string, { name: string; email: string }>();
  const [profiles, priv] = await Promise.all([
    db().from("profiles").select("id, full_name").in("id", ids),
    db().from("profile_private").select("user_id, email").in("user_id", ids),
  ]);
  const emails = new Map((priv.data ?? []).map((p) => [p.user_id as string, p.email as string]));
  return new Map((profiles.data ?? []).map((p) => [p.id as string, { name: (p.full_name as string) || "", email: emails.get(p.id as string) ?? "" }]));
}

// ---------------------------------------------------------------------------
// Learner
// ---------------------------------------------------------------------------

export interface LearnerBilling {
  subscriptions: (SubscriptionRecordRow & { productName: string; planName: string; priceCents: number | null; currency: string; periodDays: number | null })[];
  payments: (PaymentTransactionRow & { productName: string; planName: string; documents: BillingDocumentRow[] })[];
  access: { id: string; courseTitle: string; courseSlug: string | null; scope: string; source: string; expiresAt: string | null; status: string }[];
}

export async function getLearnerBilling(userId: string): Promise<LearnerBilling> {
  const [subsRes, txRes, docsRes, entRes] = await Promise.all([
    db().from("subscription_records").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    db().from("payment_transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
    db().from("billing_documents").select("*").eq("user_id", userId).order("issued_at", { ascending: false }),
    db()
      .from("course_entitlements")
      .select("id, course_id, scope, source, status, expires_at")
      .eq("user_id", userId)
      .in("status", ["active", "suspended"])
      .order("expires_at", { ascending: true, nullsFirst: false }),
  ]);
  const subs = (subsRes.data ?? []) as SubscriptionRecordRow[];
  const txs = (txRes.data ?? []) as PaymentTransactionRow[];
  const docs = (docsRes.data ?? []) as BillingDocumentRow[];
  const names = await namesFor([...subs.map((s) => s.product_id), ...txs.map((t) => t.product_id)], [...subs.map((s) => s.plan_id), ...txs.map((t) => t.plan_id)]);

  const ents = (entRes.data ?? []) as { id: string; course_id: string | null; scope: string; source: string; status: string; expires_at: string | null }[];
  const courseIds = [...new Set(ents.map((e) => e.course_id).filter(Boolean))] as string[];
  const { data: courses } = courseIds.length ? await db().from("courses").select("id, title, slug").in("id", courseIds) : { data: [] };
  const courseById = new Map((courses ?? []).map((c) => [c.id as string, c as { id: string; title: string; slug: string }]));

  return {
    subscriptions: subs.map((s) => {
      const plan = s.plan_id ? names.plan.get(s.plan_id) : undefined;
      return {
        ...s,
        productName: (s.product_id && names.product.get(s.product_id)?.name) || "Subscription",
        planName: plan?.name ?? "",
        priceCents: plan?.price_cents ?? null,
        currency: plan?.currency ?? "usd",
        periodDays: plan?.billing_period_days ?? null,
      };
    }),
    payments: txs.map((t) => ({
      ...t,
      productName: (t.product_id && names.product.get(t.product_id)?.name) || "Purchase",
      planName: (t.plan_id && names.plan.get(t.plan_id)?.name) || "",
      documents: docs.filter((d) => d.transaction_id === t.id),
    })),
    access: ents
      .filter((e) => e.status === "active" || e.status === "suspended")
      .filter((e) => !e.expires_at || new Date(e.expires_at).getTime() > Date.now())
      .map((e) => ({
        id: e.id,
        courseTitle: e.scope === "all_access" ? "All courses" : courseById.get(e.course_id ?? "")?.title ?? "Course",
        courseSlug: e.scope === "all_access" ? null : courseById.get(e.course_id ?? "")?.slug ?? null,
        scope: e.scope,
        source: e.source,
        expiresAt: e.expires_at,
        status: e.status,
      })),
  };
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export type AdminPayment = PaymentTransactionRow & { productName: string; planName: string; customerName: string; customerEmail: string };

export async function listPayments(params: ListParams): Promise<{ rows: AdminPayment[]; total: number }> {
  let q = db().from("payment_transactions").select("*", { count: "exact" });
  if (params.filters.status) {
    if (params.filters.status === "unmatched") q = q.is("user_id", null);
    else q = q.eq("status", params.filters.status);
  }
  if (params.filters.reason) q = q.eq("billing_reason", params.filters.reason);
  if (params.filters.from) q = q.gte("created_at", new Date(params.filters.from).toISOString());
  if (params.filters.to) q = q.lt("created_at", new Date(new Date(params.filters.to).getTime() + 86_400_000).toISOString());
  if (params.q) {
    const term = escapeLike(params.q);
    const { data: people } = await db().from("profile_private").select("user_id").ilike("email", `%${term}%`).limit(50);
    const ids = (people ?? []).map((p) => p.user_id as string);
    q = q.or([`whop_payment_id.ilike.%${term}%`, `whop_membership_id.ilike.%${term}%`, ...(ids.length ? [`user_id.in.(${ids.join(",")})`] : [])].join(","));
  }
  const sortCol = params.sort === "total" ? "total_cents" : params.sort === "paid" ? "paid_at" : "created_at";
  const { data, count } = await q.order(sortCol, { ascending: params.dir === "asc", nullsFirst: false }).range(params.from, params.to);
  const rows = (data ?? []) as PaymentTransactionRow[];
  const [names, people] = await Promise.all([namesFor(rows.map((r) => r.product_id), rows.map((r) => r.plan_id)), peopleFor(rows.map((r) => r.user_id))]);
  return {
    total: count ?? 0,
    rows: rows.map((r) => ({
      ...r,
      productName: (r.product_id && names.product.get(r.product_id)?.name) || "—",
      planName: (r.plan_id && names.plan.get(r.plan_id)?.name) || "",
      customerName: (r.user_id && people.get(r.user_id)?.name) || "",
      customerEmail: (r.user_id && people.get(r.user_id)?.email) || "",
    })),
  };
}

export async function getPaymentDetail(id: string) {
  const { data } = await db().from("payment_transactions").select("*").eq("id", id).maybeSingle();
  const tx = data as PaymentTransactionRow | null;
  if (!tx) return null;
  const [names, people, docs, ents, events, sub, session] = await Promise.all([
    namesFor([tx.product_id], [tx.plan_id]),
    peopleFor([tx.user_id]),
    db().from("billing_documents").select("*").eq("transaction_id", tx.id).order("issued_at"),
    db().from("course_entitlements").select("id, course_id, scope, status, starts_at, expires_at, revoke_reason, source").or(
      [`payment_transaction_id.eq.${tx.id}`, ...(tx.subscription_record_id ? [`subscription_record_id.eq.${tx.subscription_record_id}`] : [])].join(","),
    ),
    db().from("webhook_events").select("id, event_type, status, received_at, last_error").eq("provider", "whop").contains("payload", { data: { id: tx.whop_payment_id } }).order("received_at", { ascending: false }).limit(20),
    tx.subscription_record_id ? db().from("subscription_records").select("*").eq("id", tx.subscription_record_id).maybeSingle() : Promise.resolve({ data: null }),
    tx.checkout_session_id ? db().from("checkout_sessions").select("*").eq("id", tx.checkout_session_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const entRows = (ents.data ?? []) as { id: string; course_id: string | null; scope: string; status: string; starts_at: string; expires_at: string | null; revoke_reason: string | null; source: string }[];
  const courseIds = [...new Set(entRows.map((e) => e.course_id).filter(Boolean))] as string[];
  const { data: courses } = courseIds.length ? await db().from("courses").select("id, title").in("id", courseIds) : { data: [] };
  const titles = new Map((courses ?? []).map((c) => [c.id as string, c.title as string]));
  return {
    tx,
    productName: (tx.product_id && names.product.get(tx.product_id)?.name) || "—",
    planName: (tx.plan_id && names.plan.get(tx.plan_id)?.name) || "—",
    customer: tx.user_id ? people.get(tx.user_id) ?? null : null,
    documents: (docs.data ?? []) as BillingDocumentRow[],
    entitlements: entRows.map((e) => ({ ...e, courseTitle: e.scope === "all_access" ? "All courses" : titles.get(e.course_id ?? "") ?? "Course" })),
    events: (events.data ?? []) as Pick<WebhookEventRow, "id" | "event_type" | "status" | "received_at" | "last_error">[],
    subscription: (sub.data as SubscriptionRecordRow | null) ?? null,
    session: session.data as { id: string; status: string; created_at: string } | null,
  };
}

export type AdminDocument = BillingDocumentRow & { customerName: string; customerEmail: string; whopPaymentId: string | null };

export async function listDocuments(params: ListParams): Promise<{ rows: AdminDocument[]; total: number }> {
  let q = db().from("billing_documents").select("*", { count: "exact" });
  if (params.filters.type) q = q.eq("document_type", params.filters.type);
  if (params.filters.issuer) q = q.eq("issuer", params.filters.issuer);
  if (params.filters.status) q = q.eq("status", params.filters.status);
  if (params.q) q = q.ilike("number", `%${escapeLike(params.q)}%`);
  const { data, count } = await q.order("issued_at", { ascending: params.dir === "asc" }).range(params.from, params.to);
  const rows = (data ?? []) as BillingDocumentRow[];
  const txIds = [...new Set(rows.map((r) => r.transaction_id).filter(Boolean))] as string[];
  const [people, txs] = await Promise.all([
    peopleFor(rows.map((r) => r.user_id)),
    txIds.length ? db().from("payment_transactions").select("id, whop_payment_id").in("id", txIds) : Promise.resolve({ data: [] }),
  ]);
  const whopIds = new Map((txs.data ?? []).map((t) => [t.id as string, t.whop_payment_id as string]));
  return {
    total: count ?? 0,
    rows: rows.map((r) => ({
      ...r,
      customerName: (r.user_id && people.get(r.user_id)?.name) || "",
      customerEmail: (r.user_id && people.get(r.user_id)?.email) || "",
      whopPaymentId: r.transaction_id ? whopIds.get(r.transaction_id) ?? null : null,
    })),
  };
}

export type AdminSubscription = SubscriptionRecordRow & { productName: string; planName: string; customerName: string; customerEmail: string; priceCents: number | null; currency: string; periodDays: number | null };

export async function listSubscriptions(params: ListParams): Promise<{ rows: AdminSubscription[]; total: number }> {
  let q = db().from("subscription_records").select("*", { count: "exact" });
  if (params.filters.status) q = q.eq("status", params.filters.status);
  if (params.q) q = q.ilike("whop_membership_id", `%${escapeLike(params.q)}%`);
  const sortCol = params.sort === "period_end" ? "current_period_end" : "created_at";
  const { data, count } = await q.order(sortCol, { ascending: params.dir === "asc", nullsFirst: false }).range(params.from, params.to);
  const rows = (data ?? []) as SubscriptionRecordRow[];
  const [names, people] = await Promise.all([namesFor(rows.map((r) => r.product_id), rows.map((r) => r.plan_id)), peopleFor(rows.map((r) => r.user_id))]);
  return {
    total: count ?? 0,
    rows: rows.map((r) => {
      const plan = r.plan_id ? names.plan.get(r.plan_id) : undefined;
      return {
        ...r,
        productName: (r.product_id && names.product.get(r.product_id)?.name) || "—",
        planName: plan?.name ?? "",
        priceCents: plan?.price_cents ?? null,
        currency: plan?.currency ?? "usd",
        periodDays: plan?.billing_period_days ?? null,
        customerName: (r.user_id && people.get(r.user_id)?.name) || "",
        customerEmail: (r.user_id && people.get(r.user_id)?.email) || "",
      };
    }),
  };
}

export async function subscriptionStatusCounts(): Promise<Record<string, number>> {
  const { data } = await db().from("subscription_records").select("status");
  const counts: Record<string, number> = {};
  for (const row of data ?? []) counts[row.status as string] = (counts[row.status as string] ?? 0) + 1;
  return counts;
}

export async function listWebhookEvents(params: ListParams): Promise<{ rows: WebhookEventRow[]; total: number }> {
  let q = db().from("webhook_events").select("id, provider, event_id, event_type, status, attempts, last_error, received_at, processed_at, next_attempt_at", { count: "exact" }).eq("provider", "whop");
  if (params.filters.status) q = q.eq("status", params.filters.status);
  if (params.q) q = q.or(`event_type.ilike.%${escapeLike(params.q)}%,event_id.ilike.%${escapeLike(params.q)}%`);
  const { data, count } = await q.order("received_at", { ascending: false }).range(params.from, params.to);
  return { rows: (data ?? []) as unknown as WebhookEventRow[], total: count ?? 0 };
}

export async function listReconciliationLogs(limit = 30): Promise<ReconciliationLogRow[]> {
  const { data } = await db().from("payment_reconciliation_logs").select("*").order("started_at", { ascending: false }).limit(limit);
  return (data ?? []) as unknown as ReconciliationLogRow[];
}

export interface PricingOverviewCourse {
  id: string;
  title: string;
  status: string;
  product: (ProductRow & { plans: PlanRow[] }) | null;
}

export async function getPricingOverview(search: string): Promise<{ courses: PricingOverviewCourse[]; groups: (ProductRow & { plans: PlanRow[]; courseCount: number })[] }> {
  let courseQuery = db().from("courses").select("id, title, status").order("title");
  if (search) courseQuery = courseQuery.ilike("title", `%${escapeLike(search)}%`);
  const [coursesRes, productsRes, plansRes, pcRes] = await Promise.all([
    courseQuery,
    db().from("products").select("*").order("sort_order").order("created_at"),
    db().from("pricing_plans").select("*").order("sort_order").order("created_at"),
    db().from("product_courses").select("product_id, course_id"),
  ]);
  const plans = (plansRes.data ?? []) as PlanRow[];
  const products = ((productsRes.data ?? []) as ProductRow[]).map((p) => ({ ...p, plans: plans.filter((pl) => pl.product_id === p.id) }));
  const byCourse = new Map(products.filter((p) => p.kind === "course" && p.course_id).map((p) => [p.course_id as string, p]));
  const pc = (pcRes.data ?? []) as { product_id: string; course_id: string }[];
  return {
    courses: ((coursesRes.data ?? []) as { id: string; title: string; status: string }[]).map((c) => ({ ...c, product: byCourse.get(c.id) ?? null })),
    groups: products
      .filter((p) => p.kind !== "course")
      .map((p) => ({ ...p, courseCount: pc.filter((r) => r.product_id === p.id).length })),
  };
}

export async function getProductWithPlans(productId: string) {
  const { data } = await db().from("products").select("*").eq("id", productId).maybeSingle();
  const product = data as ProductRow | null;
  if (!product) return null;
  const [plansRes, pcRes, bundleRes] = await Promise.all([
    db().from("pricing_plans").select("*").eq("product_id", productId).order("sort_order").order("created_at"),
    db().from("product_courses").select("course_id, sort_order").eq("product_id", productId).order("sort_order"),
    db().from("course_bundles").select("*").eq("product_id", productId).maybeSingle(),
  ]);
  const courseIds = ((pcRes.data ?? []) as { course_id: string }[]).map((r) => r.course_id);
  const { data: courses } = courseIds.length ? await db().from("courses").select("id, title, status, slug").in("id", courseIds) : { data: [] };
  const byId = new Map((courses ?? []).map((c) => [c.id as string, c as { id: string; title: string; status: string; slug: string }]));
  return {
    product,
    plans: (plansRes.data ?? []) as PlanRow[],
    courses: courseIds.map((id) => byId.get(id)).filter(Boolean) as { id: string; title: string; status: string; slug: string }[],
    bundle: (bundleRes.data as { id: string; headline: string | null; highlights: string[] } | null) ?? null,
  };
}

export async function listAllCourses() {
  const { data } = await db().from("courses").select("id, title, status").order("title");
  return (data ?? []) as { id: string; title: string; status: string }[];
}

export async function listCoupons(): Promise<CouponRow[]> {
  const { data } = await db().from("coupons").select("*").order("created_at", { ascending: false });
  return (data ?? []) as CouponRow[];
}

/** Courses a course-package coupon can be limited to (published and paid). */
export async function listCoursesForCouponSelect(): Promise<{ id: string; title: string }[]> {
  const { data } = await db().from("courses").select("id, title").eq("status", "published").eq("is_free", false).order("title");
  return (data ?? []) as { id: string; title: string }[];
}

export async function listPaidPlansForSelect() {
  const { data } = await db().from("pricing_plans").select("id, name, plan_type, product_id, whop_plan_id, visibility").neq("plan_type", "free").neq("visibility", "archived");
  const rows = (data ?? []) as Pick<PlanRow, "id" | "name" | "plan_type" | "product_id" | "whop_plan_id" | "visibility">[];
  const names = await namesFor(rows.map((r) => r.product_id), []);
  return rows.map((r) => ({ ...r, label: `${names.product.get(r.product_id)?.name ?? "Product"} — ${r.name}` }));
}
