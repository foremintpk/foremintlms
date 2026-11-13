import { BarChart3 } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { StatCard } from "@/components/common/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AnalyticsFilters } from "@/components/teaching/analytics-filters";
import { RANGES } from "@/components/teaching/analytics-ranges";
import { ChartFrame, DropoffChart, EnrollmentTrendChart, RankedBarChart } from "@/components/teaching/charts";
import { requireTeacher } from "@/lib/auth/guards";
import { formatNumber } from "@/lib/format";
import { getTeacherAnalytics, getTeacherCourses } from "@/lib/services/teacher-analytics";

export const instant = false;
export const metadata = { title: "Analytics" };

const DAY = 86_400_000;

function rangeFor(key: string | undefined) {
  const now = new Date();
  const days = key === "7d" ? 7 : key === "90d" ? 90 : key === "12m" ? 365 : 30;
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + DAY);
  return { from: new Date(to.getTime() - days * DAY), to, bucket: days > 92 ? ("week" as const) : ("day" as const) };
}

export default async function TeachAnalyticsPage({ searchParams }: PageProps<"/teach/analytics">) {
  const user = await requireTeacher("/teach/analytics");
  const raw = await searchParams;
  const rangeKey = typeof raw.range === "string" && RANGES.some((r) => r.value === raw.range) ? raw.range : "30d";
  const courseId = typeof raw.course === "string" ? raw.course : undefined;
  const courses = await getTeacherCourses(user.id);

  if (courses.length === 0) {
    return (
      <>
        <PageHeader title="Analytics" description="How students move through your courses." />
        <EmptyState icon={BarChart3} title="No course analytics yet" description="Analytics appear once you're assigned to a course with enrolled students." />
      </>
    );
  }

  const range = rangeFor(rangeKey);
  const data = await getTeacherAnalytics(user, range, courseId);
  const rangeLabel = RANGES.find((r) => r.value === rangeKey)?.label.toLowerCase() ?? "";
  const totalCompleted = data.completion.reduce((s, c) => s + c.completed, 0);
  const totalEnrolled = data.completion.reduce((s, c) => s + c.enrollments, 0);
  const graded = data.quizzes.filter((q) => q.avg_percent !== null);
  const avgQuiz = graded.length ? Math.round((graded.reduce((s, q) => s + (q.avg_percent ?? 0), 0) / graded.length) * 10) / 10 : null;
  const pendingAssignments = data.assignments.reduce((s, a) => s + a.pending, 0);

  return (
    <>
      <PageHeader title="Analytics" description="How students move through the courses you teach. Figures cover enrollments and activity in the selected period." />
      <AnalyticsFilters courses={courses.map((c) => ({ id: c.id, title: c.title }))} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="New enrollments" value={formatNumber(data.totalEnrollments)} hint={rangeLabel} tone="brand" />
        <StatCard
          label="Completion rate"
          value={totalEnrolled ? `${Math.round((totalCompleted / totalEnrolled) * 1000) / 10}%` : "—"}
          hint={`${totalCompleted} of ${totalEnrolled} who enrolled in this period`}
          tone="success"
        />
        <StatCard label="Average quiz score" value={avgQuiz === null ? "—" : `${avgQuiz}%`} hint="Across graded attempts" />
        <StatCard label="Assignments to review" value={formatNumber(pendingAssignments)} hint="Submitted in this period" tone={pendingAssignments ? "warning" : "default"} />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <ChartFrame
          title="New enrollments"
          description={`Per ${range.bucket === "week" ? "week" : "day"}, ${rangeLabel}`}
          table={{ headers: ["Period starting", "Enrollments"], rows: data.enrollmentSeries.map((r) => [r.date, r.enrollments]) }}
        >
          {data.totalEnrollments === 0 ? (
            <p className="grid h-64 place-items-center text-sm text-muted-foreground">No new enrollments in this period.</p>
          ) : (
            <EnrollmentTrendChart data={data.enrollmentSeries} bucket={range.bucket} />
          )}
        </ChartFrame>

        <ChartFrame
          title="Completion rate by course"
          description="Students who enrolled in this period and completed the course"
          table={{
            headers: ["Course", "Enrolled", "Completed", "Rate", "Average progress"],
            rows: data.completion.map((c) => [c.title, c.enrollments, c.completed, `${c.rate}%`, `${c.avgProgress}%`]),
          }}
        >
          {data.completion.length === 0 ? (
            <p className="grid h-40 place-items-center text-sm text-muted-foreground">No enrollments in this period.</p>
          ) : (
            <RankedBarChart
              valueLabel="Completion rate"
              data={data.completion.map((c) => ({ label: c.title, value: c.rate, hint: `${c.completed} of ${c.enrollments} completed · average progress ${c.avgProgress}%` }))}
            />
          )}
        </ChartFrame>
      </div>

      <div className="mt-6">
        <ChartFrame
          title="Lesson drop-off"
          description={
            data.dropoff
              ? `${data.dropoff.courseTitle}: share of enrolled students who completed each lesson, in curriculum order`
              : "Choose a single course above to see where students stop."
          }
          table={{
            headers: ["#", "Module", "Lesson", "Completed", "Enrolled", "Share"],
            rows: (data.dropoff?.lessons ?? []).map((l) => [l.position, l.module, l.title, l.completed, l.enrolled, `${l.percent}%`]),
          }}
        >
          {!data.dropoff ? (
            <p className="grid h-40 place-items-center text-sm text-muted-foreground">Lesson drop-off is shown per course.</p>
          ) : data.dropoff.lessons.length === 0 ? (
            <p className="grid h-40 place-items-center text-sm text-muted-foreground">This course has no published lessons yet.</p>
          ) : (
            <DropoffChart data={data.dropoff.lessons} />
          )}
        </ChartFrame>
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-2">
        <section>
          <SectionHeader title="Quizzes" description="Graded attempts submitted in this period" />
          {data.quizzes.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No quizzes in these courses.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quiz</TableHead>
                    <TableHead className="text-right">Attempts</TableHead>
                    <TableHead className="text-right">Average</TableHead>
                    <TableHead className="text-right">Pass rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.quizzes.map((q) => (
                    <TableRow key={q.quiz_id}>
                      <TableCell>
                        <p className="max-w-56 truncate text-sm font-medium">{q.title}</p>
                        <p className="max-w-56 truncate text-xs text-muted-foreground">
                          {q.course_title}
                          {q.awaiting_review ? ` · ${q.awaiting_review} awaiting review` : ""}
                        </p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{q.attempts}</TableCell>
                      <TableCell className="text-right tabular-nums">{q.avg_percent === null ? "—" : `${q.avg_percent}%`}</TableCell>
                      <TableCell className="text-right tabular-nums">{q.pass_rate === null ? "—" : `${q.pass_rate}%`}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <section>
          <SectionHeader title="Assignments" description="Submissions made in this period" />
          {data.assignments.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No assignments in these courses.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assignment</TableHead>
                    <TableHead className="text-right">Submitted</TableHead>
                    <TableHead className="text-right">To review</TableHead>
                    <TableHead className="text-right max-sm:hidden">Late</TableHead>
                    <TableHead className="text-right">Avg grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.assignments.map((a) => (
                    <TableRow key={a.assignment_id}>
                      <TableCell>
                        <p className="max-w-56 truncate text-sm font-medium">{a.title}</p>
                        <p className="max-w-56 truncate text-xs text-muted-foreground">
                          {a.course_title}
                          {a.resubmission_requested ? ` · ${a.resubmission_requested} resubmission${a.resubmission_requested === 1 ? "" : "s"} requested` : ""}
                        </p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{a.submissions}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.pending}</TableCell>
                      <TableCell className="text-right tabular-nums max-sm:hidden">{a.late}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.avg_grade_percent === null ? "—" : `${a.avg_grade_percent}%`}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
