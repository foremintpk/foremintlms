import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import {
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  CalendarClock,
  ClipboardList,
  Compass,
  History,
  Megaphone,
  Radio,
} from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { LocalTime } from "@/components/common/local-time";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CourseThumb, LearnerCourseCardView } from "@/components/learning/course-card";
import { ProgressBar, ProgressRing } from "@/components/learning/progress-bar";
import { requireUser } from "@/lib/auth/guards";
import { getLearnerDashboard } from "@/lib/services/learner";
import { stripHtml } from "@/lib/sanitize";
import { formatDuration } from "@/lib/format";
import { liveJoinState } from "@/components/learning/lib";

export const instant = false;

export const metadata: Metadata = { title: "Dashboard" };

const PROVIDER: Record<string, string> = { zoom: "Zoom", google_meet: "Google Meet", external: "Online" };

export default async function LearnDashboardPage() {
  const user = await requireUser("/learn");
  return (
    <>
      <PageHeader
        title={`Welcome back, ${user.displayName}`}
        description="Pick up where you left off, see what's due and join your next live class."
        actions={
          <Button asChild variant="outline">
            <Link href="/courses">
              <Compass /> Browse courses
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </>
  );
}

async function DashboardContent() {
  const user = await requireUser("/learn");
  const data = await getLearnerDashboard(user);
  const now = new Date();
  const active = data.courses.filter((c) => c.bucket === "active");
  const cont = data.continueCourse;

  if (data.courses.length === 0 && !data.allAccess.active) {
    return (
      <div className="space-y-10">
        <EmptyState
          icon={BookOpen}
          title="You're not enrolled in a course yet"
          description="Browse the catalogue, preview lessons for free and enroll when you're ready."
          action={
            <Button asChild>
              <Link href="/courses">Explore courses</Link>
            </Button>
          }
        />
        <Recommended data={data} />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {cont ? (
          <article className="grid overflow-hidden rounded-2xl border bg-card shadow-card sm:grid-cols-[minmax(0,15rem)_1fr]">
            <CourseThumb src={cont.thumbnailUrl} alt="" className="sm:aspect-auto sm:h-full" />
            <div className="flex flex-col gap-3 p-5">
              <p className="text-sm font-medium text-muted-foreground">Continue learning</p>
              <h2 className="font-heading text-xl leading-snug font-semibold">{cont.title}</h2>
              {cont.instructors.length ? <p className="text-sm text-muted-foreground">{cont.instructors.join(", ")}</p> : null}
              <ProgressBar value={cont.progressPercent} showValue label="Course progress" />
              <p className="text-xs text-muted-foreground tabular-nums">
                {cont.completedLessons} of {cont.totalLessons} lessons complete
                {cont.lastAccessedAt ? (
                  <>
                    {" "}
                    · last opened <LocalTime value={cont.lastAccessedAt} format="relative" />
                  </>
                ) : null}
              </p>
              <Button asChild className="mt-auto w-fit">
                <Link href={cont.lastLessonId ? `/learn/courses/${cont.slug}/lessons/${cont.lastLessonId}` : `/learn/courses/${cont.slug}`}>
                  {cont.progressPercent > 0 ? "Continue" : "Start course"} <ArrowRight />
                </Link>
              </Button>
            </div>
          </article>
        ) : (
          <EmptyState
            icon={BookOpen}
            title={data.allAccess.active ? "Your membership includes every course" : "All caught up"}
            description={data.allAccess.active ? "Open any course from your library to start learning." : "You've finished your active courses. Find your next skill."}
            action={
              <Button asChild>
                <Link href="/learn/courses">{data.allAccess.active ? "Open library" : "My courses"}</Link>
              </Button>
            }
          />
        )}
        <div className="flex items-center gap-5 rounded-2xl border bg-card p-5 shadow-card">
          <ProgressRing value={data.overallProgress} size={88} label={`Overall progress ${data.overallProgress}%`} />
          <dl className="grid flex-1 grid-cols-1 gap-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Lessons completed</dt>
              <dd className="font-semibold tabular-nums">{data.totals.lessonsCompleted}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Courses completed</dt>
              <dd className="font-semibold tabular-nums">{data.totals.coursesCompleted}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Certificates</dt>
              <dd className="font-semibold tabular-nums">{data.totals.certificates}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="grid gap-10 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-10">
          <section>
            <SectionHeader
              title="Your courses"
              actions={
                <Button asChild variant="ghost" size="sm">
                  <Link href="/learn/courses">
                    View all <ArrowRight />
                  </Link>
                </Button>
              }
            />
            {active.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {active.slice(0, 4).map((c) => (
                  <LearnerCourseCardView key={c.enrollmentId} card={c} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active courses right now.</p>
            )}
          </section>

          <section>
            <SectionHeader title="Assignments" description="Work to submit, sorted by due date." />
            {data.assignments.filter((a) => a.status === "not_started" || a.status === "overdue" || a.status === "resubmission_requested").length ? (
              <ul className="divide-y rounded-2xl border bg-card">
                {data.assignments
                  .filter((a) => a.status === "not_started" || a.status === "overdue" || a.status === "resubmission_requested")
                  .map((a) => (
                    <li key={a.id}>
                      <Link
                        href={`/learn/courses/${a.courseSlug}/assignments/${a.id}`}
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                      >
                        <ClipboardList className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{a.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">{a.courseTitle}</span>
                        </span>
                        {a.dueAt ? (
                          <span className="hidden text-xs text-muted-foreground sm:block">
                            Due <LocalTime value={a.dueAt} format="date" />
                          </span>
                        ) : null}
                        <StatusBadge status={a.status === "not_started" ? "pending" : a.status} label={a.status === "not_started" ? "To do" : undefined} />
                      </Link>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing due. Nice work.</p>
            )}
          </section>

          {data.history.length ? (
            <section>
              <SectionHeader title="Recently viewed" />
              <ul className="space-y-1">
                {data.history.map((h) => (
                  <li key={h.lessonId}>
                    <Link
                      href={`/learn/courses/${h.courseSlug}/lessons/${h.lessonId}`}
                      className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-muted"
                    >
                      <History className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">
                        {h.lessonTitle} <span className="text-muted-foreground">· {h.courseTitle}</span>
                      </span>
                      <LocalTime value={h.viewedAt} format="relative" className="shrink-0 text-xs text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <div className="space-y-10">
          <section>
            <SectionHeader
              title="Upcoming live classes"
              actions={
                <Button asChild variant="ghost" size="sm">
                  <Link href="/learn/live">All classes</Link>
                </Button>
              }
            />
            {data.sessions.length ? (
              <ul className="space-y-2">
                {data.sessions.map((s) => {
                  const state = liveJoinState(s.startsAt, s.durationMinutes, s.status, now);
                  return (
                    <li key={s.id} className="rounded-xl border bg-card p-3">
                      <div className="flex items-start gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-primary">
                          <Radio className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{s.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{s.courseTitle}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            <LocalTime value={s.startsAt} format="weekday" /> · {formatDuration(s.durationMinutes)} · {PROVIDER[s.provider] ?? "Online"}
                          </p>
                        </div>
                        {state === "joinable" ? (
                          <Button asChild size="sm">
                            <a href={`/api/live/${s.id}/join`} target="_blank" rel="noopener">
                              Join
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarClock className="size-4" /> No live classes scheduled.
              </p>
            )}
          </section>

          <section>
            <SectionHeader title="Announcements" />
            {data.announcements.length ? (
              <ul className="space-y-3">
                {data.announcements.map((a) => (
                  <li key={a.id} className="rounded-xl border bg-card p-3">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <Megaphone className="size-4 text-primary" /> {a.title}
                    </p>
                    <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{stripHtml(a.body)}</p>
                    <LocalTime value={a.published_at} format="date" className="mt-1 block text-xs text-muted-foreground" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No announcements.</p>
            )}
          </section>

          <section>
            <SectionHeader
              title="Notifications"
              actions={
                <Button asChild variant="ghost" size="sm">
                  <Link href="/learn/notifications">View all</Link>
                </Button>
              }
            />
            {data.notifications.length ? (
              <ul className="space-y-1">
                {data.notifications.map((n) => {
                  const content = (
                    <>
                      <Bell className={`mt-0.5 size-4 shrink-0 ${n.read_at ? "text-muted-foreground" : "text-primary"}`} />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm ${n.read_at ? "" : "font-medium"}`}>{n.title}</span>
                        <LocalTime value={n.created_at} format="relative" className="text-xs text-muted-foreground" />
                      </span>
                    </>
                  );
                  return (
                    <li key={n.id}>
                      {n.url && n.url.startsWith("/") ? (
                        <Link href={n.url} className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-muted">
                          {content}
                        </Link>
                      ) : (
                        <div className="flex items-start gap-3 px-2 py-2">{content}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">You&apos;re all caught up.</p>
            )}
          </section>

          <section>
            <SectionHeader title="Achievements" />
            {data.certificates.length ? (
              <ul className="space-y-2">
                {data.certificates.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                    <span className="grid size-9 place-items-center rounded-lg bg-mint-soft text-mint-strong">
                      <Award className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.course_title}</span>
                      <span className="block text-xs text-muted-foreground">
                        Issued <LocalTime value={c.issued_at} format="date" />
                      </span>
                    </span>
                    <Button asChild variant="outline" size="sm">
                      <a href={`/api/certificates/${c.id}/pdf`} target="_blank" rel="noopener">
                        View
                      </a>
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Finish a course to earn your first certificate.</p>
            )}
          </section>
        </div>
      </div>

      <Recommended data={data} />
    </div>
  );
}

function Recommended({ data }: { data: Awaited<ReturnType<typeof getLearnerDashboard>> }) {
  if (data.recommended.length === 0) return null;
  return (
    <section>
      <SectionHeader title="Recommended for you" description="Courses related to what you're learning." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.recommended.map((c) => (
          <Link key={c.id} href={`/courses/${c.slug}`} className="group overflow-hidden rounded-2xl border bg-card shadow-card transition-colors hover:border-primary/30">
            <CourseThumb src={c.thumbnailUrl} alt="" />
            <div className="space-y-1 p-4">
              <p className="font-heading font-semibold group-hover:text-primary">{c.title}</p>
              {c.shortDescription ? <p className="line-clamp-2 text-sm text-muted-foreground">{c.shortDescription}</p> : null}
              <p className="text-xs text-muted-foreground">
                {c.totalLessons} lessons{c.instructors.length ? ` · ${c.instructors.join(", ")}` : ""}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Skeleton className="h-52 rounded-2xl" />
        <Skeleton className="h-52 rounded-2xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-72 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
