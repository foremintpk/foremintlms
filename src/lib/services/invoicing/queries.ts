import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { escapeLike, type ListParams } from "@/lib/list-params";
import type { CourseSnapshotItem } from "@/lib/domain/invoicing";
import type { Tables } from "@/types/database";
import type { InvoiceEntitlementRow } from "./access";
import type { AccessInvitationRow } from "./invitations";
import type { CustomInvoiceRow, WhopInvoiceMappingRow } from "./whop-invoices";

/**
 * Admin read models for Billing & invoicing. Callers must have verified an
 * administrator (requireAdmin) before using these; they use the service
 * role so internal notes and provider ids are available to staff only.
 */

const db = () => createAdminClient();

async function profilesById(ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter(Boolean))] as string[];
  if (!unique.length) return new Map<string, { name: string; email: string }>();
  const [{ data: profiles }, { data: priv }] = await Promise.all([
    db().from("profiles").select("id, full_name").in("id", unique),
    db().from("profile_private").select("user_id, email").in("user_id", unique),
  ]);
  const emails = new Map((priv ?? []).map((p) => [p.user_id, p.email as string]));
  return new Map(unique.map((id) => [id, { name: (profiles ?? []).find((p) => p.id === id)?.full_name || "", email: emails.get(id) ?? "" }]));
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export type InvoiceListRow = CustomInvoiceRow & { mapping: Pick<WhopInvoiceMappingRow, "payment_url" | "whop_invoice_id" | "whop_invoice_number" | "environment"> | null; creatorName: string };

export async function listCustomInvoices(params: ListParams): Promise<{ rows: InvoiceListRow[]; total: number }> {
  let query = db()
    .from("custom_invoices")
    .select("*, whop_invoice_mappings(payment_url, whop_invoice_id, whop_invoice_number, environment)", { count: "exact" });
  const f = params.filters;
  if (f.type) query = query.eq("invoice_type", f.type);
  if (f.status) query = f.status === "open" ? query.in("status", ["awaiting_payment", "past_due", "failed"]) : query.eq("status", f.status);
  if (f.currency) query = query.eq("currency", f.currency);
  if (f.billing) query = query.eq("billing_type", f.billing);
  if (f.company) query = query.eq("company_id", f.company);
  if (f.course) query = query.contains("course_ids", [f.course]);
  if (f.creator) query = query.eq("created_by", f.creator);
  if (f.from) query = query.gte("created_at", `${f.from}T00:00:00Z`);
  if (f.to) query = query.lte("created_at", `${f.to}T23:59:59Z`);
  if (params.q) {
    const q = escapeLike(params.q);
    query = query.or(`invoice_number.ilike.%${q}%,customer_name.ilike.%${q}%,customer_email.ilike.%${q}%,company_name.ilike.%${q}%,invoice_description.ilike.%${q}%`);
  }
  const sort = params.sort ?? "created_at";
  const { data, count, error } = await query.order(sort, { ascending: params.dir === "asc", nullsFirst: false }).range(params.from, params.to);
  if (error) throw new Error(`invoice list failed: ${error.message}`);
  const creators = await profilesById((data ?? []).map((r) => r.created_by));
  return {
    rows: (data ?? []).map((r) => {
      const { whop_invoice_mappings, ...inv } = r as CustomInvoiceRow & { whop_invoice_mappings: InvoiceListRow["mapping"] | InvoiceListRow["mapping"][] };
      const mapping = Array.isArray(whop_invoice_mappings) ? (whop_invoice_mappings[0] ?? null) : whop_invoice_mappings;
      return { ...inv, mapping, creatorName: r.created_by ? (creators.get(r.created_by)?.name ?? "") : "" };
    }),
    total: count ?? 0,
  };
}

export async function listInvoiceCreators(): Promise<{ id: string; name: string }[]> {
  const { data } = await db().from("custom_invoices").select("created_by").not("created_by", "is", null).limit(500);
  const map = await profilesById((data ?? []).map((d) => d.created_by));
  return [...map.entries()].map(([id, p]) => ({ id, name: p.name || p.email }));
}

