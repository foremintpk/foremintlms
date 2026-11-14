import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CsvColumn } from "./csv";

/**
 * Admin CSV report definitions. Queries run as the signed-in admin (RLS),
 * paged 1,000 rows at a time and capped so a single export stays bounded.
 */

export const MAX_EXPORT_ROWS = 50_000;
const PAGE = 1000;

type Row = Record<string, unknown>;
type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface ReportDef {
  label: string;
  description: string;
  dateColumn: string | null;
  columns: CsvColumn<Row>[];
  query: (supabase: Supabase, range: { from: Date | null; to: Date | null }) => (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  /** Drop rows that belong to administrator accounts (staff are not learners). Returns the row's user id. */
  excludeAdminAccounts?: (row: Row) => string | undefined;
}

const one = (v: unknown): Row | null => (Array.isArray(v) ? ((v[0] as Row) ?? null) : ((v as Row) ?? null));
const money = (cents: unknown) => (typeof cents === "number" ? Number((cents / 100).toFixed(2)) : null);

function withRange<Q extends { gte: (c: string, v: string) => Q; lte: (c: string, v: string) => Q }>(q: Q, column: string | null, range: { from: Date | null; to: Date | null }): Q {
  let out = q;
  if (column && range.from) out = out.gte(column, range.from.toISOString());
  if (column && range.to) out = out.lte(column, range.to.toISOString());
  return out;
}

export const REPORTS: Record<string, ReportDef> = {
  students: {
    label: "Students",
    description: "Every student account with contact details and status.",
    dateColumn: "created_at",
    columns: [
      { header: "User ID", value: (r) => one(r.profiles)?.id as string },
      { header: "Name", value: (r) => one(r.profiles)?.full_name as string },
      { header: "Email", value: (r) => one(one(r.profiles)?.profile_private)?.email as string },
      { header: "Account status", value: (r) => one(one(r.profiles)?.profile_private)?.status as string },
      { header: "Country", value: (r) => one(one(r.profiles)?.profile_private)?.country as string },
      { header: "Time zone", value: (r) => one(r.profiles)?.timezone as string },
      { header: "Joined", value: (r) => r.created_at as string },
      { header: "Last sign-in", value: (r) => one(one(r.profiles)?.profile_private)?.last_sign_in_at as string },
    ],
    excludeAdminAccounts: (r) => r.user_id as string,
    // The student role row is created at sign-up, so its timestamp is the join date.
    query: (s, range) => (f, t) =>
      withRange(
        s
          .from("user_roles")
          .select("user_id, created_at, profiles!user_roles_user_id_fkey(id, full_name, timezone, profile_private(email, status, country, last_sign_in_at))")
          .eq("role", "student"),
        "created_at",
        range,
      )
        .order("created_at")
        .range(f, t),
  },
  enrollments: {
    label: "Enrollments",
    description: "Enrollments with progress, source and completion.",
    dateColumn: "enrolled_at",
    columns: [
      { header: "Enrollment ID", value: (r) => r.id as string },
      { header: "Student", value: (r) => one(r.profiles)?.full_name as string },
      { header: "User ID", value: (r) => r.user_id as string },
      { header: "Course", value: (r) => one(r.courses)?.title as string },
      { header: "Status", value: (r) => r.status as string },
      { header: "Source", value: (r) => r.source as string },
      { header: "Progress %", value: (r) => Number(r.progress_percent) },
      { header: "Enrolled", value: (r) => r.enrolled_at as string },
      { header: "Completed", value: (r) => r.completed_at as string },
    ],
    query: (s, range) => (f, t) =>
      withRange(
        s.from("enrollments").select("id, user_id, status, source, progress_percent, enrolled_at, completed_at, profiles(full_name), courses(title)"),
        "enrolled_at",
        range,
      )
        .order("enrolled_at")
        .range(f, t),
  },
  payments: {
    label: "Payments",
    description: "Payments recorded from Whop, with refunds and taxes as reported.",
    dateColumn: "created_at",
    columns: [
      { header: "Payment ID", value: (r) => r.id as string },
      { header: "Whop payment", value: (r) => r.whop_payment_id as string },
      { header: "Customer", value: (r) => one(r.profiles)?.full_name as string },
      { header: "Product", value: (r) => one(r.products)?.name as string },
      { header: "Plan", value: (r) => one(r.pricing_plans)?.name as string },
      { header: "Status", value: (r) => r.status as string },
      { header: "Billing reason", value: (r) => r.billing_reason as string },
      { header: "Currency", value: (r) => (r.currency as string)?.toUpperCase() },
      { header: "Subtotal", value: (r) => money(r.subtotal_cents) },
      { header: "Discount", value: (r) => money(r.discount_cents) },
      { header: "Tax", value: (r) => money(r.tax_cents) },
      { header: "Total", value: (r) => money(r.total_cents) },
      { header: "Refunded", value: (r) => money(r.refunded_cents) },
      { header: "Promo code", value: (r) => r.promo_code as string },
      { header: "Paid at", value: (r) => r.paid_at as string },
      { header: "Created", value: (r) => r.created_at as string },
    ],
    query: (s, range) => (f, t) =>
      withRange(
        s
          .from("payment_transactions")
          .select(
            "id, whop_payment_id, status, billing_reason, currency, subtotal_cents, discount_cents, tax_cents, total_cents, refunded_cents, promo_code, paid_at, created_at, profiles(full_name), products(name), pricing_plans(name)",
          ),
        "created_at",
        range,
      )
        .order("created_at")
        .range(f, t),
  },
  subscriptions: {
    label: "Subscriptions",
    description: "Recurring memberships and their current state.",
    dateColumn: "created_at",
    columns: [
      { header: "Record ID", value: (r) => r.id as string },
      { header: "Whop membership", value: (r) => r.whop_membership_id as string },
      { header: "Customer", value: (r) => one(r.profiles)?.full_name as string },
      { header: "Product", value: (r) => one(r.products)?.name as string },
      { header: "Plan", value: (r) => one(r.pricing_plans)?.name as string },
      { header: "Status", value: (r) => r.status as string },
      { header: "Period start", value: (r) => r.current_period_start as string },
      { header: "Period end", value: (r) => r.current_period_end as string },
      { header: "Cancels at period end", value: (r) => r.cancel_at_period_end as boolean },
      { header: "Cancelled at", value: (r) => r.canceled_at as string },
      { header: "Created", value: (r) => r.created_at as string },
    ],
    query: (s, range) => (f, t) =>
      withRange(
        s
          .from("subscription_records")
          .select(
            "id, whop_membership_id, status, current_period_start, current_period_end, cancel_at_period_end, canceled_at, created_at, profiles(full_name), products(name), pricing_plans(name)",
          ),
        "created_at",
        range,
      )
        .order("created_at")
        .range(f, t),
  },
  courses: {
    label: "Courses",
    description: "All courses with status and settings.",
    dateColumn: null,
    columns: [
      { header: "Course ID", value: (r) => r.id as string },
      { header: "Title", value: (r) => r.title as string },
      { header: "Slug", value: (r) => r.slug as string },
      { header: "Category", value: (r) => one(r.course_categories)?.name as string },
      { header: "Status", value: (r) => r.status as string },
      { header: "Visibility", value: (r) => r.visibility as string },
      { header: "Level", value: (r) => r.level as string },
      { header: "Free", value: (r) => r.is_free as boolean },
      { header: "Certificates", value: (r) => r.certificate_enabled as boolean },
      { header: "Published", value: (r) => r.published_at as string },
      { header: "Created", value: (r) => r.created_at as string },
    ],
    query: (s) => (f, t) =>
      s
        .from("courses")
        .select("id, title, slug, status, visibility, level, is_free, certificate_enabled, published_at, created_at, course_categories(name)")
        .order("created_at")
        .range(f, t),
  },
  tickets: {
    label: "Support tickets",
    description: "Helpdesk tickets with category, priority and resolution times.",
    dateColumn: "created_at",
    columns: [
      { header: "Ticket", value: (r) => r.ticket_number as string },
      { header: "Subject", value: (r) => r.subject as string },
      { header: "Requester", value: (r) => one(r.profiles)?.full_name as string },
      { header: "Category", value: (r) => r.category as string },
      { header: "Priority", value: (r) => r.priority as string },
      { header: "Status", value: (r) => r.status as string },
      { header: "Created", value: (r) => r.created_at as string },
      { header: "Resolved", value: (r) => r.resolved_at as string },
      { header: "Closed", value: (r) => r.closed_at as string },
    ],
    query: (s, range) => (f, t) =>
      withRange(
        s
          .from("support_tickets")
          .select("ticket_number, subject, category, priority, status, created_at, resolved_at, closed_at, profiles!support_tickets_requester_id_fkey(full_name)"),
        "created_at",
        range,
      )
        .order("created_at")
        .range(f, t),
  },
  leads: {
    label: "Leads",
    description: "Contact-form and course-interest enquiries.",
    dateColumn: "created_at",
    columns: [
      { header: "Name", value: (r) => r.full_name as string },
      { header: "Email", value: (r) => r.email as string },
      { header: "Phone", value: (r) => r.phone as string },
      { header: "Subject", value: (r) => r.subject as string },
      { header: "Message", value: (r) => r.message as string },
      { header: "Source", value: (r) => r.source as string },
      { header: "Status", value: (r) => r.status as string },
      { header: "Received", value: (r) => r.created_at as string },
    ],
    query: (s, range) => (f, t) =>
      withRange(s.from("marketing_leads").select("full_name, email, phone, subject, message, source, status, created_at"), "created_at", range)
        .order("created_at")
        .range(f, t),
  },
  newsletter: {
    label: "Newsletter subscribers",
    description: "Email addresses with consent dates.",
    dateColumn: "created_at",
    columns: [
      { header: "Email", value: (r) => r.email as string },
      { header: "Status", value: (r) => r.status as string },
      { header: "Source", value: (r) => r.source as string },
      { header: "Consent given", value: (r) => r.consent_at as string },
      { header: "Unsubscribed", value: (r) => r.unsubscribed_at as string },
    ],
    query: (s, range) => (f, t) =>
      withRange(s.from("newsletter_subscriptions").select("email, status, source, consent_at, unsubscribed_at, created_at"), "created_at", range)
        .order("created_at")
        .range(f, t),
  },
  certificates: {
    label: "Certificates",
    description: "Issued certificates with their verification numbers.",
    dateColumn: "issued_at",
    columns: [
      { header: "Certificate number", value: (r) => r.certificate_number as string },
      { header: "Recipient", value: (r) => r.recipient_name as string },
      { header: "Course", value: (r) => r.course_title as string },
      { header: "Instructor", value: (r) => r.instructor_name as string },
      { header: "Completed", value: (r) => r.completion_date as string },
      { header: "Issued", value: (r) => r.issued_at as string },
      { header: "Status", value: (r) => r.status as string },
    ],
    query: (s, range) => (f, t) =>
      withRange(
        s.from("certificates").select("certificate_number, recipient_name, course_title, instructor_name, completion_date, issued_at, status"),
        "issued_at",
        range,
      )
        .order("issued_at")
        .range(f, t),
  },
};

export async function collectReportRows(report: ReportDef, range: { from: Date | null; to: Date | null }): Promise<{ rows: Row[]; truncated: boolean }> {
  const supabase = await createClient();
  const page = report.query(supabase, range);
  const userIdOf = report.excludeAdminAccounts;
  let adminIds: Set<string> | null = null;
  if (userIdOf) {
    const { data, error } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
    if (error) throw new Error(`Export query failed: ${error.message}`);
    adminIds = new Set((data ?? []).map((a) => a.user_id));
  }
  const rows: Row[] = [];
  for (let from = 0; from < MAX_EXPORT_ROWS; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(`Export query failed: ${error.message}`);
    const batch = (data ?? []) as Row[];
    rows.push(...(adminIds && userIdOf ? batch.filter((r) => !adminIds.has(userIdOf(r) ?? "")) : batch));
    if (batch.length < PAGE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}
