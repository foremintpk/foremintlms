import Link from "next/link";
import Image from "next/image";
import { BookOpen, ClipboardCheck, MessageCircleQuestion, MessageSquare, Radio, Users } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { LocalTime } from "@/components/common/local-time";
import { StatCard } from "@/components/common/stat-card";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChartFrame, RankedBarChart } from "@/components/teaching/charts";
import { requireTeacher } from "@/lib/auth/guards";
import { formatNumber, formatRelative } from "@/lib/format";
import { getTeacherDashboard } from "@/lib/services/teacher-analytics";
import { sessionPhase } from "@/lib/services/live/time";
import { PROVIDER_LABEL, type LiveProvider } from "@/lib/services/live/types";

export const instant = false;
export const metadata = { title: "Instructor dashboard" };

export default async function TeachDashboardPage() {
  const user = await requireTeacher("/teach");
  const data = await getTeacherDashboard(user);
  const pendingReviews = data.pendingSubmissions + data.pendingQuizReviews;
  const courseTitle = new Map(data.courses.map((c) => [c.id, c.title]));
  const completionData = data.courses
    .filter((c) => c.enrollments > 0)
    .map((c) => ({
      label: c.title,
      value: Math.round((c.completed / c.enrollments) * 1000) / 10,
      hint: `${c.completed} of ${c.enrollments} students completed · average progress ${c.avgProgress}%`,
    }));

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user.displayName}`}
        description="What needs your attention across the courses you teach."
        actions={
          <Button asChild variant="outline">
            <Link href="/teach/live">
              <Radio /> Live classes
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Assigned courses" value={formatNumber(data.courses.length)} icon={BookOpen} tone="brand" href="/teach/courses" />
        <StatCard label="Enrolled students" value={formatNumber(data.studentCount)} hint="Across your courses" icon={Users} href="/teach/students" />
        <StatCard
          label="Waiting for review"
          value={formatNumber(pendingReviews)}
          hint={`${data.pendingSubmissions} assignment${data.pendingSubmissions === 1 ? "" : "s"} · ${data.pendingQuizReviews} quiz attempt${data.pendingQuizReviews === 1 ? "" : "s"}`}
          icon={ClipboardCheck}
          tone={pendingReviews > 0 ? "warning" : "default"}
          href="/teach/reviews"
        />
        <StatCard
          label="Unanswered questions"
          value={formatNumber(data.unansweredQuestions)}
          hint="Questions with no reply yet"
          icon={MessageCircleQuestion}
          tone={data.unansweredQuestions > 0 ? "warning" : "default"}
          href="/teach/questions"
        />
      </div>

      {data.courses.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={BookOpen}
          title="You're not assigned to a course yet"
          description="An administrator assigns instructors to courses. Once you're assigned, your students, reviews and classes appear here."
        />
      ) : (
        <div className="mt-8 grid gap-8 xl:grid-cols-[1.5fr_1fr]">
          <div className="grid gap-8">
            {completionData.length ? (
              <ChartFrame
                title="Course completion"
                description="Share of enrolled students who completed each course"
                table={{
                  headers: ["Course", "Completed", "Enrolled", "Completion rate", "Average progress"],
                  rows: data.courses.map((c) => [
                    c.title,
                    c.completed,
                    c.enrollments,
                    c.enrollments ? `${Math.round((c.completed / c.enrollments) * 1000) / 10}%` : "—",
                    `${c.avgProgress}%`,
                  ]),
                }}
              >
                <RankedBarChart data={completionData} valueLabel="Completion rate" />
              </ChartFrame>
            ) : null}

            <section>
              <SectionHeader title="Your courses" actions={<Button asChild variant="ghost" size="sm"><Link href="/teach/courses">Manage courses</Link></Button>} />
              <ul className="grid gap-3 sm:grid-cols-2">
                {data.courses.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/teach/courses/${c.id}`}
                      className="flex h-full gap-3 rounded-2xl border bg-card p-3 shadow-card transition-colors hover:border-primary/30"
                    >
                      <div className="relative aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
                        {c.thumbnail_url ? <Image src={c.thumbnail_url} alt="" fill sizes="96px" className="object-cover" /> : null}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                        <div>
                          <p className="line-clamp-2 text-sm font-medium">{c.title}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <StatusBadge status={c.status} />
                            {c.role === "assistant" ? <StatusBadge status="assistant" label="Assistant" tone="neutral" /> : null}
                          </div>
                        </div>
                        <div>
                          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                            <span>{formatNumber(c.enrollments)} students</span>
                            <span>avg {c.avgProgress}%</span>
                          </div>
                          <Progress value={c.avgProgress} className="h-1.5 [&>[data-slot=progress-indicator]]:bg-mint-strong" aria-label={`Average progress ${c.avgProgress}%`} />
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="grid content-start gap-8">
            <section>
              <SectionHeader title="Upcoming classes" actions={<Button asChild variant="ghost" size="sm"><Link href="/teach/live">All classes</Link></Button>} />
              {data.upcomingSessions.length === 0 ? (
                <EmptyState icon={Radio} title="No classes scheduled" action={<Button asChild size="sm"><Link href="/teach/live">Schedule a class</Link></Button>} />
              ) : (
                <ul className="grid gap-2">
                  {data.upcomingSessions.map((s) => {
                    const phase = sessionPhase(s.starts_at, s.duration_minutes);
                    return (
                      <li key={s.id}>
                        <Link href={`/teach/live/${s.id}`} className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 transition-colors hover:border-primary/30">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{s.title}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              <LocalTime value={s.starts_at} format="weekday" /> · {courseTitle.get(s.course_id)}
                            </p>
                          </div>
                          {phase === "live" ? (
                            <StatusBadge status="live" label="Live now" />
                          ) : (
                            <StatusBadge status={s.provider} label={PROVIDER_LABEL[s.provider as LiveProvider] ?? s.provider} tone="neutral" />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section>
              <SectionHeader title="Recent conversations" actions={<Button asChild variant="ghost" size="sm"><Link href="/teach/messages">Open messages</Link></Button>} />
              {data.conversations.length === 0 ? (
                <EmptyState icon={MessageSquare} title="No conversations yet" description="Students in your courses can message you directly." />
              ) : (
                <ul className="divide-y rounded-2xl border bg-card">
                  {data.conversations.map((c) => (
                    <li key={c.id}>
                      <Link href={`/teach/messages/${c.id}`} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
                        {c.unread ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" /> : <span className="mt-1.5 size-2 shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className={c.unread ? "truncate text-sm font-semibold" : "truncate text-sm font-medium"}>{c.otherName}</p>
                            <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(c.last_message_at)}</span>
                          </div>
                          {c.preview ? <p className="truncate text-xs text-muted-foreground">{c.preview}</p> : null}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <SectionHeader title="Notifications" actions={<Button asChild variant="ghost" size="sm"><Link href="/teach/notifications">View all</Link></Button>} />
              {data.notifications.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">You&apos;re all caught up.</p>
              ) : (
                <ul className="grid gap-2">
                  {data.notifications.map((n) => {
                    const body = (
                      <>
                        <p className={n.read_at ? "text-sm" : "text-sm font-semibold"}>{n.title}</p>
                        <p className="text-xs text-muted-foreground">{formatRelative(n.created_at)}</p>
                      </>
                    );
                    return (
                      <li key={n.id} className="rounded-xl border bg-card px-4 py-3">
                        {n.url ? (
                          <Link href={n.url} className="block hover:text-primary">
                            {body}
                          </Link>
                        ) : (
                          body
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
