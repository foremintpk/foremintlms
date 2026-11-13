import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  AlertCircle,
  ArrowRight,
  Award,
  CalendarClock,
  CheckCircle2,
  Circle,
  Download,
  MessagesSquare,
  PauseCircle,
  Radio,
  ShieldAlert,
} from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/app-shell/page-header";
import { LocalTime } from "@/components/common/local-time";
import { Button } from "@/components/ui/button";
import { CourseOutline } from "@/components/learning/course-outline";
import { CopyButton } from "@/components/learning/copy-button";
import { isoHoursAgo } from "@/components/learning/lib";
import { ProgressBar } from "@/components/learning/progress-bar";
import { ReviewForm } from "@/components/learning/review-form";
import { CourseThumb } from "@/components/learning/course-card";
import { requireUser } from "@/lib/auth/guards";
import { appUrl } from "@/lib/env";
import { formatDuration } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { ensureEnrollment, getCourseAccess } from "@/lib/services/access";
import { evaluateCertificate } from "@/lib/services/certificates";
import { getCourseBySlug, getCourseOutline, getInstructors, pickResumeLesson } from "@/lib/services/learner";

export const instant = false;

export async function generateMetadata({ params }: PageProps<"/learn/courses/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  return { title: course?.title ?? "Course" };
}

const NO_ACCESS: Record<string, { icon: typeof AlertCircle; title: string; body: string }> = {
  none: { icon: Circle, title: "You're not enrolled in this course", body: "Choose a plan to unlock every lesson. Free preview lessons are open now." },
  expired: { icon: CalendarClock, title: "Your access to this course has ended", body: "Your progress is saved. Renew to continue exactly where you left off." },
  revoked: { icon: ShieldAlert, title: "Access to this course was removed", body: "If you think this is a mistake, contact support and we'll look into it." },
  suspended: { icon: PauseCircle, title: "Access is paused", body: "There's an open payment issue on this purchase. Check your billing page or contact support." },
  course_unavailable: { icon: AlertCircle, title: "This course isn't available right now", body: "The instructor is updating it. Check back soon." },
};