export async function getInvoiceDetail(id: string) {
  const admin = db();
  const { data: invoice } = await admin.from("custom_invoices").select("*").eq("id", id).maybeSingle();
  if (!invoice) return null;
  const inv = invoice as CustomInvoiceRow;
  const [mappingRes, eventsRes, paymentsRes, entRes, invitesRes, revisionsRes] = await Promise.all([
    admin.from("whop_invoice_mappings").select("*").eq("local_invoice_id", id).maybeSingle(),
    admin.from("custom_invoice_events").select("*").eq("invoice_id", id).order("created_at", { ascending: false }).limit(200),
    admin.from("payment_transactions").select("id, whop_payment_id, status, billing_reason, currency, total_cents, tax_cents, refunded_cents, paid_at, created_at, failure_reason").eq("custom_invoice_id", id).order("created_at", { ascending: false }),
    admin.from("invoice_entitlements").select("*").eq("invoice_id", id).maybeSingle(),
    admin.from("access_invitations").select("id, kind, email, status, expires_at, accepted_at, send_count, last_sent_at, company_id").or(`invoice_id.eq.${id}${inv.company_id ? `,and(company_id.eq.${inv.company_id},kind.eq.company_contact)` : ""}`).order("created_at", { ascending: false }),
    admin.from("custom_invoices").select("id, invoice_number, status").or(`revision_of.eq.${id}${inv.revision_of ? `,id.eq.${inv.revision_of}` : ""}`),
  ]);
  const events = (eventsRes.data ?? []) as Tables<"custom_invoice_events">[];
  const people = await profilesById([inv.created_by, inv.customer_user_id, ...events.map((e) => e.actor_id)]);
  const company = inv.company_id ? (await admin.from("companies").select("id, name, status, access_status, primary_contact_user_id").eq("id", inv.company_id).maybeSingle()).data : null;
  return {
    invoice: inv,
    mapping: (mappingRes.data as WhopInvoiceMappingRow | null) ?? null,
    events: events.map((e) => ({ ...e, actorName: e.actor_id ? (people.get(e.actor_id)?.name || people.get(e.actor_id)?.email || "Administrator") : "System" })),
    payments: paymentsRes.data ?? [],
    entitlement: (entRes.data as InvoiceEntitlementRow | null) ?? null,
    invitations: (invitesRes.data ?? []) as Pick<AccessInvitationRow, "id" | "kind" | "email" | "status" | "expires_at" | "accepted_at" | "send_count" | "last_sent_at" | "company_id">[],
    company,
    creator: inv.created_by ? people.get(inv.created_by) ?? null : null,
    customerAccount: inv.customer_user_id ? people.get(inv.customer_user_id) ?? null : null,
    related: (revisionsRes.data ?? []).filter((r) => r.id !== id),
    courses: (inv.selected_course_snapshot as unknown as CourseSnapshotItem[]) ?? [],
  };
}
export type InvoiceDetail = NonNullable<Awaited<ReturnType<typeof getInvoiceDetail>>>;

// ---------------------------------------------------------------------------
// Builder data
// ---------------------------------------------------------------------------

export interface BuilderCourse {
  id: string;
  title: string;
  category: string | null;
  categoryId: string | null;
  instructor: string | null;
  status: string;
}

export async function getInvoiceBuilderData() {
  const admin = db();
  const [{ data: courses }, { data: categories }, { data: instructors }, { data: companies }] = await Promise.all([
    admin.from("courses").select("id, title, status, category_id").in("status", ["published", "in_review", "draft", "unpublished", "scheduled"]).order("title"),
    admin.from("course_categories").select("id, name").order("name"),
    admin.from("course_instructors").select("course_id, user_id, role"),
    admin.from("companies").select("id, name, primary_contact_email, status").neq("status", "archived").order("name").limit(500),
  ]);
  const people = await profilesById((instructors ?? []).map((i) => i.user_id));
  const catName = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const list: BuilderCourse[] = (courses ?? []).map((c) => {
    const lead = (instructors ?? []).find((i) => i.course_id === c.id && i.role === "lead") ?? (instructors ?? []).find((i) => i.course_id === c.id);
    return { id: c.id, title: c.title, status: c.status, categoryId: c.category_id, category: c.category_id ? (catName.get(c.category_id) ?? null) : null, instructor: lead ? people.get(lead.user_id)?.name || null : null };
  });
  return { courses: list, categories: categories ?? [], companies: companies ?? [] };
}

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

