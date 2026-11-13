"use server";

import { z } from "zod";
import { ok, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { assertAdmin, assertCourseEditor } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { appUrl } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/services/notifications";
import { courseReadiness, COURSE_COLUMNS, type BuilderCourse } from "@/lib/services/courses/builder";
import { adminUserIds, courseInstructorIds, revalidateCourse, throwDbError } from "@/lib/services/courses/action-helpers";

const uuid = z.uuid();

async function loadCourse(courseId: string): Promise<BuilderCourse> {
  const supabase = await createClient();
  const { data } = await supabase.from("courses").select(COURSE_COLUMNS).eq("id", courseId).maybeSingle();
  if (!data) throw new UserFacingError("Course not found.");
  return data as BuilderCourse;
}

async function notifyInstructorsOfReview(course: BuilderCourse, result: string, notes: string | null) {
  const ids = await courseInstructorIds(course.id);
  if (!ids.length) return;
  await notify(ids, {
    category: "learning",
    type: "course_review_result",
    title: `${course.title}: ${result}`,
    body: notes ?? undefined,
    url: `/teach/courses/${course.id}/review`,
    email: {
      templateKey: "learning.course_review_result",
      idempotencyKey: `course-review:${course.id}:${result}:${new Date().toISOString().slice(0, 16)}`,
      payload: {
        course_title: course.title,
        review_result: result,
        review_notes: notes ?? "",
        cta_url: appUrl(`/teach/courses/${course.id}/review`),
      },
    },
  });
}

/** Teacher (or admin) sends a draft for publication review. */
export async function submitForReview(input: { courseId: string; note?: string | null }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const courseId = uuid.parse(input.courseId);
    const note = z.string().trim().max(1000).nullish().parse(input.note) || null;
    const { user } = await assertCourseEditor(courseId);
    const course = await loadCourse(courseId);
    if (course.status !== "draft" && course.status !== "unpublished") {
      throw new UserFacingError("Only draft or unpublished courses can be submitted for review.");
    }
    const readiness = await courseReadiness(course);
    if (!readiness.ready) {
      const missing = readiness.items.filter((i) => !i.done).map((i) => i.label.toLowerCase());
      throw new UserFacingError(`Finish these first: ${missing.join(", ")}.`);
    }
    const now = new Date().toISOString();
    const supabase = await createClient();
    const { error } = await supabase
      .from("courses")
      .update({ status: "in_review", submitted_for_review_at: now, submitted_by: user.id })
      .eq("id", courseId);
    throwDbError(error, "submit for review");

    await audit({ actor: user, action: "course.submitted_for_review", entityType: "course", entityId: courseId, summary: course.title, metadata: { note } });
    const admins = (await adminUserIds()).filter((id) => id !== user.id);
    if (admins.length) {
      await notify(admins, {
        category: "system",
        type: "course_submitted",
        title: `${course.title} is waiting for review`,
        body: note ?? undefined,
        url: `/admin/courses/${courseId}/review`,
        email: {
          templateKey: "learning.course_submitted",
          idempotencyKey: `course-submitted:${courseId}:${now}`,
          payload: {
            course_title: course.title,
            instructor_name: user.fullName || user.displayName,
            cta_url: appUrl(`/admin/courses/${courseId}/review`),
          },
        },
      });
    }
    revalidateCourse(courseId, course.slug);
    return ok(null, "Submitted for review");
  });
}

/** Pull a submission back to draft (also clears any approval/schedule). */
export async function withdrawSubmission(input: { courseId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const courseId = uuid.parse(input.courseId);
    const { user } = await assertCourseEditor(courseId);
    const course = await loadCourse(courseId);
    if (course.status !== "in_review") throw new UserFacingError("This course isn't waiting for review.");
    const supabase = await createClient();
    const { error } = await supabase.from("courses").update({ status: "draft", scheduled_publish_at: null }).eq("id", courseId);
    throwDbError(error, "withdraw submission");
    await audit({ actor: user, action: "course.submission_withdrawn", entityType: "course", entityId: courseId, summary: course.title });
    revalidateCourse(courseId, course.slug);
    return ok(null, "Submission withdrawn");
  });
}

const approveSchema = z
  .object({
    courseId: uuid,
    mode: z.enum(["now", "schedule"]),
    publishAt: z.string().datetime({ offset: true }).nullish(),
    notes: z.string().trim().max(2000).nullish(),
  })
  .refine((v) => v.mode === "now" || (v.publishAt && new Date(v.publishAt).getTime() > Date.now() + 60_000), {
    path: ["publishAt"],
    message: "Choose a publication time in the future",
  });

