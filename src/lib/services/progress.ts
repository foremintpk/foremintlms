import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SessionUser } from "@/lib/auth/session";
import { getCourseAccess } from "@/lib/services/access";
import { isReleased, lessonReleaseDate, computeLessonLocks } from "@/lib/domain/access";
import { shouldAutoComplete, videoPercent, type CompletionRule } from "@/components/learning/lib";
import { isAssignmentSatisfied, type SubmissionLike } from "@/lib/services/assignments/due";
import { issueCertificateIfEligible } from "@/lib/services/certificates";
import { notify } from "@/lib/services/notifications";
import { UserFacingError } from "@/lib/actions";

/**
 * Lesson progress and completion. All writes use the service role after the
 * learner's access to the lesson has been re-verified here — the client can
 * never mark progress directly (no RLS write policy exists).
 */

interface LessonContext {
  id: string;
  course_id: string;
  module_id: string;
  is_published: boolean;
  is_preview: boolean;
  completion_rule: CompletionRule;
  release_at: string | null;
  release_after_days: number | null;
  prerequisite_lesson_id: string | null;
  course_modules: { is_published: boolean; release_at: string | null; release_after_days: number | null } | null;
  courses: { id: string; status: string; sequential_progression: boolean; title: string; slug: string } | null;
}

async function loadLesson(lessonId: string): Promise<LessonContext | null> {
  const { data } = await createAdminClient()
    .from("lessons")
    .select(
      "id, course_id, module_id, is_published, is_preview, completion_rule, release_at, release_after_days, prerequisite_lesson_id, course_modules(is_published, release_at, release_after_days), courses(id, status, sequential_progression, title, slug)",
    )
    .eq("id", lessonId)
    .maybeSingle();
  return (data as unknown as LessonContext | null) ?? null;
}

/**
 * Verifies the learner may record progress on this lesson: active access,
 * published, released (drip) and not locked by sequence/prerequisites.
 * Staff previews are not tracked.
 */
export async function assertLessonTrackable(user: SessionUser, lessonId: string) {
  const lesson = await loadLesson(lessonId);
  if (!lesson || !lesson.courses || !lesson.course_modules) throw new UserFacingError("Lesson not found.");
  const access = await getCourseAccess(user, { id: lesson.course_id, status: lesson.courses.status });
  if (!access.hasAccess) throw new UserFacingError("You don't have access to this course.");
  if (access.isStaff && !access.enrollment) return { lesson, access, tracked: false as const };
  if (!lesson.is_published || !lesson.course_modules.is_published) throw new UserFacingError("This lesson isn't available.");
  const release = lessonReleaseDate(lesson, lesson.course_modules, access.enrollment ? new Date(access.enrollment.enrolled_at) : null);
  if (!access.isStaff && !isReleased(release)) throw new UserFacingError("This lesson hasn't been released yet.");
  if (!access.isStaff) {
    const lock = await lessonLock(user.id, lesson);
    if (lock) throw new UserFacingError("Complete the earlier lessons first.");
  }
  return { lesson, access, tracked: Boolean(access.enrollment) };
}

async function lessonLock(userId: string, lesson: LessonContext) {
  if (!lesson.courses?.sequential_progression && !lesson.prerequisite_lesson_id) return null;
  const admin = createAdminClient();
  const [modulesRes, lessonsRes, doneRes] = await Promise.all([
    admin.from("course_modules").select("id, sort_order").eq("course_id", lesson.course_id).eq("is_published", true).order("sort_order").order("created_at"),
    admin
      .from("lessons")
      .select("id, module_id, sort_order, prerequisite_lesson_id")
      .eq("course_id", lesson.course_id)
      .eq("is_published", true)
      .order("sort_order")
      .order("created_at"),
    admin.from("lesson_progress").select("lesson_id").eq("user_id", userId).eq("course_id", lesson.course_id).eq("status", "completed"),
  ]);
  const modules = (modulesRes.data ?? []) as { id: string }[];
  const lessons = (lessonsRes.data ?? []) as { id: string; module_id: string; prerequisite_lesson_id: string | null }[];
  const ordered = modules.flatMap((m) => lessons.filter((l) => l.module_id === m.id));
  const completed = new Set(((doneRes.data ?? []) as { lesson_id: string }[]).map((r) => r.lesson_id));
  return computeLessonLocks(ordered, completed, Boolean(lesson.courses?.sequential_progression)).get(lesson.id) ?? null;
}

export interface ProgressInput {
  lessonId: string;
  positionSeconds: number;
  durationSeconds: number | null;
}