export async function listCompanies(params: ListParams) {
  const admin = db();
  let query = admin.from("companies").select("*", { count: "exact" });
  const f = params.filters;
  if (f.status === "active" || f.status === "expired" || f.status === "pending") query = query.eq("access_status", f.status).eq("status", "active");
  else if (f.status === "suspended" || f.status === "archived") query = query.eq("status", f.status);
  else query = query.neq("status", "archived");
  if (params.q) {
    const q = escapeLike(params.q);
    const { data: viaInvoice } = await admin.from("custom_invoices").select("company_id").ilike("invoice_number", `%${q}%`).not("company_id", "is", null).limit(20);
    const ids = (viaInvoice ?? []).map((r) => r.company_id).filter(Boolean);
    query = query.or([`name.ilike.%${q}%`, `primary_contact_email.ilike.%${q}%`, `primary_contact_name.ilike.%${q}%`, ...(ids.length ? [`id.in.(${ids.join(",")})`] : [])].join(","));
  }
  const { data, count } = await query.order(params.sort ?? "created_at", { ascending: params.dir === "asc" }).range(params.from, params.to);
  const companyIds = (data ?? []).map((c) => c.id);
  const [{ data: members }, { data: ents }] = await Promise.all([
    companyIds.length ? admin.from("company_members").select("company_id").in("company_id", companyIds).eq("membership_status", "active") : Promise.resolve({ data: [] as { company_id: string }[] }),
    companyIds.length ? admin.from("invoice_entitlements").select("company_id, expires_at, status").in("company_id", companyIds) : Promise.resolve({ data: [] as { company_id: string | null; expires_at: string | null; status: string }[] }),
  ]);
  return {
    rows: (data ?? []).map((c) => {
      const active = (ents ?? []).filter((e) => e.company_id === c.id && e.status === "active");
      const ends = active.map((e) => e.expires_at);
      return {
        ...(c as Tables<"companies">),
        memberCount: (members ?? []).filter((m) => m.company_id === c.id).length,
        accessEndsAt: ends.includes(null) ? null : ends.sort().at(-1) ?? null,
        unlimited: ends.includes(null) && ends.length > 0,
      };
    }),
    total: count ?? 0,
  };
}

export async function getCompanyDetail(id: string) {
  const admin = db();
  const { data: company } = await admin.from("companies").select("*").eq("id", id).maybeSingle();
  if (!company) return null;
  const [membersRes, invitesRes, entsRes, invoicesRes, auditRes] = await Promise.all([
    admin.from("company_members").select("*").eq("company_id", id).order("joined_at", { ascending: true }),
    admin.from("access_invitations").select("id, kind, email, full_name, status, expires_at, accepted_at, send_count, last_sent_at, can_invite_members, invited_by_role, created_at").eq("company_id", id).order("created_at", { ascending: false }),
    admin.from("invoice_entitlements").select("*").eq("company_id", id).order("created_at", { ascending: false }),
    admin.from("custom_invoices").select("id, invoice_number, status, invoice_description, currency, amount_minor, billing_type, paid_at, created_at, due_at, selected_course_snapshot, includes_future_courses").eq("company_id", id).order("created_at", { ascending: false }),
    admin.from("company_access_audit_logs").select("*").eq("company_id", id).order("created_at", { ascending: false }).limit(300),
  ]);
  const members = (membersRes.data ?? []) as Tables<"company_members">[];
  const ents = (entsRes.data ?? []) as InvoiceEntitlementRow[];
  const audit = (auditRes.data ?? []) as Tables<"company_access_audit_logs">[];
  const people = await profilesById([...members.map((m) => m.user_id), ...audit.map((a) => a.performed_by), ...audit.map((a) => a.affected_user_id)]);
  const invoiceIds = (invoicesRes.data ?? []).map((i) => i.id);
  const { data: payments } = invoiceIds.length
    ? await admin.from("payment_transactions").select("id, whop_payment_id, status, billing_reason, currency, total_cents, refunded_cents, paid_at, created_at, custom_invoice_id").in("custom_invoice_id", invoiceIds).order("created_at", { ascending: false })
    : { data: [] };

  // Learning status: average progress across the package's courses.
  const courseIds = [...new Set(ents.flatMap((e) => e.included_course_ids))];
  const memberIds = members.map((m) => m.user_id);
  const { data: enrollments } = memberIds.length
    ? await admin.from("enrollments").select("user_id, course_id, progress_percent, status, last_accessed_at").in("user_id", memberIds)
    : { data: [] };
  const learning = new Map<string, { courses: number; avg: number; completed: number; lastActive: string | null }>();
  for (const uid of memberIds) {
    const rows = (enrollments ?? []).filter((e) => e.user_id === uid && (courseIds.length === 0 || courseIds.includes(e.course_id)));
    const avg = rows.length ? rows.reduce((a, e) => a + Number(e.progress_percent), 0) / rows.length : 0;
    const last = rows.map((r) => r.last_accessed_at).filter(Boolean).sort().at(-1) ?? null;
    learning.set(uid, { courses: rows.length, avg, completed: rows.filter((r) => r.status === "completed").length, lastActive: last as string | null });
  }

  return {
    company: company as Tables<"companies">,
    members: members.map((m) => ({ ...m, name: people.get(m.user_id)?.name ?? "", email: people.get(m.user_id)?.email ?? "", learning: learning.get(m.user_id) ?? null })),
    invitations: invitesRes.data ?? [],
    entitlements: ents,
    invoices: invoicesRes.data ?? [],
    payments: payments ?? [],
    audit: audit.map((a) => ({
      ...a,
      performerName: a.performed_by ? people.get(a.performed_by)?.name || people.get(a.performed_by)?.email || "" : "System",
      affectedName: a.affected_user_id ? people.get(a.affected_user_id)?.name || people.get(a.affected_user_id)?.email || "" : null,
    })),
  };
}
export type CompanyDetail = NonNullable<Awaited<ReturnType<typeof getCompanyDetail>>>;

