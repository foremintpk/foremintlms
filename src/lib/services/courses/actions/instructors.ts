"use server";

import { z } from "zod";
import { ok, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { assertAdmin } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/services/notifications";
import { refreshBuilder, throwDbError } from "@/lib/services/courses/action-helpers";

const uuid = z.uuid();
const schema = z.object({
  courseId: uuid,
  userId: uuid,
  role: z.enum(["lead", "assistant"]),
  canEdit: z.boolean(),
});

export async function assignInstructor(input: z.input<typeof schema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const parsed = schema.parse(input);
    const actor = await assertAdmin();
    const admin = createAdminClient();
    const [{ data: teacher }, { data: course }] = await Promise.all([
      admin.from("teacher_profiles").select("user_id, public_name, status").eq("user_id", parsed.userId).maybeSingle(),
      admin.from("courses").select("id, title").eq("id", parsed.courseId).maybeSingle(),
    ]);
    if (!teacher || teacher.status !== "approved") throw new UserFacingError("Only approved instructors can be assigned.");
    if (!course) throw new UserFacingError("Course not found.");

    const supabase = await createClient();
    const { data: last } = await supabase
      .from("course_instructors")
      .select("sort_order")
      .eq("course_id", parsed.courseId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabase.from("course_instructors").upsert(
      {
        course_id: parsed.courseId,
        user_id: parsed.userId,
        role: parsed.role,
        can_edit: parsed.canEdit,
        sort_order: ((last?.sort_order as number | undefined) ?? -1) + 1,
      },
      { onConflict: "course_id,user_id" },
    );
    throwDbError(error, "assign instructor");
    await audit({
      actor,
      action: "course.instructor_assigned",
      entityType: "course",
      entityId: parsed.courseId,
      summary: `${teacher.public_name} → ${course.title}`,
      metadata: { userId: parsed.userId, role: parsed.role, canEdit: parsed.canEdit },
    });
    await notify(parsed.userId, {
      category: "system",
      type: "course_assigned",
      title: `You were added to ${course.title}`,
      body: parsed.canEdit ? "You can edit its content." : "You can view it and support its students.",
      url: `/teach/courses/${parsed.courseId}`,
    });
    refreshBuilder(parsed.courseId);
    return ok(null, "Instructor assigned");
  });
}

export async function updateInstructor(input: z.input<typeof schema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const parsed = schema.parse(input);
    const actor = await assertAdmin();
    const supabase = await createClient();
    const { error } = await supabase
      .from("course_instructors")
      .update({ role: parsed.role, can_edit: parsed.canEdit })
      .eq("course_id", parsed.courseId)
      .eq("user_id", parsed.userId);
    throwDbError(error, "update instructor");
    await audit({
      actor,
      action: "course.instructor_updated",
      entityType: "course",
      entityId: parsed.courseId,
      metadata: { userId: parsed.userId, role: parsed.role, canEdit: parsed.canEdit },
    });
    refreshBuilder(parsed.courseId);
    return ok(null, "Instructor updated");
  });
}

export async function removeInstructor(input: { courseId: string; userId: string; reason?: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const courseId = uuid.parse(input.courseId);
    const userId = uuid.parse(input.userId);
    const actor = await assertAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from("course_instructors").delete().eq("course_id", courseId).eq("user_id", userId);
    throwDbError(error, "remove instructor");
    await audit({ actor, action: "course.instructor_removed", entityType: "course", entityId: courseId, metadata: { userId, reason: input.reason ?? null } });
    refreshBuilder(courseId);
    return ok(null, "Instructor removed");
  });
}