export default async function CourseOverviewPage({ params }: PageProps<"/learn/courses/[slug]">) {
  const { slug } = await params;
  const user = await requireUser(`/learn/courses/${slug}`);
  const course = await getCourseBySlug(slug);
  if (!course) notFound();

  const access = await getCourseAccess(user, course);
  const publiclyVisible = course.status === "published" && course.visibility !== "private";
  if (!access.hasAccess && !access.enrollment && !publiclyVisible) notFound();

  let enrolledAt = access.enrollment?.enrolled_at ?? null;
  if (access.hasAccess && !access.isStaff && !access.enrollment) {
    // All-access members are enrolled when they first open a course.
    await ensureEnrollment(user.id, course.id, "membership");
    enrolledAt = new Date().toISOString();
  }

  const supabase = await createClient();
  const [outline, instructors, certificate, reviewRes, sessionsRes] = await Promise.all([
    getCourseOutline(course, user.id, { isStaff: access.isStaff, enrolledAt }),
    getInstructors([course.id]),
    access.enrollment || enrolledAt ? evaluateCertificate(user.id, course.id) : Promise.resolve(null),
    supabase.from("course_reviews").select("rating, title, body, status").eq("course_id", course.id).eq("user_id", user.id).maybeSingle(),
    access.hasAccess
      ? supabase
          .from("live_sessions")
          .select("id", { count: "exact", head: true })
          .eq("course_id", course.id)
          .in("status", ["scheduled", "live"])
          .gte("starts_at", isoHoursAgo(3))
      : Promise.resolve({ count: 0 }),
  ]);
  const resume = access.hasAccess ? pickResumeLesson(outline, access.enrollment?.last_lesson_id ?? null) : null;
  const progress = access.enrollment ? access.enrollment.progress_percent : 0;
  const teachers = instructors.get(course.id) ?? [];
  const previewCount = outline.lessons.filter((l) => l.isPreview).length;
  const upcomingCount = sessionsRes.count ?? 0;
  const noAccess = !access.hasAccess ? NO_ACCESS[access.reason] ?? NO_ACCESS.none : null;
  const enrolled = Boolean(access.enrollment || enrolledAt);

  return (
    <>
      <PageHeader title={course.title} description={course.short_description} back={{ href: "/learn/courses", label: "My courses" }} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-8">
          {noAccess ? (
            <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-warning-soft text-warning">
                <noAccess.icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{noAccess.title}</p>
                <p className="text-sm text-muted-foreground">
                  {noAccess.body}
                  {access.reason === "none" && previewCount === 0 ? " This course has no preview lessons." : ""}
                </p>
              </div>
              {access.reason === "none" || access.reason === "expired" ? (
                <Button asChild>
                  <Link href={`/courses/${course.slug}#pricing`}>{access.reason === "expired" ? "Renew access" : "See plans"}</Link>
                </Button>
              ) : access.reason === "suspended" ? (
                <Button asChild variant="outline">
                  <Link href="/learn/billing">Open billing</Link>
                </Button>
              ) : access.reason === "revoked" ? (
                <Button asChild variant="outline">
                  <Link href="/learn/support/new">Contact support</Link>
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border bg-card p-5 shadow-card">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {access.isStaff && !access.enrollment
                      ? "You're viewing this course as staff — progress isn't tracked."
                      : `${outline.completedLessons} of ${outline.totalLessons} lessons complete`}
                  </p>
                  {!access.isStaff || access.enrollment ? <ProgressBar value={progress} showValue label="Course progress" /> : null}
                  {access.expiresAt ? (
                    <p className="text-xs text-muted-foreground">
                      Access until <LocalTime value={access.expiresAt} format="date" />
                    </p>
                  ) : null}
                </div>
                {resume ? (
                  <Button asChild size="lg">
                    <Link href={`/learn/courses/${course.slug}/lessons/${resume.id}`}>
                      {progress > 0 ? "Continue learning" : "Start course"} <ArrowRight />
                    </Link>
                  </Button>
                ) : outline.totalLessons > 0 && outline.completedLessons === outline.totalLessons ? (
                  <span className="inline-flex items-center gap-2 rounded-lg bg-mint-soft px-3 py-2 text-sm font-medium text-mint-strong">
                    <CheckCircle2 className="size-4" /> Course complete
                  </span>
                ) : null}
              </div>
            </div>
          )}

          <section>
            <SectionHeader
              title="Curriculum"
              description={`${outline.totalLessons} lessons${course.estimated_duration_minutes ? ` · about ${formatDuration(course.estimated_duration_minutes)}` : ""}`}
            />
            <CourseOutline courseSlug={course.slug} modules={outline.modules} canOpen={access.hasAccess} previewOnly={!access.hasAccess && publiclyVisible} />
          </section>

          {enrolled && !access.isStaff ? (
            <section>
              <SectionHeader title="Rate this course" description="Reviews are checked by our team before they appear on the course page." />
              <div className="rounded-2xl border bg-card p-5">
                <ReviewForm courseId={course.id} existing={(reviewRes.data as { rating: number; title: string | null; body: string | null; status: string } | null) ?? null} />
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-6">
          <div className="overflow-hidden rounded-2xl border bg-card">
            <CourseThumb src={course.thumbnail_url} alt="" />
            {teachers.length ? (
              <div className="p-4 text-sm">
                <p className="text-muted-foreground">Instructor{teachers.length > 1 ? "s" : ""}</p>
                <ul className="mt-2 space-y-2">
                  {teachers.map((t) => (
                    <li key={t.userId} className="flex items-center justify-between gap-2">
                      <span className="font-medium">{t.name}</span>
                      {access.hasAccess && !access.isStaff ? (
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/learn/messages?to=${t.userId}`}>Message</Link>
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {access.hasAccess ? (
            <nav className="space-y-2" aria-label="Course community">
              {course.discussions_enabled ? (
                <Link
                  href={`/learn/courses/${course.slug}/discussions`}
                  className="flex items-center gap-3 rounded-xl border bg-card p-3 text-sm transition-colors hover:border-primary/40"
                >
                  <MessagesSquare className="size-4 text-primary" />
                  <span className="flex-1 font-medium">Course discussions</span>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </Link>
              ) : null}
              <Link href="/learn/live" className="flex items-center gap-3 rounded-xl border bg-card p-3 text-sm transition-colors hover:border-primary/40">
                <Radio className="size-4 text-primary" />
                <span className="flex-1 font-medium">Live classes</span>
                <span className="text-xs text-muted-foreground">{upcomingCount ? `${upcomingCount} upcoming` : "None scheduled"}</span>
              </Link>
            </nav>
          ) : null}

          {course.certificate_enabled && certificate ? (
            <section className="rounded-2xl border bg-card p-5" aria-labelledby="certificate-heading">
              <h2 id="certificate-heading" className="flex items-center gap-2 font-semibold">
                <Award className="size-4 text-mint-strong" /> Certificate
              </h2>
              {certificate.certificate ? (
                <div className="mt-3 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Issued <LocalTime value={certificate.certificate.issued_at} format="date" /> · {certificate.certificate.certificate_number}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <a href={`/api/certificates/${certificate.certificate.id}/pdf?download=1`}>
                        <Download /> Download PDF
                      </a>
                    </Button>
                    <CopyButton value={appUrl(`/certificates/verify/${certificate.certificate.certificate_number}`)} label="Copy verify link" />
                  </div>
                </div>
              ) : (
                <div className="mt-3 space-y-2 text-sm">
                  <p className="text-muted-foreground">To earn your certificate:</p>
                  {certificate.missing.length ? (
                    <ul className="space-y-1.5">
                      {certificate.missing.map((m) => (
                        <li key={m} className="flex gap-2">
                          <Circle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" /> {m}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="flex items-center gap-2 text-mint-strong">
                      <CheckCircle2 className="size-4" /> All requirements met — your certificate is being issued.
                    </p>
                  )}
                </div>
              )}
            </section>
          ) : null}

          {course.learning_outcomes?.length ? (
            <section className="rounded-2xl border bg-card p-5">
              <h2 className="font-semibold">What you&apos;ll learn</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {course.learning_outcomes.map((o) => (
                  <li key={o} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-mint-strong" /> {o}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </>
  );
}
