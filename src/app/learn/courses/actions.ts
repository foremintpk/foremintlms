"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { assertUser } from "@/lib/auth/guards";
import { ok, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { markLessonCompleteManually, markLessonIncomplete, assertLessonTrackable } from "@/lib/services/progress";
import { saveAttemptAnswers, startAttempt, submitAttempt } from "@/lib/services/quiz-attempts";
import { submitAssignment } from "@/lib/services/submissions";
import { getCourseAccess } from "@/lib/services/access";

/**
 * Learner actions. Each re-checks identity and access on the server; the
 * client only supplies ids and content.
 */

const uuid = z.uuid();

// ---------------------------------------------------------------------------
// Lesson completion
// ---------------------------------------------------------------------------

export async function markLessonCompleteAction(input: { lessonId: string }): Promise<ActionResult<{ courseCompleted: boolean }>> {
  return runAction(async () => {
    const user = await assertUser();
    const { lessonId } = z.object({ lessonId: uuid }).parse(input);
    const result = await markLessonCompleteManually(user, lessonId);
    refresh();
    return ok({ courseCompleted: result.courseCompleted }, result.courseCompleted ? "Course completed — well done!" : "Lesson completed");
  });
}

export async function markLessonIncompleteAction(input: { lessonId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const { lessonId } = z.object({ lessonId: uuid }).parse(input);
    await markLessonIncomplete(user, lessonId);
    refresh();
    return ok(null, "Marked as not complete");
  });
}

// ---------------------------------------------------------------------------
// Notes & bookmarks (owner-only rows; RLS also checks the lesson is viewable)
// ---------------------------------------------------------------------------

const noteSchema = z.object({
  lessonId: uuid,
  body: z.string().trim().min(1, "Write something first").max(20_000),
  positionSeconds: z.number().min(0).max(86_400).nullable().optional(),
});

export async function addNoteAction(input: z.input<typeof noteSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await assertUser();
    const data = noteSchema.parse(input);
    const { lesson } = await assertLessonTrackable(user, data.lessonId);
    await enforceRateLimit("note-create", 60, 300, user.id);
    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("student_notes")
      .insert({ user_id: user.id, lesson_id: lesson.id, course_id: lesson.course_id, body: data.body, position_seconds: data.positionSeconds ?? null })
      .select("id")
      .single();
    if (error || !row) throw new UserFacingError("Your note couldn't be saved.");
    refresh();
    return ok({ id: row.id }, "Note saved");
  });
}

export async function updateNoteAction(input: { id: string; body: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    await assertUser();
    const data = z.object({ id: uuid, body: z.string().trim().min(1, "Write something first").max(20_000) }).parse(input);
    const supabase = await createClient();
    const { data: rows, error } = await supabase.from("student_notes").update({ body: data.body }).eq("id", data.id).select("id");
    if (error || !rows?.length) throw new UserFacingError("Note not found.");
    refresh();
    return ok(null, "Note updated");
  });
}

export async function deleteNoteAction(input: { id: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    await assertUser();
    const { id } = z.object({ id: uuid }).parse(input);
    const supabase = await createClient();
    await supabase.from("student_notes").delete().eq("id", id);
    refresh();
    return ok(null, "Note deleted");
  });
}

const bookmarkSchema = z.object({
  lessonId: uuid,
  positionSeconds: z.number().min(0).max(86_400).nullable().optional(),
  label: z.string().trim().max(200).optional(),
});

export async function addBookmarkAction(input: z.input<typeof bookmarkSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await assertUser();
    const data = bookmarkSchema.parse(input);
    const { lesson } = await assertLessonTrackable(user, data.lessonId);
    await enforceRateLimit("bookmark-create", 60, 300, user.id);
    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("bookmarks")
      .insert({
        user_id: user.id,
        lesson_id: lesson.id,
        course_id: lesson.course_id,
        position_seconds: data.positionSeconds ?? null,
        label: data.label || null,
      })
      .select("id")
      .single();
    if (error || !row) throw new UserFacingError("The bookmark couldn't be saved.");
    refresh();
    return ok({ id: row.id }, "Bookmark added");
  });
}

export async function deleteBookmarkAction(input: { id: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    await assertUser();
    const { id } = z.object({ id: uuid }).parse(input);
    const supabase = await createClient();
    await supabase.from("bookmarks").delete().eq("id", id);
    refresh();
    return ok(null, "Bookmark removed");
  });
}

// ---------------------------------------------------------------------------
// Course review (moderated before publication)
// ---------------------------------------------------------------------------

