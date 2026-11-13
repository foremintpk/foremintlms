import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRight,
  BookOpen,
  CircleDollarSign,
  GraduationCap,
  LifeBuoy,
  Repeat,
  Trophy,
  UserCheck,
  Users,
} from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/app-shell/page-header";
import { StatCard } from "@/components/common/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangeFilter } from "@/components/admin/date-range-filter";
import { DashboardSkeleton } from "@/components/admin/page-skeleton";
import { TimeSeriesChart } from "@/components/admin/charts/time-series-chart";
import { BarList } from "@/components/admin/charts/bar-list";
import { humanizeStatus } from "@/components/common/status-badge";
import { requireAdmin } from "@/lib/auth/guards";
import { formatMoney, formatNumber } from "@/lib/format";
import { compactNumber, percentChange, previousRange, ratePercent, resolveDateRange } from "@/lib/services/admin/metrics";
import { getCourseStats, getDefaultCurrency, getMrr, getOverviewMetrics, getSeries } from "@/lib/services/admin/analytics";

export const instant = false;
export const metadata = { title: "Admin overview" };

function delta(current: number, previous: number): string {
  const change = percentChange(current, previous);
  if (change === null) return "new this period";
  if (change === 0) return "no change vs previous period";
  return `${change > 0 ? "+" : ""}${change}% vs previous period`;
}

type Search = Record<string, string | string[] | undefined>;

export default async function AdminOverviewPage({ searchParams }: PageProps<"/admin">) {
  await requireAdmin("/admin");
  const sp = (await searchParams) as Search;
  const range = resolveDateRange({ range: sp.range as string, from: sp.from as string, to: sp.to as string });
  return (
    <>
      <PageHeader title="Overview" description={`How the academy is doing — ${range.label.toLowerCase()}.`} actions={<DateRangeFilter />} />
      <Suspense key={JSON.stringify(sp)} fallback={<DashboardSkeleton />}>
        <OverviewBody sp={sp} />
      </Suspense>
    </>
  );
}

