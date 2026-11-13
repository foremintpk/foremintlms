"use server";

import { z } from "zod";
import { ok, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { assertCourseEditor } from "@/lib/auth/guards";
import { sanitizeRichText } from "@/lib/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { assignmentSchema, type AssignmentInput } from "@/lib/validation/course";
import { must, refreshBuilder, throwDbError } from "@/lib/services/courses/action-helpers";
import type { Json } from "@/types/database";

const uuid = z.uuid();

export async function createAssignment(input: { courseId: string; title: string; lessonId?: string | null }): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const courseId = uuid.parse(input.courseId);
    const title = z.string().trim().min(1, "Name the assignment").max(200).parse(input.title);
    const { user } = await assertCourseEditor(courseId);
    const supabase = await createClient();
    const created = must<{ id: string }>(
      await supabase
        .from("assignments")
        .insert({ course_id: courseId, title, lesson_id: input.lessonId ?? null, created_by: user.id, status: "draft" })
        .select("id")
        .single(),
      "create assignment",
    );
    refreshBuilder(courseId);
    return ok({ id: created.id }, "Assignment created");
  });
}

export async function saveAssignment(input: AssignmentInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    const parsed = assignmentSchema.parse(input);
    await assertCourseEditor(parsed.courseId);
    const supabase = await createClient();

    if (parsed.lesson_id) {
      const { data: lesson } = await supabase.from("lessons").select("id").eq("id", parsed.lesson_id).eq("course_id", parsed.courseId).maybeSingle();
      if (!lesson) throw new UserFacingError("Choose a lesson from this course.");
    }
    if (parsed.supporting_media_ids.length) {
      const { data: files } = await createAdminClient()
        .from("media_files")
        .select("id")
        .in("id", parsed.supporting_media_ids)
        .eq("course_id", parsed.courseId)
        .eq("purpose", "course_content")
        .eq("status", "ready");
      if ((files ?? []).length !== new Set(parsed.supporting_media_ids).size) {
        throw new UserFacingError("One of the supporting files is no longer available. Upload it again.");
      }
    }
    if (parsed.status === "published" && parsed.instructions.replace(/<[^>]*>/g, "").trim().length < 10) {
      throw new UserFacingError("Write the instructions before publishing the assignment.");
    }

    const { error } = await supabase
      .from("assignments")
      .update({
        title: parsed.title,
        instructions: sanitizeRichText(parsed.instructions),
        lesson_id: parsed.lesson_id,
        max_points: parsed.max_points,
        passing_points: parsed.passing_points,
        due_at: parsed.due_mode === "fixed" ? parsed.due_at : null,
        due_days_after_enrollment: parsed.due_mode === "relative" ? parsed.due_days_after_enrollment : null,
        allow_late_submissions: parsed.allow_late_submissions,
        late_penalty_percent: parsed.allow_late_submissions ? parsed.late_penalty_percent : 0,
        submission_types: parsed.submission_types,
        allowed_file_types: parsed.submission_types.includes("file") ? parsed.allowed_file_types : [],
        max_file_size_mb: parsed.max_file_size_mb,
        max_files: parsed.submission_types.includes("file") ? parsed.max_files : 0,
        rubric: parsed.rubric as unknown as Json,
        grading_criteria: parsed.grading_criteria,
        counts_toward_completion: parsed.counts_toward_completion,
        status: parsed.status,
        supporting_media_ids: parsed.supporting_media_ids,
        // A changed deadline should trigger a fresh reminder.
        deadline_reminder_sent_at: null,
      })
      .eq("id", parsed.assignmentId)
      .eq("course_id", parsed.courseId);
    throwDbError(error, "save assignment");
    refreshBuilder(parsed.courseId);
    return ok(null, parsed.status === "published" ? "Assignment published" : "Assignment saved");
  });
}

/** Archive when submissions exist so students keep their grades and feedback. */
export async function deleteAssignment(input: { courseId: string; assignmentId: string }): Promise<ActionResult<{ archived: boolean }>> {
  return runAction<{ archived: boolean }>(async () => {
    const courseId = uuid.parse(input.courseId);
    const assignmentId = uuid.parse(input.assignmentId);
    await assertCourseEditor(courseId);
    const supabase = await createClient();
    const { count } = await supabase.from("assignment_submissions").select("id", { count: "exact", head: true }).eq("assignment_id", assignmentId);
    if ((count ?? 0) > 0) {
      const { error } = await supabase.from("assignments").update({ status: "archived" }).eq("id", assignmentId).eq("course_id", courseId);
      throwDbError(error, "archive assignment");
      refreshBuilder(courseId);
      return ok({ archived: true }, "Assignment archived — submissions are kept");
    }
    const { error } = await supabase.from("assignments").delete().eq("id", assignmentId).eq("course_id", courseId);
    throwDbError(error, "delete assignment");
    refreshBuilder(courseId);
    return ok({ archived: false }, "Assignment deleted");
  });
}
