import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { escapeLike } from "@/lib/list-params";
import { DURATION_PRESETS, durationKeyFromDays, sortDurations, type DurationKey } from "@/lib/domain/commerce";
import type { Tables } from "@/types/database";
import { getSelectorSettings } from "./settings";
import type { OrderItemRow, OrderRow } from "./store";

/**
 * Admin read models for course-package orders and public course pricing.
 * Service role: callers must have checked `requireAdmin` / `assertAdmin`.
 * Token hashes are never selected.
 */

const db = () => createAdminClient();

const ORDER_LIST_COLUMNS =
  "id, order_number, source, learner_email, payer_email, learner_user_id, currency, duration_days, subtotal_minor, discount_minor, total_minor, coupon_code_snapshot, status, payment_status, fulfillment_status, status_reason, created_at, paid_at, fulfilled_at, expires_at";

export type OrderListRow = Pick<
  OrderRow,
  | "id"
  | "order_number"
  | "source"
  | "learner_email"
  | "payer_email"
  | "learner_user_id"
  | "currency"
  | "duration_days"
  | "subtotal_minor"
  | "discount_minor"
  | "total_minor"
  | "coupon_code_snapshot"
  | "status"
  | "payment_status"
  | "fulfillment_status"
  | "status_reason"
  | "created_at"
  | "paid_at"
  | "fulfilled_at"
  | "expires_at"
> & { itemCount: number; courseTitles: string[] };

export interface OrderListQuery {
  page: number;
  pageSize: number;
  q: string;
  status?: string | null;
  source?: string | null;
  payment?: string | null;
}

export async function listOrders(query: OrderListQuery): Promise<{ rows: OrderListRow[]; total: number }> {
  let q = db().from("public_course_orders").select(ORDER_LIST_COLUMNS, { count: "exact" });
  if (query.status) q = q.eq("status", query.status);
  if (query.source) q = q.eq("source", query.source);
  if (query.payment) q = q.eq("payment_status", query.payment);
  if (query.q) {
    const term = escapeLike(query.q);
    q = q.or(`order_number.ilike.%${term}%,learner_email.ilike.%${term}%,payer_email.ilike.%${term}%`);
  }
  const from = (query.page - 1) * query.pageSize;
  const { data, count, error } = await q.order("created_at", { ascending: false }).range(from, from + query.pageSize - 1);
  if (error) throw new Error(`orders list failed: ${error.message}`);
  const rows = (data ?? []) as Omit<OrderListRow, "itemCount" | "courseTitles">[];
  const ids = rows.map((r) => r.id);
  const { data: items } = ids.length
    ? await db().from("public_course_order_items").select("order_id, course_title_snapshot, sort_order").in("order_id", ids).order("sort_order")
    : { data: [] };
  const byOrder = new Map<string, string[]>();
  for (const it of items ?? []) byOrder.set(it.order_id, [...(byOrder.get(it.order_id) ?? []), it.course_title_snapshot]);
  return {
    rows: rows.map((r) => ({ ...r, itemCount: byOrder.get(r.id)?.length ?? 0, courseTitles: byOrder.get(r.id) ?? [] })),
    total: count ?? rows.length,
  };
}

export interface OrderKpis {
  orders30d: number;
  paid30d: number;
  revenue30dMinor: number;
  revenueCurrency: string;
  awaitingActivation: number;
  needsAttention: number;
}

