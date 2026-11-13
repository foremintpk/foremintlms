import Link from "next/link";
import { Suspense } from "react";
import { PageHeader, SectionHeader } from "@/components/app-shell/page-header";
import { StatCard } from "@/components/common/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateRangeFilter } from "@/components/admin/date-range-filter";
import { DashboardSkeleton } from "@/components/admin/page-skeleton";
import { TimeSeriesChart } from "@/components/admin/charts/time-series-chart";
import { BarList } from "@/components/admin/charts/bar-list";
import { humanizeStatus } from "@/components/common/status-badge";
import { requireAdmin } from "@/lib/auth/guards";
import { formatMoney, formatNumber } from "@/lib/format";
import { compactNumber, ratePercent, resolveDateRange } from "@/lib/services/admin/metrics";
import {
  getAssignmentPerformance,
  getCourseStats,
  getDefaultCurrency,
  getInstructorActivity,
  getMrr,
  getOverviewMetrics,
  getSeries,
} from "@/lib/services/admin/analytics";

export const instant = false;
export const metadata = { title: "Analytics" };

type Search = Record<string, string | string[] | undefined>;

export default async function AnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  await requireAdmin("/admin/analytics");
  const sp = (await searchParams) as Search;
  const range = resolveDateRange({ range: sp.range as string, from: sp.from as string, to: sp.to as string });
  return (
    <>
      <PageHeader
        title="Analytics"
        description={`Growth, revenue, learning and support — ${range.label.toLowerCase()}. All figures come from recorded platform data.`}
        actions={<DateRangeFilter />}
      />
      <Suspense key={JSON.stringify(sp)} fallback={<DashboardSkeleton />}>
        <AnalyticsBody sp={sp} />
      </Suspense>
    </>
  );
}