export async function listCompanyMembers(params: ListParams) {
  const admin = db();
  let query = admin.from("company_members").select("*, companies!inner(id, name, status, access_status)", { count: "exact" });
  if (params.filters.status) query = query.eq("membership_status", params.filters.status);
  if (params.filters.company) query = query.eq("company_id", params.filters.company);
  if (params.filters.role === "manager") query = query.eq("can_invite_members", true);
  if (params.q) {
    const q = escapeLike(params.q);
    const { data: matches } = await admin.from("profile_private").select("user_id").ilike("email", `%${q}%`).limit(50);
    const { data: names } = await admin.from("profiles").select("id").ilike("full_name", `%${q}%`).limit(50);
    const ids = [...new Set([...(matches ?? []).map((m) => m.user_id), ...(names ?? []).map((n) => n.id)])];
    const { data: companies } = await admin.from("companies").select("id").ilike("name", `%${q}%`).limit(50);
    const cids = (companies ?? []).map((c) => c.id);
    const parts = [ids.length ? `user_id.in.(${ids.join(",")})` : null, cids.length ? `company_id.in.(${cids.join(",")})` : null].filter(Boolean);
    if (!parts.length) return { rows: [], total: 0 };
    query = query.or(parts.join(","));
  }
  const { data, count } = await query.order("joined_at", { ascending: false }).range(params.from, params.to);
  const people = await profilesById((data ?? []).map((m) => m.user_id));
  return {
    rows: (data ?? []).map((m) => ({ ...m, company: m.companies as unknown as { id: string; name: string; status: string; access_status: string }, name: people.get(m.user_id)?.name ?? "", email: people.get(m.user_id)?.email ?? "" })),
    total: count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Expiring access, subscriptions, overview
// ---------------------------------------------------------------------------

export async function listExpiringPackages(days: number) {
  const now = new Date();
  const { data } = await db()
    .from("invoice_entitlements")
    .select("*, custom_invoices!inner(id, invoice_number, invoice_description, invoice_type, customer_name, customer_email, company_name, billing_type), companies(id, name)")
    .eq("status", "active")
    .not("expires_at", "is", null)
    .gt("expires_at", now.toISOString())
    .lte("expires_at", new Date(now.getTime() + days * 86_400_000).toISOString())
    .order("expires_at", { ascending: true })
    .limit(300);
  const { data: recent } = await db()
    .from("invoice_entitlements")
    .select("*, custom_invoices!inner(id, invoice_number, invoice_description, invoice_type, customer_name, customer_email, company_name, billing_type), companies(id, name)")
    .eq("status", "expired")
    .not("expires_at", "is", null)
    .gte("expires_at", new Date(now.getTime() - 30 * 86_400_000).toISOString())
    .order("expires_at", { ascending: false })
    .limit(100);
  return { expiring: data ?? [], recentlyExpired: recent ?? [] };
}

export async function listInvoiceSubscriptions() {
  const { data } = await db()
    .from("custom_invoices")
    .select("id, invoice_number, invoice_description, invoice_type, customer_name, company_name, currency, amount_minor, billing_interval_days, billing_cycles, status, paid_at, invoice_entitlements(id, status, subscription_status, expires_at, contract_ends_at, whop_membership_id)")
    .eq("billing_type", "recurring")
    .in("status", ["paid", "partially_refunded", "refunded", "under_review", "awaiting_payment", "past_due", "failed"])
    .order("created_at", { ascending: false })
    .limit(300);
  return data ?? [];
}

export async function getBillingOverview() {
  const admin = db();
  const [invoicesRes, paymentsRes, companiesRes, membersRes, expiringRes] = await Promise.all([
    admin.from("custom_invoices").select("id, status, currency, billing_type, amount_minor, created_at, paid_at").limit(5000),
    admin.from("payment_transactions").select("custom_invoice_id, status, currency, total_cents, tax_cents, refunded_cents, paid_at, billing_reason").not("custom_invoice_id", "is", null).limit(10000),
    admin.from("companies").select("id, access_status, status").neq("status", "archived"),
    admin.from("company_members").select("user_id, companies!inner(access_status, status)").eq("membership_status", "active").eq("companies.access_status", "active").eq("companies.status", "active"),
    admin.from("invoice_entitlements").select("id", { count: "exact", head: true }).eq("status", "active").not("expires_at", "is", null).lte("expires_at", new Date(Date.now() + 30 * 86_400_000).toISOString()),
  ]);
  const invoices = invoicesRes.data ?? [];
  const payments = paymentsRes.data ?? [];
  const billingById = new Map(invoices.map((i) => [i.id, i.billing_type]));

  // Collected revenue = verified Whop payments that succeeded (net of refunds), by currency.
  const revenue = new Map<string, { gross: number; refunded: number; oneTime: number; recurring: number; tax: number }>();
  for (const p of payments) {
    if (!["succeeded", "partially_refunded", "refunded"].includes(p.status)) continue;
    const r = revenue.get(p.currency) ?? { gross: 0, refunded: 0, oneTime: 0, recurring: 0, tax: 0 };
    r.gross += p.total_cents;
    r.refunded += p.refunded_cents;
    r.tax += p.tax_cents ?? 0;
    if (billingById.get(p.custom_invoice_id!) === "recurring") r.recurring += p.total_cents - p.refunded_cents;
    else r.oneTime += p.total_cents - p.refunded_cents;
    revenue.set(p.currency, r);
  }
  const issued = invoices.filter((i) => !["draft", "pending_generation"].includes(i.status));
  const paid = invoices.filter((i) => ["paid", "partially_refunded", "refunded"].includes(i.status));
  const learners = new Set((membersRes.data ?? []).map((m) => m.user_id));

  // Paid invoices per month (last 6 months), by count.
  const months: { month: string; issued: number; paid: number }[] = [];
  const now = new Date();
  for (let k = 5; k >= 0; k--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - k, 1));
    const key = d.toISOString().slice(0, 7);
    months.push({
      month: key,
      issued: issued.filter((i) => i.created_at.slice(0, 7) === key).length,
      paid: paid.filter((i) => (i.paid_at ?? "").slice(0, 7) === key).length,
    });
  }

  return {
    total: invoices.length,
    paid: paid.length,
    pending: invoices.filter((i) => ["awaiting_payment", "failed"].includes(i.status)).length,
    overdue: invoices.filter((i) => i.status === "past_due").length,
    underReview: invoices.filter((i) => i.status === "under_review").length,
    drafts: invoices.filter((i) => ["draft", "pending_generation"].includes(i.status)).length,
    conversion: issued.length ? paid.length / issued.length : null,
    revenue: [...revenue.entries()].map(([currency, r]) => ({ currency, ...r, net: r.gross - r.refunded })).sort((a, b) => b.net - a.net),
    activeCompanies: (companiesRes.data ?? []).filter((c) => c.access_status === "active" && c.status === "active").length,
    companies: (companiesRes.data ?? []).length,
    activeCompanyLearners: learners.size,
    expiringPackages: expiringRes.count ?? 0,
    months,
  };
}