export async function getOrderKpis(now = new Date()): Promise<OrderKpis> {
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const admin = db();
  const [{ count: orders30d }, { data: paid }, { count: awaiting }, { count: attention }, settings] = await Promise.all([
    admin.from("public_course_orders").select("id", { count: "exact", head: true }).gte("created_at", since),
    admin.from("public_course_orders").select("paid_amount_minor, total_minor, currency, status").gte("paid_at", since).not("paid_at", "is", null),
    admin.from("public_course_orders").select("id", { count: "exact", head: true }).eq("fulfillment_status", "awaiting_activation").in("status", ["paid", "partially_refunded"]),
    admin.from("public_course_orders").select("id", { count: "exact", head: true }).in("status", ["under_review", "fulfillment_pending"]),
    getSelectorSettings(),
  ]);
  const currency = settings.currency;
  const settled = (paid ?? []).filter((p) => p.status !== "refunded" && p.currency === currency);
  return {
    orders30d: orders30d ?? 0,
    paid30d: (paid ?? []).length,
    revenue30dMinor: settled.reduce((s, p) => s + Number(p.paid_amount_minor ?? p.total_minor ?? 0), 0),
    revenueCurrency: currency,
    awaitingActivation: awaiting ?? 0,
    needsAttention: attention ?? 0,
  };
}

export interface OrderDetail {
  order: OrderRow;
  items: OrderItemRow[];
  events: Tables<"public_course_order_events">[];
  transaction: Pick<
    Tables<"payment_transactions">,
    "id" | "whop_payment_id" | "status" | "currency" | "subtotal_cents" | "tax_cents" | "total_cents" | "refunded_cents" | "card_brand" | "card_last4" | "paid_at" | "promo_code"
  > | null;
  entitlements: {
    id: string;
    course_id: string | null;
    course_title: string | null;
    user_id: string;
    status: string;
    starts_at: string;
    expires_at: string | null;
    revoke_reason: string | null;
  }[];
  invitations: { id: string; email: string; status: string; send_count: number; expires_at: string; accepted_at: string | null; last_sent_at: string; created_at: string }[];
  learner: { id: string; full_name: string | null; email: string | null } | null;
}