/** Record playback position (resume) and auto-complete "video_watched" lessons. */
export async function recordVideoProgress(user: SessionUser, input: ProgressInput) {
  const { lesson, tracked } = await assertLessonTrackable(user, input.lessonId);
  if (!tracked) return { completed: false, percent: 0 };
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("lesson_progress")
    .select("id, status, progress_percent")
    .eq("user_id", user.id)
    .eq("lesson_id", lesson.id)
    .maybeSingle();

  const duration = input.durationSeconds && input.durationSeconds > 0 ? input.durationSeconds : null;
  const percent = Math.max(Number(existing?.progress_percent ?? 0), videoPercent(input.positionSeconds, duration));
  const now = new Date().toISOString();
  const values = {
    user_id: user.id,
    lesson_id: lesson.id,
    course_id: lesson.course_id,
    video_position_seconds: Math.max(0, Math.round(input.positionSeconds * 100) / 100),
    video_duration_seconds: duration,
    progress_percent: Math.min(100, percent),
    last_viewed_at: now,
    status: existing?.status === "completed" ? "completed" : "in_progress",
  };
  const { error } = await admin.from("lesson_progress").upsert(values, { onConflict: "user_id,lesson_id" });
  if (error) throw new Error(`progress upsert failed: ${error.message}`);

  if (existing?.status !== "completed" && shouldAutoComplete(lesson.completion_rule, percent)) {
    await completeLesson(user.id, lesson.id, lesson.course_id);
    return { completed: true, percent };
  }
  return { completed: existing?.status === "completed", percent };
}

/** Called when a learner opens a lesson: remembers it for "continue learning". */
export async function touchLesson(userId: string, courseId: string, lessonId: string) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  await Promise.all([
    admin.from("enrollments").update({ last_lesson_id: lessonId, last_accessed_at: now }).eq("user_id", userId).eq("course_id", courseId),
    admin
      .from("lesson_progress")
      .upsert(
        { user_id: userId, lesson_id: lessonId, course_id: courseId, last_viewed_at: now },
        { onConflict: "user_id,lesson_id", ignoreDuplicates: true },
      ),
  ]);
  await admin.from("lesson_progress").update({ last_viewed_at: now }).eq("user_id", userId).eq("lesson_id", lessonId);
}

/** Learner clicks "Mark as complete" on a lesson whose rule is manual. */
export async function markLessonCompleteManually(user: SessionUser, lessonId: string) {
  const { lesson, tracked } = await assertLessonTrackable(user, lessonId);
  if (!tracked) throw new UserFacingError("Previews aren't tracked.");
  if (lesson.completion_rule !== "manual") {
    throw new UserFacingError(
      lesson.completion_rule === "video_watched"
        ? "This lesson completes when you've watched the video."
        : lesson.completion_rule === "quiz_passed"
          ? "This lesson completes when you pass its quiz."
          : "This lesson completes when your assignment is approved.",
    );
  }
  return completeLesson(user.id, lesson.id, lesson.course_id);
}

/** Learner undoes a manual completion (e.g. wants to revisit). */
export async function markLessonIncomplete(user: SessionUser, lessonId: string) {
  const { lesson, tracked } = await assertLessonTrackable(user, lessonId);
  if (!tracked || lesson.completion_rule !== "manual") throw new UserFacingError("This lesson can't be reset.");
  const admin = createAdminClient();
  await admin
    .from("lesson_progress")
    .update({ status: "in_progress", completed_at: null })
    .eq("user_id", user.id)
    .eq("lesson_id", lesson.id);
  await recalcCourseProgress(user.id, lesson.course_id);
}

/** Mark a lesson complete (idempotent) and roll up course completion. */
export async function completeLesson(userId: string, lessonId: string, courseId: string) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: existing } = await admin
    .from("lesson_progress")
    .select("id, status")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .maybeSingle();
  if (existing?.status === "completed") return { completed: true, courseCompleted: false };
  const { error } = await admin.from("lesson_progress").upsert(
    {
      user_id: userId,
      lesson_id: lessonId,
      course_id: courseId,
      status: "completed",
      progress_percent: 100,
      completed_at: now,
      last_viewed_at: now,
    },
    { onConflict: "user_id,lesson_id" },
  );
  if (error) throw new Error(`complete lesson failed: ${error.message}`);
  const courseCompleted = await recalcCourseProgress(userId, courseId);
  return { completed: true, courseCompleted };
}

/**
 * Recalculate the enrollment's progress; mark the course completed when all
 * published lessons are done; issue a certificate when the course rules are
 * met. Returns true when the course became complete in this call.
 */