async function OverviewBody({ sp }: { sp: Search }) {
  const range = resolveDateRange({ range: sp.range as string, from: sp.from as string, to: sp.to as string });
  const prev = previousRange(range);
  const currency = await getDefaultCurrency();

  const [m, before, enrollSeries, revenueSeries, courses, mrr] = await Promise.all([
    getOverviewMetrics(range),
    getOverviewMetrics(prev),
    getSeries("enrollments", range),
    getSeries("revenue", range, currency),
    getCourseStats(range, 6),
    getMrr(),
  ]);

  const revenue = m.revenue.find((r) => r.currency === currency);
  const prevRevenue = before.revenue.find((r) => r.currency === currency);
  const otherCurrencies = m.revenue.filter((r) => r.currency !== currency);
  const mrrMain = mrr[currency] ?? 0;
  const activeSubs = (m.subscriptions_by_status.active ?? 0) + (m.subscriptions_by_status.canceling ?? 0) + (m.subscriptions_by_status.past_due ?? 0);
  const completionRate = ratePercent(m.enrollments_completed_total, m.enrollments_total);

  const attention = [
    m.courses_in_review > 0 && { href: "/admin/courses?status=in_review", text: `${m.courses_in_review} course${m.courses_in_review === 1 ? "" : "s"} waiting for review` },
    m.teachers_pending > 0 && { href: "/admin/instructors?tab=pending", text: `${m.teachers_pending} instructor${m.teachers_pending === 1 ? "" : "s"} waiting for approval` },
    m.tickets_open > 0 && { href: "/admin/support", text: `${m.tickets_open} open support ticket${m.tickets_open === 1 ? "" : "s"}` },
    m.deletion_requests > 0 && { href: "/admin/students?status=deletion_requested", text: `${m.deletion_requests} account deletion request${m.deletion_requests === 1 ? "" : "s"}` },
  ].filter(Boolean) as { href: string; text: string }[];

  return (
    <>
      {attention.length > 0 ? (
        <ul className="mb-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="Needs attention">
          {attention.map((a) => (
            <li key={a.href}>
              <Link
                href={a.href}
                className="flex items-center justify-between gap-3 rounded-xl border border-warning/25 bg-warning-soft px-4 py-3 text-sm font-medium text-warning transition-colors hover:border-warning/50"
              >
                {a.text}
                <ArrowRight className="size-4 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Students"
          value={compactNumber(m.students_total)}
          icon={Users}
          tone="brand"
          href="/admin/students"
          hint={`${formatNumber(m.students_new)} joined · ${formatNumber(m.students_active)} active this period`}
        />
        <StatCard
          label="Active enrollments"
          value={compactNumber(m.enrollments_active)}
          icon={GraduationCap}
          href="/admin/enrollments"
          hint={`${formatNumber(m.enrollments_new)} new · ${delta(m.enrollments_new, before.enrollments_new)}`}
        />
        <StatCard
          label={`Net revenue (${currency.toUpperCase()})`}
          value={formatMoney(revenue?.net_cents ?? 0, currency, { compact: true })}
          icon={CircleDollarSign}
          href="/admin/payments"
          hint={
            <>
              From recorded Whop payments · {delta(revenue?.net_cents ?? 0, prevRevenue?.net_cents ?? 0)}
              {otherCurrencies.length > 0
                ? ` · also ${otherCurrencies.map((r) => formatMoney(r.net_cents, r.currency, { compact: true })).join(", ")}`
                : ""}
            </>
          }
        />
        <StatCard
          label={`Monthly recurring revenue (${currency.toUpperCase()})`}
          value={formatMoney(mrrMain, currency, { compact: true })}
          icon={Repeat}
          href="/admin/subscriptions"
          hint={`${formatNumber(activeSubs)} paying subscription${activeSubs === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Published courses"
          value={`${formatNumber(m.courses_published)} of ${formatNumber(m.courses_total)}`}
          icon={BookOpen}
          href="/admin/courses"
          hint={`${formatNumber(m.courses_draft)} drafts · ${formatNumber(m.courses_in_review)} in review`}
        />
        <StatCard
          label="Instructors"
          value={formatNumber(m.teachers_total)}
          icon={UserCheck}
          href="/admin/instructors"
          hint={m.teachers_pending ? `${formatNumber(m.teachers_pending)} pending approval` : "All approved"}
        />
        <StatCard
          label="Course completion"
          value={`${completionRate}%`}
          icon={Trophy}
          tone="success"
          hint={`${formatNumber(m.completions_in_range)} completions this period · avg progress ${m.avg_progress_active}%`}
        />
        <StatCard
          label="Open support tickets"
          value={formatNumber(m.tickets_open)}
          icon={LifeBuoy}
          tone={m.tickets_open > 0 ? "warning" : "default"}
          href="/admin/support"
          hint={`${formatNumber(m.tickets_new)} opened · ${formatNumber(m.tickets_resolved)} resolved this period`}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Enrollments</CardTitle>
            <CardDescription>New enrollments per {range.bucket}, all courses</CardDescription>
          </CardHeader>
          <CardContent>
            <TimeSeriesChart data={enrollSeries} label="Enrollments" bucket={range.bucket} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Revenue ({currency.toUpperCase()})</CardTitle>
            <CardDescription>Gross payments per {range.bucket}, from recorded Whop payments</CardDescription>
          </CardHeader>
          <CardContent>
            <TimeSeriesChart data={revenueSeries} label="Revenue" bucket={range.bucket} format="currency" currency={currency} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Most popular courses</CardTitle>
            <CardDescription>New enrollments this period</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList
              items={courses.map((c) => ({
                key: c.course_id,
                label: c.title,
                value: c.enrollments_new,
                display: formatNumber(c.enrollments_new),
                sub: `${c.completion_rate}% complete`,
                href: `/admin/courses/${c.course_id}`,
              }))}
              emptyLabel="No enrollments yet. Publish a course and share its page to get the first learners."
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Subscriptions</CardTitle>
            <CardDescription>All recorded subscriptions by status</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList
              items={Object.entries(m.subscriptions_by_status)
                .sort((a, b) => b[1] - a[1])
                .map(([status, n]) => ({ key: status, label: humanizeStatus(status), value: n, display: formatNumber(n) }))}
              emptyLabel="No subscriptions yet."
            />
          </CardContent>
        </Card>
      </div>

      <section className="mt-8">
        <SectionHeader
          title="Learner engagement"
          description="Activity during the selected period"
          actions={
            <Link href="/admin/analytics" className="text-sm font-medium text-primary hover:underline">
              Open full analytics
            </Link>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Lessons completed" value={compactNumber(m.lessons_completed)} />
          <StatCard label="Quiz attempts submitted" value={compactNumber(m.quiz_attempts)} />
          <StatCard label="Assignments submitted" value={compactNumber(m.submissions)} />
          <StatCard label="Certificates issued" value={compactNumber(m.certificates_issued)} />
        </div>
      </section>
    </>
  );
}