/** Admin approves a course and publishes it now or at a scheduled time. */
export async function approveCourse(input: z.input<typeof approveSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const parsed = approveSchema.parse(input);
    const user = await assertAdmin();
    const course = await loadCourse(parsed.courseId);
    if (course.status === "archived") throw new UserFacingError("Restore the course before publishing it.");
    const now = new Date().toISOString();
    const supabase = await createClient();
    const update =
      parsed.mode === "now"
        ? {
            status: "published",
            published_at: course.published_at ?? now,
            scheduled_publish_at: null,
            reviewed_at: now,
            reviewed_by: user.id,
            review_notes: parsed.notes || null,
          }
        : {
            status: "in_review",
            scheduled_publish_at: parsed.publishAt,
            reviewed_at: now,
            reviewed_by: user.id,
            review_notes: parsed.notes || null,
          };
    const { error } = await supabase.from("courses").update(update).eq("id", parsed.courseId);
    throwDbError(error, "approve course");

    const result =
      parsed.mode === "now" ? "approved and published" : `approved — publishes ${formatDateTime(parsed.publishAt!)} UTC`;
    await audit({
      actor: user,
      action: parsed.mode === "now" ? "course.published" : "course.publication_scheduled",
      entityType: "course",
      entityId: parsed.courseId,
      summary: course.title,
      metadata: { publishAt: parsed.publishAt ?? now, notes: parsed.notes ?? null },
    });
    await notifyInstructorsOfReview(course, result, parsed.notes || null);
    revalidateCourse(parsed.courseId, course.slug);
    return ok(null, parsed.mode === "now" ? "Course published" : "Publication scheduled");
  });
}

export async function requestCourseChanges(input: { courseId: string; notes: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const courseId = uuid.parse(input.courseId);
    const notes = z.string().trim().min(5, "Explain what needs to change").max(2000).parse(input.notes);
    const user = await assertAdmin();
    const course = await loadCourse(courseId);
    const supabase = await createClient();
    const { error } = await supabase
      .from("courses")
      .update({
        status: course.status === "published" ? "published" : "draft",
        scheduled_publish_at: null,
        review_notes: notes,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq("id", courseId);
    throwDbError(error, "request changes");
    await audit({ actor: user, action: "course.changes_requested", entityType: "course", entityId: courseId, summary: course.title, metadata: { notes } });
    await notifyInstructorsOfReview(course, "returned with requested changes", notes);
    revalidateCourse(courseId, course.slug);
    return ok(null, "Changes requested");
  });
}

const STATUS_ACTIONS = {
  unpublish: { status: "unpublished", from: ["published", "in_review"], message: "Course unpublished", audit: "course.unpublished" },
  archive: { status: "archived", from: ["draft", "in_review", "published", "unpublished"], message: "Course archived", audit: "course.archived" },
  restore: { status: "draft", from: ["archived"], message: "Course restored as a draft", audit: "course.restored" },
} as const;

export async function changeCourseStatus(input: {
  courseId: string;
  action: keyof typeof STATUS_ACTIONS;
  reason?: string;
}): Promise<ActionResult<null>> {
  return runAction(async () => {
    const courseId = uuid.parse(input.courseId);
    const action = z.enum(["unpublish", "archive", "restore"]).parse(input.action);
    const user = await assertAdmin();
    const course = await loadCourse(courseId);
    const rule = STATUS_ACTIONS[action];
    if (!(rule.from as readonly string[]).includes(course.status)) {
      throw new UserFacingError(`A ${course.status.replace("_", " ")} course can't be changed this way.`);
    }
    const supabase = await createClient();
    const { error } = await supabase.from("courses").update({ status: rule.status, scheduled_publish_at: null }).eq("id", courseId);
    throwDbError(error, `course ${action}`);
    await audit({ actor: user, action: rule.audit, entityType: "course", entityId: courseId, summary: course.title, metadata: { reason: input.reason ?? null } });
    revalidateCourse(courseId, course.slug);
    return ok(null, rule.message);
  });
}

export async function bulkChangeCourseStatus(input: { courseIds: string[]; action: "unpublish" | "archive" }): Promise<ActionResult<{ changed: number; skipped: number }>> {
  return runAction(async () => {
    const ids = z.array(uuid).min(1, "Select at least one course").max(100).parse(input.courseIds);
    const action = z.enum(["unpublish", "archive"]).parse(input.action);
    const user = await assertAdmin();
    const rule = STATUS_ACTIONS[action];
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("courses")
      .update({ status: rule.status, scheduled_publish_at: null })
      .in("id", ids)
      .in("status", rule.from as unknown as string[])
      .select("id, slug");
    throwDbError(error, "bulk status");
    const changed = (data ?? []) as { id: string; slug: string }[];
    await audit({ actor: user, action: `${rule.audit}_bulk`, entityType: "course", summary: `${changed.length} courses`, metadata: { ids: changed.map((c) => c.id) } });
    for (const c of changed) revalidateCourse(c.id, c.slug);
    return ok({ changed: changed.length, skipped: ids.length - changed.length }, `${changed.length} course${changed.length === 1 ? "" : "s"} updated`);
  });
}

export async function setCourseFeatured(input: { courseId: string; featured: boolean }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const courseId = uuid.parse(input.courseId);
    const featured = z.boolean().parse(input.featured);
    const user = await assertAdmin();
    const course = await loadCourse(courseId);
    const supabase = await createClient();
    const { error } = await supabase.from("courses").update({ is_featured: featured }).eq("id", courseId);
    throwDbError(error, "feature course");
    await audit({ actor: user, action: featured ? "course.featured" : "course.unfeatured", entityType: "course", entityId: courseId, summary: course.title });
    revalidateCourse(courseId, course.slug);
    return ok(null, featured ? "Course featured on the home page" : "Course removed from featured");
  });
}
