"use server";

import { z } from "zod";
import { ok, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { assertCourseEditor } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import { lessonSettingsSchema, moduleSchema } from "@/lib/validation/course";
import { must, refreshBuilder, revalidateCourse, throwDbError } from "@/lib/services/courses/action-helpers";
import { toReorderPayload, type ModuleOrder } from "@/lib/services/courses/reorder";

export async function saveModule(input: z.input<typeof moduleSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const parsed = moduleSchema.parse(input);
    await assertCourseEditor(parsed.courseId);
    const supabase = await createClient();
    const values = {
      title: parsed.title,
      description: parsed.description,
      is_published: parsed.is_published,
      release_at: parsed.release_at,
      release_after_days: parsed.release_after_days,
    };
    if (parsed.moduleId) {
      const { error } = await supabase.from("course_modules").update(values).eq("id", parsed.moduleId).eq("course_id", parsed.courseId);
      throwDbError(error, "update module");
      revalidateCourse(parsed.courseId);
      return ok({ id: parsed.moduleId }, "Module saved");
    }
    const { data: last } = await supabase
      .from("course_modules")
      .select("sort_order")
      .eq("course_id", parsed.courseId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const created = must<{ id: string }>(
      await supabase
        .from("course_modules")
        .insert({ ...values, course_id: parsed.courseId, sort_order: ((last?.sort_order as number | undefined) ?? -1) + 1 })
        .select("id")
        .single(),
      "create module",
    );
    revalidateCourse(parsed.courseId);
    return ok({ id: created.id }, "Module added");
  });
}

export async function deleteModule(input: { courseId: string; moduleId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const courseId = z.uuid().parse(input.courseId);
    const moduleId = z.uuid().parse(input.moduleId);
    const { user } = await assertCourseEditor(courseId);
    const supabase = await createClient();
    const { data: mod } = await supabase.from("course_modules").select("title").eq("id", moduleId).eq("course_id", courseId).maybeSingle();
    if (!mod) throw new UserFacingError("Module not found.");
    const { error } = await supabase.from("course_modules").delete().eq("id", moduleId).eq("course_id", courseId);
    throwDbError(error, "delete module");
    await audit({ actor: user, action: "course.module_deleted", entityType: "course", entityId: courseId, summary: mod.title as string });
    revalidateCourse(courseId);
    return ok(null, "Module deleted");
  });
}

export async function saveLesson(input: z.input<typeof lessonSettingsSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const parsed = lessonSettingsSchema.parse(input);
    await assertCourseEditor(parsed.courseId);
    const supabase = await createClient();

    const { data: mod } = await supabase.from("course_modules").select("id").eq("id", parsed.moduleId).eq("course_id", parsed.courseId).maybeSingle();
    if (!mod) throw new UserFacingError("Choose a module in this course.");
    if (parsed.prerequisite_lesson_id) {
      const { data: pre } = await supabase
        .from("lessons")
        .select("id")
        .eq("id", parsed.prerequisite_lesson_id)
        .eq("course_id", parsed.courseId)
        .maybeSingle();
      if (!pre) throw new UserFacingError("The prerequisite must be a lesson in this course.");
    }

    const values = {
      module_id: parsed.moduleId,
      title: parsed.title,
      summary: parsed.summary,
      lesson_type: parsed.lesson_type,
      duration_minutes: parsed.duration_minutes,
      is_preview: parsed.is_preview,
      is_published: parsed.is_published,
      release_at: parsed.release_at,
      release_after_days: parsed.release_after_days,
      prerequisite_lesson_id: parsed.prerequisite_lesson_id,
      completion_rule: parsed.completion_rule,
    };

    if (parsed.lessonId) {
      const { error } = await supabase.from("lessons").update(values).eq("id", parsed.lessonId).eq("course_id", parsed.courseId);
      throwDbError(error, "update lesson");
      revalidateCourse(parsed.courseId);
      return ok({ id: parsed.lessonId }, "Lesson saved");
    }

    const { data: last } = await supabase
      .from("lessons")
      .select("sort_order")
      .eq("module_id", parsed.moduleId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const created = must<{ id: string }>(
      await supabase
        .from("lessons")
        .insert({ ...values, course_id: parsed.courseId, sort_order: ((last?.sort_order as number | undefined) ?? -1) + 1 })
        .select("id")
        .single(),
      "create lesson",
    );
    revalidateCourse(parsed.courseId);
    return ok({ id: created.id }, "Lesson added");
  });
}

export async function deleteLesson(input: { courseId: string; lessonId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const courseId = z.uuid().parse(input.courseId);
    const lessonId = z.uuid().parse(input.lessonId);
    const { user } = await assertCourseEditor(courseId);
    const supabase = await createClient();
    const { data: lesson } = await supabase.from("lessons").select("title").eq("id", lessonId).eq("course_id", courseId).maybeSingle();
    if (!lesson) throw new UserFacingError("Lesson not found.");
    const { error } = await supabase.from("lessons").delete().eq("id", lessonId).eq("course_id", courseId);
    throwDbError(error, "delete lesson");
    await audit({ actor: user, action: "course.lesson_deleted", entityType: "course", entityId: courseId, summary: lesson.title as string });
    revalidateCourse(courseId);
    return ok(null, "Lesson deleted");
  });
}

const orderSchema = z
  .array(z.object({ id: z.uuid(), lessonIds: z.array(z.uuid()).max(500) }))
  .max(200);

/** Persist the drag-and-drop order of modules and lessons in one transaction. */
export async function reorderCurriculum(input: { courseId: string; structure: ModuleOrder[] }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const courseId = z.uuid().parse(input.courseId);
    const structure = orderSchema.parse(input.structure);
    await assertCourseEditor(courseId);
    const supabase = await createClient();
    const { error } = await supabase.rpc("reorder_curriculum", { p_course: courseId, p_structure: toReorderPayload(structure) });
    throwDbError(error, "reorder curriculum");
    refreshBuilder(courseId);
    return ok(null, "Order saved");
  });
}

/** Toggle publish/preview flags directly from the curriculum list. */
export async function setLessonFlag(input: {
  courseId: string;
  lessonId: string;
  flag: "is_published" | "is_preview";
  value: boolean;
}): Promise<ActionResult<null>> {
  return runAction(async () => {
    const courseId = z.uuid().parse(input.courseId);
    const lessonId = z.uuid().parse(input.lessonId);
    const flag = z.enum(["is_published", "is_preview"]).parse(input.flag);
    await assertCourseEditor(courseId);
    const supabase = await createClient();
    const { error } = await supabase
      .from("lessons")
      .update(flag === "is_published" ? { is_published: z.boolean().parse(input.value) } : { is_preview: z.boolean().parse(input.value) })
      .eq("id", lessonId)
      .eq("course_id", courseId);
    throwDbError(error, "update lesson flag");
    revalidateCourse(courseId);
    const label = flag === "is_published" ? (input.value ? "Lesson published" : "Lesson hidden") : input.value ? "Free preview on" : "Free preview off";
    return ok(null, label);
  });
}
