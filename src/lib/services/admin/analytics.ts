import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getSetting } from "@/lib/settings";
import { adminRpc } from "./rpc";
import { computeMrr, type DateRange, type SubscriptionForMrr } from "./metrics";

/**
 * Admin analytics. Every query runs as the signed-in admin (RLS + the
 * SQL functions' own private.is_admin() check), never with the service role.
 */

export interface RevenueRow {
  currency: string;
  gross_cents: number;
  refunded_cents: number;
  net_cents: number;
}

export interface OverviewMetrics {
  students_total: number;
  students_new: number;
  students_active: number;
  courses_total: number;
  courses_published: number;
  courses_draft: number;
  courses_in_review: number;
  teachers_total: number;
  teachers_pending: number;
  enrollments_active: number;
  enrollments_new: number;
  enrollments_total: number;
  enrollments_completed_total: number;
  completions_in_range: number;
  avg_progress_active: number;
  lessons_completed: number;
  quiz_attempts: number;
  submissions: number;
  certificates_issued: number;
  payments_count: number;
  payments_failed: number;
  refunds_count: number;
  revenue: RevenueRow[];
  subscriptions_by_status: Record<string, number>;
  subscriptions_new: number;
  subscriptions_canceled: number;
  tickets_open: number;
  tickets_new: number;
  tickets_resolved: number;
  deletion_requests: number;
}

export async function getOverviewMetrics(range: { from: Date; to: Date }): Promise<OverviewMetrics> {
  const m = (await adminRpc<Record<string, unknown> | null>("admin_overview_metrics", {
    p_from: range.from.toISOString(),
    p_to: range.to.toISOString(),
  })) ?? {};
  const num = (k: string) => Number(m[k] ?? 0);
  return {
    students_total: num("students_total"),
    students_new: num("students_new"),
    students_active: num("students_active"),
    courses_total: num("courses_total"),
    courses_published: num("courses_published"),
    courses_draft: num("courses_draft"),
    courses_in_review: num("courses_in_review"),
    teachers_total: num("teachers_total"),
    teachers_pending: num("teachers_pending"),
    enrollments_active: num("enrollments_active"),
    enrollments_new: num("enrollments_new"),
    enrollments_total: num("enrollments_total"),
    enrollments_completed_total: num("enrollments_completed_total"),
    completions_in_range: num("completions_in_range"),
    avg_progress_active: num("avg_progress_active"),
    lessons_completed: num("lessons_completed"),
    quiz_attempts: num("quiz_attempts"),
    submissions: num("submissions"),
    certificates_issued: num("certificates_issued"),
    payments_count: num("payments_count"),
    payments_failed: num("payments_failed"),
    refunds_count: num("refunds_count"),
    revenue: ((m.revenue as RevenueRow[] | undefined) ?? []).map((r) => ({
      currency: r.currency,
      gross_cents: Number(r.gross_cents),
      refunded_cents: Number(r.refunded_cents),
      net_cents: Number(r.net_cents),
    })),
    subscriptions_by_status: Object.fromEntries(
      Object.entries((m.subscriptions_by_status as Record<string, number> | undefined) ?? {}).map(([k, v]) => [k, Number(v)]),
    ),
    subscriptions_new: num("subscriptions_new"),
    subscriptions_canceled: num("subscriptions_canceled"),
    tickets_open: num("tickets_open"),
    tickets_new: num("tickets_new"),
    tickets_resolved: num("tickets_resolved"),
    deletion_requests: num("deletion_requests"),
  };
}

export type SeriesMetric =
  | "signups"
  | "enrollments"
  | "completions"
  | "revenue"
  | "refunds"
  | "new_subscriptions"
  | "canceled_subscriptions"
  | "tickets"
  | "certificates"
  | "lessons_completed";

export async function getSeries(metric: SeriesMetric, range: DateRange, currency?: string) {
  const data = await adminRpc<{ bucket: string; value: number | string }[] | null>("admin_timeseries", {
    p_metric: metric,
    p_from: range.from.toISOString(),
    p_to: range.to.toISOString(),
    p_bucket: range.bucket,
    p_currency: currency ?? null,
  });
  return (data ?? []).map((r) => ({
    bucket: String(r.bucket).slice(0, 10),
    value: Number(r.value),
  }));
}

export interface CourseStat {
  course_id: string;
  title: string;
  status: string;
  enrollments_total: number;
  enrollments_new: number;
  completed: number;
  completion_rate: number;
  avg_progress: number;
}

export async function getCourseStats(range: { from: Date; to: Date }, limit = 10): Promise<CourseStat[]> {
  const data = await adminRpc<CourseStat[] | null>("admin_course_stats", {
    p_from: range.from.toISOString(),
    p_to: range.to.toISOString(),
    p_limit: limit,
  });
  return (data ?? []).map((r) => ({
    ...r,
    enrollments_total: Number(r.enrollments_total),
    enrollments_new: Number(r.enrollments_new),
    completed: Number(r.completed),
    completion_rate: Number(r.completion_rate),
    avg_progress: Number(r.avg_progress),
  }));
}

export interface AssignmentStat {
  course_id: string;
  title: string;
  submissions: number;
  graded: number;
  pending: number;
  avg_score_percent: number;
}

export async function getAssignmentPerformance(range: { from: Date; to: Date }): Promise<AssignmentStat[]> {
  const data = await adminRpc<AssignmentStat[] | null>("admin_assignment_performance", {
    p_from: range.from.toISOString(),
    p_to: range.to.toISOString(),
  });
  return (data ?? []).map((r) => ({
    ...r,
    submissions: Number(r.submissions),
    graded: Number(r.graded),
    pending: Number(r.pending),
    avg_score_percent: Number(r.avg_score_percent),
  }));
}

export interface InstructorActivity {
  user_id: string;
  name: string;
  courses: number;
  students: number;
  graded: number;
  replies: number;
  live_sessions: number;
}

export async function getInstructorActivity(range: { from: Date; to: Date }): Promise<InstructorActivity[]> {
  const data = await adminRpc<InstructorActivity[] | null>("admin_instructor_activity", {
    p_from: range.from.toISOString(),
    p_to: range.to.toISOString(),
  });
  return (data ?? []).map((r) => ({
    ...r,
    courses: Number(r.courses),
    students: Number(r.students),
    graded: Number(r.graded),
    replies: Number(r.replies),
    live_sessions: Number(r.live_sessions),
  }));
}

/** MRR from recorded subscriptions and their plan prices, per currency. */
export async function getMrr(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscription_records")
    .select("status, pricing_plans(price_cents, currency, billing_period_days)")
    .in("status", ["active", "canceling", "past_due"]);
  if (error) throw new Error(`MRR query failed: ${error.message}`);
  type Plan = { price_cents: number; currency: string; billing_period_days: number | null };
  const rows: SubscriptionForMrr[] = ((data ?? []) as unknown as { status: string; pricing_plans: Plan | Plan[] | null }[]).map((r) => {
    const plan = Array.isArray(r.pricing_plans) ? r.pricing_plans[0] : r.pricing_plans;
    return {
      status: r.status,
      price_cents: plan?.price_cents ?? 0,
      currency: plan?.currency ?? null,
      billing_period_days: plan?.billing_period_days ?? null,
    };
  });
  return computeMrr(rows);
}

export async function getDefaultCurrency(): Promise<string> {
  return (await getSetting<string>("billing.default_currency", "usd")).toLowerCase();
}