async function AnalyticsBody({ sp }: { sp: Search }) {
  const range = resolveDateRange({ range: sp.range as string, from: sp.from as string, to: sp.to as string });
  const defaultCurrency = await getDefaultCurrency();
  const requested = typeof sp.currency === "string" && /^[a-z]{3}$/.test(sp.currency) ? sp.currency : defaultCurrency;

  const [m, signups, enrollments, completions, revenue, refunds, newSubs, canceledSubs, tickets, certificates, courses, assignments, instructors, mrr] =
    await Promise.all([
      getOverviewMetrics(range),
      getSeries("signups", range),
      getSeries("enrollments", range),
      getSeries("completions", range),
      getSeries("revenue", range, requested),
      getSeries("refunds", range, requested),
      getSeries("new_subscriptions", range),
      getSeries("canceled_subscriptions", range),
      getSeries("tickets", range),
      getSeries("certificates", range),
      getCourseStats(range, 15),
      getAssignmentPerformance(range),
      getInstructorActivity(range),
      getMrr(),
    ]);

  const currencies = [...new Set([defaultCurrency, ...m.revenue.map((r) => r.currency), ...Object.keys(mrr)])];
  const rev = m.revenue.find((r) => r.currency === requested);
  const qs = (currency: string) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "currency") p.set(k, v);
    p.set("currency", currency);
    return `/admin/analytics?${p.toString()}`;
  };

  return (
    <div className="grid gap-10">
      <section>
        <SectionHeader title="Growth" description={`Per ${range.bucket}`} />
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="New students" value={compactNumber(m.students_new)} hint={`${formatNumber(m.students_total)} in total`} />
          <StatCard label="New enrollments" value={compactNumber(m.enrollments_new)} hint={`${formatNumber(m.enrollments_active)} currently active`} />
          <StatCard
            label="Courses completed"
            value={compactNumber(m.completions_in_range)}
            tone="success"
            hint={`${ratePercent(m.enrollments_completed_total, m.enrollments_total)}% of all enrollments ever completed`}
          />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Sign-ups</CardTitle>
            </CardHeader>
            <CardContent>
              <TimeSeriesChart data={signups} label="Sign-ups" bucket={range.bucket} height={180} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Enrollments</CardTitle>
            </CardHeader>
            <CardContent>
              <TimeSeriesChart data={enrollments} label="Enrollments" bucket={range.bucket} height={180} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Completions</CardTitle>
            </CardHeader>
            <CardContent>
              <TimeSeriesChart data={completions} label="Completions" bucket={range.bucket} height={180} />
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <SectionHeader
          title="Revenue"
          description="From payments recorded via Whop webhooks and reconciliation. Amounts are never combined across currencies."
          actions={
            currencies.length > 1 ? (
              <div className="flex gap-1" role="group" aria-label="Currency">
                {currencies.map((c) => (
                  <Link
                    key={c}
                    href={qs(c)}
                    aria-current={c === requested ? "true" : undefined}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium uppercase ${c === requested ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                  >
                    {c}
                  </Link>
                ))}
              </div>
            ) : null
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Gross payments" value={formatMoney(rev?.gross_cents ?? 0, requested, { compact: true })} hint={`${formatNumber(m.payments_count)} payments, all currencies`} />
          <StatCard label="Refunded" value={formatMoney(rev?.refunded_cents ?? 0, requested, { compact: true })} hint={`${formatNumber(m.refunds_count)} refunds, all currencies`} />
          <StatCard label="Net revenue" value={formatMoney(rev?.net_cents ?? 0, requested, { compact: true })} tone="brand" />
          <StatCard label="Monthly recurring revenue" value={formatMoney(mrr[requested] ?? 0, requested, { compact: true })} hint="Active, cancelling and past-due subscriptions" />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Gross payments ({requested.toUpperCase()})</CardTitle>
            </CardHeader>
            <CardContent>
              <TimeSeriesChart data={revenue} label="Payments" bucket={range.bucket} format="currency" currency={requested} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Refunds ({requested.toUpperCase()})</CardTitle>
            </CardHeader>
            <CardContent>
              <TimeSeriesChart data={refunds} label="Refunds" bucket={range.bucket} format="currency" currency={requested} />
            </CardContent>
          </Card>
        </div>
        {m.payments_failed > 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {formatNumber(m.payments_failed)} failed payment attempt{m.payments_failed === 1 ? "" : "s"} in this period.{" "}
            <Link href="/admin/payments?status=failed" className="font-medium text-primary hover:underline">
              Review failed payments
            </Link>
          </p>
        ) : null}
      </section>

      <section>
        <SectionHeader title="Subscriptions" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>New subscriptions</CardTitle>
              <CardDescription>{formatNumber(m.subscriptions_new)} this period</CardDescription>
            </CardHeader>
            <CardContent>
              <TimeSeriesChart data={newSubs} label="New subscriptions" bucket={range.bucket} height={180} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Cancellations</CardTitle>
              <CardDescription>{formatNumber(m.subscriptions_canceled)} this period</CardDescription>
            </CardHeader>
            <CardContent>
              <TimeSeriesChart data={canceledSubs} label="Cancellations" bucket={range.bucket} height={180} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>All subscriptions by status</CardTitle>
            </CardHeader>
            <CardContent>
              <BarList
                items={Object.entries(m.subscriptions_by_status)
                  .sort((a, b) => b[1] - a[1])
                  .map(([s, n]) => ({ key: s, label: humanizeStatus(s), value: n, display: formatNumber(n) }))}
                emptyLabel="No subscriptions recorded yet."
              />
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <SectionHeader title="Courses" description="Courses with at least one enrollment, ranked by new enrollments in this period" />
        <Card>
          <CardContent className="pt-6">
            {courses.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No enrollments yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course</TableHead>
                      <TableHead className="text-right">New</TableHead>
                      <TableHead className="text-right">All time</TableHead>
                      <TableHead className="text-right">Completed</TableHead>
                      <TableHead className="text-right">Completion rate</TableHead>
                      <TableHead className="text-right">Avg progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {courses.map((c) => (
                      <TableRow key={c.course_id}>
                        <TableCell>
                          <Link href={`/admin/courses/${c.course_id}`} className="font-medium hover:underline">
                            {c.title}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(c.enrollments_new)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(c.enrollments_total)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(c.completed)}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.completion_rate}%</TableCell>
                        <TableCell className="text-right tabular-nums">{c.avg_progress}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Assignment performance</CardTitle>
            <CardDescription>Submissions received this period</CardDescription>
          </CardHeader>
          <CardContent>
            {assignments.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No assignments submitted in this period.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead className="text-right">Submitted</TableHead>
                    <TableHead className="text-right">Waiting</TableHead>
                    <TableHead className="text-right">Avg score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((a) => (
                    <TableRow key={a.course_id}>
                      <TableCell className="max-w-48 truncate">{a.title}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(a.submissions)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(a.pending)}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.graded ? `${a.avg_score_percent}%` : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Instructor activity</CardTitle>
            <CardDescription>Grading, discussion replies and live classes this period</CardDescription>
          </CardHeader>
          <CardContent>
            {instructors.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No approved instructors yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Instructor</TableHead>
                    <TableHead className="text-right">Courses</TableHead>
                    <TableHead className="text-right">Graded</TableHead>
                    <TableHead className="text-right">Replies</TableHead>
                    <TableHead className="text-right">Live</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {instructors.map((i) => (
                    <TableRow key={i.user_id}>
                      <TableCell>
                        <Link href={`/admin/instructors/${i.user_id}`} className="hover:underline">
                          {i.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{i.courses}</TableCell>
                      <TableCell className="text-right tabular-nums">{i.graded}</TableCell>
                      <TableCell className="text-right tabular-nums">{i.replies}</TableCell>
                      <TableCell className="text-right tabular-nums">{i.live_sessions}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <SectionHeader title="Learning activity & support" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Lessons completed" value={compactNumber(m.lessons_completed)} />
          <StatCard label="Quiz attempts" value={compactNumber(m.quiz_attempts)} />
          <StatCard label="Certificates issued" value={compactNumber(m.certificates_issued)} tone="success" />
          <StatCard label="Open tickets" value={compactNumber(m.tickets_open)} href="/admin/support" tone={m.tickets_open ? "warning" : "default"} />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Support tickets opened</CardTitle>
              <CardDescription>
                {formatNumber(m.tickets_new)} opened · {formatNumber(m.tickets_resolved)} resolved this period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TimeSeriesChart data={tickets} label="Tickets" bucket={range.bucket} height={180} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Certificates issued</CardTitle>
            </CardHeader>
            <CardContent>
              <TimeSeriesChart data={certificates} label="Certificates" bucket={range.bucket} height={180} />
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