export async function getOrderDetail(id: string): Promise<OrderDetail | null> {
  const admin = db();
  const { data: orderData } = await admin.from("public_course_orders").select("*").eq("id", id).maybeSingle();
  if (!orderData) return null;
  const order = orderData as OrderRow;
  const [items, events, tx, ents, invites, profile, priv] = await Promise.all([
    admin.from("public_course_order_items").select("*").eq("order_id", id).order("sort_order"),
    admin.from("public_course_order_events").select("*").eq("order_id", id).order("created_at", { ascending: false }).limit(100),
    admin
      .from("payment_transactions")
      .select("id, whop_payment_id, status, currency, subtotal_cents, tax_cents, total_cents, refunded_cents, card_brand, card_last4, paid_at, promo_code")
      .eq("public_order_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from("course_entitlements").select("id, course_id, user_id, status, starts_at, expires_at, revoke_reason, courses(title)").eq("public_order_id", id).order("created_at"),
    admin.from("access_invitations").select("id, email, status, send_count, expires_at, accepted_at, last_sent_at, created_at").eq("public_order_id", id).order("created_at", { ascending: false }),
    order.learner_user_id ? admin.from("profiles").select("id, full_name").eq("id", order.learner_user_id).maybeSingle() : Promise.resolve({ data: null }),
    order.learner_user_id ? admin.from("profile_private").select("email").eq("user_id", order.learner_user_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  type EntRow = { id: string; course_id: string | null; user_id: string; status: string; starts_at: string; expires_at: string | null; revoke_reason: string | null; courses: { title: string } | null };
  return {
    order,
    items: (items.data ?? []) as OrderItemRow[],
    events: (events.data ?? []) as Tables<"public_course_order_events">[],
    transaction: (tx.data as OrderDetail["transaction"]) ?? null,
    entitlements: ((ents.data ?? []) as unknown as EntRow[]).map((e) => ({
      id: e.id,
      course_id: e.course_id,
      course_title: e.courses?.title ?? null,
      user_id: e.user_id,
      status: e.status,
      starts_at: e.starts_at,
      expires_at: e.expires_at,
      revoke_reason: e.revoke_reason,
    })),
    invitations: (invites.data ?? []) as OrderDetail["invitations"],
    learner: profile.data ? { id: profile.data.id, full_name: profile.data.full_name ?? null, email: (priv.data?.email as string | undefined) ?? null } : null,
  };
}

// ---------------------------------------------------------------------------
// Public course pricing (Admin → Public course pricing)
// ---------------------------------------------------------------------------

export interface SelectorPriceCell {
  planId: string;
  priceMinor: number;
  compareAtMinor: number | null;
  promoLabel: string | null;
  visibility: string;
  inSelector: boolean;
  unitsSold: number;
}

export interface PricingMatrixRow {
  courseId: string;
  title: string;
  slug: string;
  status: string;
  visibility: string;
  isFree: boolean;
  isFeatured: boolean;
  productId: string | null;
  productStatus: string | null;
  /** Selector prices (in_course_selector) by access period, in the selector currency. */
  cells: Record<DurationKey, SelectorPriceCell>;
  /** Other one-time public plans that could be offered in the selector, by period. */
  candidates: Record<DurationKey, SelectorPriceCell>;
}

export async function getPricingMatrix(): Promise<{ rows: PricingMatrixRow[]; durations: DurationKey[]; currency: string }> {
  const settings = await getSelectorSettings();
  const admin = db();
  const [{ data: courses, error }, { data: products }] = await Promise.all([
    admin.from("courses").select("id, title, slug, status, visibility, is_free, is_featured, sort_order").neq("status", "archived").order("sort_order").order("title"),
    admin
      .from("products")
      .select("id, course_id, status, pricing_plans(id, plan_type, currency, price_cents, compare_at_price_cents, access_duration_days, visibility, in_course_selector, promo_label, units_sold)")
      .eq("kind", "course"),
  ]);
  if (error) throw new Error(`pricing matrix failed: ${error.message}`);
  type PlanLite = {
    id: string;
    plan_type: string;
    currency: string;
    price_cents: number;
    compare_at_price_cents: number | null;
    access_duration_days: number | null;
    visibility: string;
    in_course_selector: boolean;
    promo_label: string | null;
    units_sold: number;
  };
  const byCourse = new Map<string, { id: string; status: string; plans: PlanLite[] }>();
  for (const p of (products ?? []) as unknown as { id: string; course_id: string | null; status: string; pricing_plans: PlanLite[] | null }[]) {
    if (p.course_id) byCourse.set(p.course_id, { id: p.id, status: p.status, plans: p.pricing_plans ?? [] });
  }
  const durations = sortDurations(settings.durations.length ? settings.durations : DURATION_PRESETS);
  const rows: PricingMatrixRow[] = (courses ?? []).map((c) => {
    const product = byCourse.get(c.id);
    const cells: Record<DurationKey, SelectorPriceCell> = {};
    const candidates: Record<DurationKey, SelectorPriceCell> = {};
    for (const plan of product?.plans ?? []) {
      if (plan.plan_type !== "one_time" || plan.visibility === "archived" || plan.currency.toLowerCase() !== settings.currency) continue;
      const key = durationKeyFromDays(plan.access_duration_days);
      const cell: SelectorPriceCell = {
        planId: plan.id,
        priceMinor: plan.price_cents,
        compareAtMinor: plan.compare_at_price_cents,
        promoLabel: plan.promo_label,
        visibility: plan.visibility,
        inSelector: plan.in_course_selector,
        unitsSold: plan.units_sold,
      };
      if (plan.in_course_selector) cells[key] = cell;
      else if (plan.visibility === "public" && !candidates[key]) candidates[key] = cell;
    }
    return {
      courseId: c.id,
      title: c.title,
      slug: c.slug,
      status: c.status,
      visibility: c.visibility,
      isFree: c.is_free,
      isFeatured: c.is_featured,
      productId: product?.id ?? null,
      productStatus: product?.status ?? null,
      cells,
      candidates,
    };
  });
  return { rows, durations, currency: settings.currency };
}