export async function recalcCourseProgress(userId: string, courseId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: percent, error } = await admin.rpc("recalculate_enrollment_progress", { p_user: userId, p_course: courseId });
  if (error) throw new Error(`recalculate progress failed: ${error.message}`);
  const pct = Number(percent ?? 0);

  const { data: enrollment } = await admin
    .from("enrollments")
    .select("id, status, completed_at")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (!enrollment) return false;

  let becameComplete = false;
  if (pct >= 100 && enrollment.status !== "completed") {
    await admin.from("enrollments").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", enrollment.id);
    becameComplete = true;
    const { data: course } = await admin.from("courses").select("title, slug").eq("id", courseId).single();
    if (course) {
      await notify(userId, {
        category: "learning",
        type: "course_completed",
        title: `You completed ${course.title}`,
        body: "Great work. Check your certificate status on the course page.",
        url: `/learn/courses/${course.slug}`,
      });
    }
  }

  const { data: course } = await admin.from("courses").select("certificate_enabled, certificate_min_progress").eq("id", courseId).single();
  if (course?.certificate_enabled && pct >= Number(course.certificate_min_progress)) {
    await issueCertificateIfEligible(userId, courseId);
  }
  return becameComplete;
}

/** Lessons whose completion depends on a quiz or assignment. */
async function lessonsLinkedTo(courseId: string, ref: { quizId?: string; assignmentId?: string }) {
  const admin = createAdminClient();
  const rule = ref.quizId ? "quiz_passed" : "assignment_approved";
  const column = ref.quizId ? "quiz_id" : "assignment_id";
  const id = (ref.quizId ?? ref.assignmentId)!;
  const [blocks, direct] = await Promise.all([
    admin.from("lesson_content_blocks").select("lesson_id").eq("course_id", courseId).eq(column, id),
    ref.quizId
      ? admin.from("quizzes").select("lesson_id").eq("id", id).maybeSingle()
      : admin.from("assignments").select("lesson_id").eq("id", id).maybeSingle(),
  ]);
  const ids = new Set<string>(((blocks.data ?? []) as { lesson_id: string }[]).map((b) => b.lesson_id));
  const directLesson = (direct.data as { lesson_id: string | null } | null)?.lesson_id;
  if (directLesson) ids.add(directLesson);
  if (ids.size === 0) return [];
  const { data } = await admin
    .from("lessons")
    .select("id, completion_rule, quiz_blocks:lesson_content_blocks(quiz_id), assignment_blocks:lesson_content_blocks(assignment_id)")
    .in("id", [...ids])
    .eq("completion_rule", rule);
  return (data ?? []) as unknown as {
    id: string;
    completion_rule: "quiz_passed" | "assignment_approved";
    quiz_blocks: { quiz_id: string | null }[];
    assignment_blocks: { assignment_id: string | null }[];
  }[];
}

async function quizPassed(userId: string, quizId: string) {
  const { count } = await createAdminClient()
    .from("quiz_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("quiz_id", quizId)
    .eq("passed", true);
  return (count ?? 0) > 0;
}

async function assignmentSatisfied(userId: string, assignmentId: string) {
  const admin = createAdminClient();
  const [{ data: assignment }, { data: subs }] = await Promise.all([
    admin.from("assignments").select("passing_points").eq("id", assignmentId).maybeSingle(),
    admin
      .from("assignment_submissions")
      .select("status, grade_points")
      .eq("user_id", userId)
      .eq("assignment_id", assignmentId)
      .order("attempt_number", { ascending: false })
      .limit(1),
  ]);
  const latest = ((subs ?? []) as SubmissionLike[])[0];
  return isAssignmentSatisfied(latest, { passing_points: assignment?.passing_points ?? null });
}

/**
 * Contract for the teaching workstream: call after approving an assignment
 * or finishing a manual quiz review. Completes the dependent lessons (only if
 * every quiz/assignment the lesson relies on is satisfied), recalculates
 * progress, completes the course and issues the certificate when eligible.
 */
export async function syncCompletionAfterGrading(input: {
  userId: string;
  courseId: string;
  assignmentId?: string;
  quizId?: string;
}): Promise<void> {
  const linked = input.quizId || input.assignmentId ? await lessonsLinkedTo(input.courseId, input) : [];
  for (const lesson of linked) {
    const quizIds = [...new Set(lesson.quiz_blocks.map((b) => b.quiz_id).filter(Boolean))] as string[];
    const assignmentIds = [...new Set(lesson.assignment_blocks.map((b) => b.assignment_id).filter(Boolean))] as string[];
    if (input.quizId && !quizIds.includes(input.quizId)) quizIds.push(input.quizId);
    if (input.assignmentId && !assignmentIds.includes(input.assignmentId)) assignmentIds.push(input.assignmentId);
    const ok =
      lesson.completion_rule === "quiz_passed"
        ? (await Promise.all(quizIds.map((id) => quizPassed(input.userId, id)))).every(Boolean)
        : (await Promise.all(assignmentIds.map((id) => assignmentSatisfied(input.userId, id)))).every(Boolean);
    if (ok) await completeLesson(input.userId, lesson.id, input.courseId);
  }
  // Certificates may have been waiting only on this quiz/assignment.
  await recalcCourseProgress(input.userId, input.courseId);
}
