import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, Clock, Eye, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LocalTime } from "@/components/common/local-time";
import { LessonDiscussions } from "@/components/communication/lesson-discussions";
import { ContentBlocks, ResourceList, blocksHaveVideo } from "@/components/learning/content-blocks";
import { CourseOutline, lessonBlockedReason } from "@/components/learning/course-outline";
import { LessonShell } from "@/components/learning/lesson-shell";
import { LessonTools } from "@/components/learning/lesson-tools";
import { MarkCompleteButton } from "@/components/learning/mark-complete-button";
import { resumePosition } from "@/components/learning/lib";
import { requireUser } from "@/lib/auth/guards";
import { formatDuration } from "@/lib/format";
import { ensureEnrollment, getCourseAccess } from "@/lib/services/access";
import {
  getCourseBySlug,
  getCourseOutline,
  getLessonBlocks,
  getLessonDetail,
  getLessonNotesAndBookmarks,
  getLessonResources,
} from "@/lib/services/learner";
import { touchLesson } from "@/lib/services/progress";

export const instant = false;

export async function generateMetadata({ params }: PageProps<"/learn/courses/[slug]/lessons/[lessonId]">): Promise<Metadata> {
  const { lessonId } = await params;
  const lesson = await getLessonDetail(lessonId);
  return { title: lesson?.title ?? "Lesson" };
}