const reviewSchema = z.object({
  courseId: uuid,
  rating: z.number().int().min(1, "Choose a rating").max(5),
  title: z.string().trim().max(160).optional(),
  body: z.string().trim().max(4000).optional(),
});

export async function saveReviewAction(input: z.input<typeof reviewSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const data = reviewSchema.parse(input);
    await enforceRateLimit("review-save", 10, 3600, user.id);
    const admin = createAdminClient();
    const { data: enrollment } = await admin
      .from("enrollments")
      .select("id")
      .eq("user_id", user.id)
      .eq("course_id", data.courseId)
      .maybeSingle();
    if (!enrollment) throw new UserFacingError("Only enrolled learners can review this course.");

    const supabase = await createClient();
    const values = { rating: data.rating, title: data.title || null, body: data.body || null };
    const { data: existing } = await supabase
      .from("course_reviews")
      .select("id")
      .eq("course_id", data.courseId)
      .eq("user_id", user.id)
      .maybeSingle();
    const { error } = existing
      ? await supabase.from("course_reviews").update(values).eq("id", existing.id)
      : await supabase.from("course_reviews").insert({ ...values, course_id: data.courseId, user_id: user.id });
    if (error) throw new UserFacingError("Your review couldn't be saved.");
    refresh();
    return ok(null, "Review submitted for moderation");
  });
}

// ---------------------------------------------------------------------------
// Quizzes
// ---------------------------------------------------------------------------

const answerSchema = z.object({
  questionId: uuid,
  selectedOptionIds: z.array(uuid).max(20).default([]),
  textAnswer: z.string().max(4000).nullable().optional(),
});

export async function startQuizAction(input: { quizId: string; courseId: string }): Promise<ActionResult<{ attemptId: string }>> {
  return runAction(async () => {
    const user = await assertUser();
    const data = z.object({ quizId: uuid, courseId: uuid }).parse(input);
    await enforceRateLimit("quiz-start", 20, 600, user.id);
    const { attemptId, resumed } = await startAttempt(user, data.quizId, data.courseId);
    return ok({ attemptId }, resumed ? "Resuming your attempt" : undefined);
  });
}

export async function saveQuizAnswersAction(input: { attemptId: string; answers: z.input<typeof answerSchema>[] }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const data = z.object({ attemptId: uuid, answers: z.array(answerSchema).max(200) }).parse(input);
    await saveAttemptAnswers(user, data.attemptId, data.answers);
    return ok(null);
  });
}

export async function submitQuizAction(input: { attemptId: string; answers: z.input<typeof answerSchema>[] }): Promise<ActionResult<{ attemptId: string }>> {
  return runAction(async () => {
    const user = await assertUser();
    const data = z.object({ attemptId: uuid, answers: z.array(answerSchema).max(200) }).parse(input);
    await submitAttempt(user, data.attemptId, data.answers);
    refresh();
    return ok({ attemptId: data.attemptId }, "Quiz submitted");
  });
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

const submissionSchema = z.object({
  courseId: uuid,
  assignmentId: uuid,
  textBody: z.string().max(50_000).optional(),
  links: z.array(z.string().trim().max(2000)).max(10).default([]),
  fileIds: z.array(uuid).max(20).default([]),
});

export async function submitAssignmentAction(input: z.input<typeof submissionSchema>): Promise<ActionResult<{ submissionId: string }>> {
  return runAction(async () => {
    const user = await assertUser();
    const data = submissionSchema.parse(input);
    await enforceRateLimit("assignment-submit", 10, 600, user.id);
    const result = await submitAssignment(user, data);
    refresh();
    return ok({ submissionId: result.submissionId }, result.late ? "Submitted (after the deadline)" : "Assignment submitted");
  });
}

// ---------------------------------------------------------------------------
// All-access library
// ---------------------------------------------------------------------------

export async function openLibraryCourseAction(input: { courseId: string }): Promise<ActionResult<{ slug: string }>> {
  return runAction(async () => {
    const user = await assertUser();
    const { courseId } = z.object({ courseId: uuid }).parse(input);
    const { data: course } = await createAdminClient().from("courses").select("id, slug, status").eq("id", courseId).maybeSingle();
    if (!course) throw new UserFacingError("Course not found.");
    const access = await getCourseAccess(user, course);
    if (!access.hasAccess) throw new UserFacingError("Your membership doesn't include this course.");
    const { ensureEnrollment } = await import("@/lib/services/access");
    await ensureEnrollment(user.id, courseId, "membership");
    return ok({ slug: course.slug });
  });
}