export default async function LessonPage({ params }: PageProps<"/learn/courses/[slug]/lessons/[lessonId]">) {
  const { slug, lessonId } = await params;
  const user = await requireUser(`/learn/courses/${slug}/lessons/${lessonId}`);
  const [course, lesson] = await Promise.all([getCourseBySlug(slug), getLessonDetail(lessonId)]);
  if (!course || !lesson || lesson.course_id !== course.id) notFound();

  const access = await getCourseAccess(user, course);
  const publicCourse = course.status === "published" && course.visibility !== "private";
  const isPreview = lesson.is_preview && lesson.is_published && Boolean(lesson.course_modules?.is_published) && publicCourse;
  if (!access.hasAccess && !isPreview) redirect(`/learn/courses/${slug}`);

  const mode: "learner" | "staff" | "preview" = access.hasAccess ? (access.isStaff && !access.enrollment ? "staff" : "learner") : "preview";
  let enrolledAt = access.enrollment?.enrolled_at ?? null;
  if (mode === "learner" && !access.enrollment) {
    await ensureEnrollment(user.id, course.id, "membership");
    enrolledAt = new Date().toISOString();
  }

  const outline = await getCourseOutline(course, user.id, { isStaff: access.isStaff, enrolledAt });
  const current = outline.lessons.find((l) => l.id === lesson.id);
  if (!current) notFound();

  const outlineNode = (
    <CourseOutline courseSlug={course.slug} modules={outline.modules} activeLessonId={lesson.id} canOpen={mode !== "preview"} previewOnly={mode === "preview"} compact />
  );
  const shellProps = {
    courseTitle: course.title,
    courseHref: `/learn/courses/${course.slug}`,
    progress: mode === "learner" ? (access.enrollment?.progress_percent ?? 0) : null,
    outline: outlineNode,
  };

  // Drip schedule and completion order are enforced here, not just hidden.
  const blocked = mode === "learner" ? lessonBlockedReason(current) : null;
  if (blocked) {
    return (
      <LessonShell {...shellProps} aside={null}>
        <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
            {current.released ? <Lock className="size-6" /> : <Clock className="size-6" />}
          </span>
          <h1 className="text-2xl font-semibold">{lesson.title}</h1>
          <p className="text-muted-foreground">
            {!current.released && current.releaseAt ? (
              <>
                This lesson opens <LocalTime value={current.releaseAt} format="weekday" />.
              </>
            ) : (
              `${blocked}.`
            )}
          </p>
          <Button asChild variant="outline">
            <Link href={`/learn/courses/${course.slug}`}>Back to the course</Link>
          </Button>
        </div>
      </LessonShell>
    );
  }

  if (mode === "learner") await touchLesson(user.id, course.id, lesson.id);

  const resume = mode === "learner" ? resumePosition(current.videoPositionSeconds, current.videoDurationSeconds) : 0;
  const [blocks, tools, resources] = await Promise.all([
    getLessonBlocks(user, { courseId: course.id, lessonId: lesson.id, enrolledAt, resumeSeconds: resume }),
    mode === "preview" ? Promise.resolve({ notes: [], bookmarks: [] }) : getLessonNotesAndBookmarks(lesson.id),
    getLessonResources(lesson.id, course.id),
  ]);

  const playable = outline.lessons.filter((l) => (mode === "preview" ? l.isPreview : !lessonBlockedReason(l) || mode === "staff"));
  const idx = playable.findIndex((l) => l.id === lesson.id);
  const prev = idx > 0 ? playable[idx - 1] : null;
  const next = idx >= 0 && idx < playable.length - 1 ? playable[idx + 1] : null;
  const hasCollectionBlock = blocks.some((b) => b.kind === "resource_collection");

  const aside =
    mode === "preview" ? (
      <div className="space-y-3 rounded-2xl border bg-card p-4 text-sm">
        <p className="font-semibold">Enjoying the preview?</p>
        <p className="text-muted-foreground">Enroll to unlock every lesson, save notes and track your progress.</p>
        <Button asChild className="w-full">
          <Link href={`/courses/${course.slug}#pricing`}>See plans</Link>
        </Button>
      </div>
    ) : (
      <LessonTools
        lessonId={lesson.id}
        notes={tools.notes}
        bookmarks={tools.bookmarks}
        hasVideo={blocksHaveVideo(blocks)}
        resources={
          <ResourceList
            resources={hasCollectionBlock ? [] : resources}
            empty={hasCollectionBlock ? "This lesson's resources are listed in the lesson." : "No resources for this lesson."}
          />
        }
      />
    );

  return (
    <LessonShell {...shellProps} aside={aside}>
      <article className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-2">
          {mode !== "learner" ? (
            <p className="inline-flex items-center gap-1.5 rounded-full bg-info-soft px-2.5 py-1 text-xs font-medium text-info">
              <Eye className="size-3.5" /> {mode === "staff" ? "Staff preview — progress isn't tracked" : "Free preview"}
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">{lesson.course_modules?.title}</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{lesson.title}</h1>
          {lesson.duration_minutes ? <p className="text-sm text-muted-foreground">{formatDuration(lesson.duration_minutes)}</p> : null}
        </header>

        <ContentBlocks blocks={blocks} courseSlug={course.slug} lessonId={lesson.id} lessonTitle={lesson.title} track={mode === "learner"} now={new Date()} />

        {lesson.summary ? (
          <section className="space-y-2 border-t pt-6">
            <h2 className="text-lg font-semibold">About this lesson</h2>
            <p className="whitespace-pre-wrap text-muted-foreground">{lesson.summary}</p>
          </section>
        ) : null}

        {mode === "learner" ? (
          <div className="border-t pt-6">
            <MarkCompleteButton lessonId={lesson.id} completed={current.status === "completed"} rule={lesson.completion_rule} />
          </div>
        ) : null}

        <nav
          aria-label="Lesson navigation"
          className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-10 -mx-4 flex items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 md:bottom-0"
        >
          {prev ? (
            <Button asChild variant="outline">
              <Link href={`/learn/courses/${course.slug}/lessons/${prev.id}`} aria-label={`Previous lesson: ${prev.title}`}>
                <ArrowLeft /> <span className="max-w-40 truncate max-sm:hidden">{prev.title}</span>
                <span className="sm:hidden">Previous</span>
              </Link>
            </Button>
          ) : (
            <span />
          )}
          {next ? (
            <Button asChild>
              <Link href={`/learn/courses/${course.slug}/lessons/${next.id}`} aria-label={`Next lesson: ${next.title}`}>
                <span className="max-w-40 truncate max-sm:hidden">{next.title}</span>
                <span className="sm:hidden">Next</span> <ArrowRight />
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link href={`/learn/courses/${course.slug}`}>Course overview</Link>
            </Button>
          )}
        </nav>

        {mode !== "preview" && course.discussions_enabled ? (
          <section className="border-t pt-8" aria-label="Questions about this lesson">
            <Suspense fallback={<Skeleton className="h-40 rounded-2xl" />}>
              <LessonDiscussions courseId={course.id} courseSlug={course.slug} lessonId={lesson.id} />
            </Suspense>
          </section>
        ) : null}
      </article>
    </LessonShell>
  );
}
