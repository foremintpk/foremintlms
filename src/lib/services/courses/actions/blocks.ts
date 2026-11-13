"use server";

import { z } from "zod";
import { ok, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { assertCourseEditor } from "@/lib/auth/guards";
import { sanitizeRichText } from "@/lib/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { deleteMediaFile, fileExtension } from "@/lib/services/storage";
import {
  BLOCK_TYPES,
  blockDataSchemas,
  defaultBlockData,
  FILE_BLOCK_EXTENSIONS,
  isFileBlockType,
  type BlockType,
} from "@/lib/validation/course-blocks";
import { must, refreshBuilder, throwDbError } from "@/lib/services/courses/action-helpers";
import type { Json, TablesUpdate } from "@/types/database";

const uuid = z.uuid();

async function assertLessonInCourse(courseId: string, lessonId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("lessons").select("id").eq("id", lessonId).eq("course_id", courseId).maybeSingle();
  if (!data) throw new UserFacingError("Lesson not found in this course.");
}

/** Media files must be ready course-content uploads for this course. */
async function assertCourseFile(courseId: string, mediaFileId: string, allowedExt?: string[]) {
  const { data } = await createAdminClient()
    .from("media_files")
    .select("id, course_id, purpose, status, file_name")
    .eq("id", mediaFileId)
    .maybeSingle();
  if (!data || data.course_id !== courseId || data.purpose !== "course_content" || data.status !== "ready") {
    throw new UserFacingError("Upload the file again — it isn't available for this course.");
  }
  if (allowedExt && !allowedExt.includes(fileExtension(data.file_name as string))) {
    throw new UserFacingError(`This block accepts ${allowedExt.map((e) => `.${e}`).join(", ")} files.`);
  }
}

/** Delete a media file only when no other block or resource still uses it. */
async function cleanupMediaFile(mediaFileId: string | null | undefined) {
  if (!mediaFileId) return;
  const admin = createAdminClient();
  const [blocks, resources] = await Promise.all([
    admin.from("lesson_content_blocks").select("id", { count: "exact", head: true }).eq("media_file_id", mediaFileId),
    admin.from("lesson_resources").select("id", { count: "exact", head: true }).eq("media_file_id", mediaFileId),
  ]);
  if ((blocks.count ?? 0) === 0 && (resources.count ?? 0) === 0) await deleteMediaFile(mediaFileId);
}

export async function addBlock(input: { courseId: string; lessonId: string; type: BlockType }): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const courseId = uuid.parse(input.courseId);
    const lessonId = uuid.parse(input.lessonId);
    const type = z.enum(BLOCK_TYPES).parse(input.type);
    await assertCourseEditor(courseId);
    await assertLessonInCourse(courseId, lessonId);
    const supabase = await createClient();
    const { data: last } = await supabase
      .from("lesson_content_blocks")
      .select("sort_order")
      .eq("lesson_id", lessonId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const created = must<{ id: string }>(
      await supabase
        .from("lesson_content_blocks")
        .insert({
          lesson_id: lessonId,
          course_id: courseId,
          block_type: type,
          data: defaultBlockData(type) as Json,
          sort_order: ((last?.sort_order as number | undefined) ?? -1) + 1,
        })
        .select("id")
        .single(),
      "add block",
    );
    refreshBuilder(courseId);
    return ok({ id: created.id }, "Block added");
  });
}

const saveBlockSchema = z.object({
  courseId: uuid,
  blockId: uuid,
  title: z
    .string()
    .trim()
    .max(200)
    .nullish()
    .transform((v) => v || null),
  data: z.record(z.string(), z.unknown()).default({}),
  video_asset_id: uuid.nullish().transform((v) => v ?? null),
  media_file_id: uuid.nullish().transform((v) => v ?? null),
  quiz_id: uuid.nullish().transform((v) => v ?? null),
  assignment_id: uuid.nullish().transform((v) => v ?? null),
  live_session_id: uuid.nullish().transform((v) => v ?? null),
});

export async function saveBlock(input: z.input<typeof saveBlockSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const parsed = saveBlockSchema.parse(input);
    await assertCourseEditor(parsed.courseId);
    const supabase = await createClient();
    const admin = createAdminClient();
    const { data: block } = await supabase
      .from("lesson_content_blocks")
      .select("id, block_type, media_file_id")
      .eq("id", parsed.blockId)
      .eq("course_id", parsed.courseId)
      .maybeSingle();
    if (!block) throw new UserFacingError("Block not found.");
    const type = block.block_type as BlockType;

    const dataResult = blockDataSchemas[type].safeParse(parsed.data);
    if (!dataResult.success) {
      throw new UserFacingError(dataResult.error.issues[0]?.message ?? "Check this block's settings.");
    }
    const data = { ...(dataResult.data as Record<string, unknown>) };
    if (type === "rich_text") data.html = sanitizeRichText(String(data.html ?? ""));

    const update: Omit<TablesUpdate<"lesson_content_blocks">, "data"> & { data: Record<string, unknown> } = {
      title: parsed.title,
      data,
      video_asset_id: null,
      media_file_id: null,
      quiz_id: null,
      assignment_id: null,
      live_session_id: null,
    };

    const courseVideo = async (id: string) => {
      const { data: v } = await admin.from("video_assets").select("id").eq("id", id).eq("course_id", parsed.courseId).maybeSingle();
      if (!v) throw new UserFacingError("Choose a video from this course.");
    };

    if (type === "video" && parsed.video_asset_id) {
      await courseVideo(parsed.video_asset_id);
      update.video_asset_id = parsed.video_asset_id;
    }
    if (type === "video_playlist") {
      const ids = (data.video_asset_ids as string[]) ?? [];
      if (ids.length) {
        const { data: found } = await admin.from("video_assets").select("id").in("id", ids).eq("course_id", parsed.courseId);
        if ((found ?? []).length !== new Set(ids).size) throw new UserFacingError("Every playlist video must belong to this course.");
      }
    }
    if (isFileBlockType(type) && parsed.media_file_id) {
      await assertCourseFile(parsed.courseId, parsed.media_file_id, FILE_BLOCK_EXTENSIONS[type]);
      update.media_file_id = parsed.media_file_id;
    }
    if (type === "quiz" && parsed.quiz_id) {
      const { data: q } = await supabase.from("quizzes").select("id").eq("id", parsed.quiz_id).eq("course_id", parsed.courseId).maybeSingle();
      if (!q) throw new UserFacingError("Choose a quiz from this course.");
      update.quiz_id = parsed.quiz_id;
    }
    if (type === "assignment" && parsed.assignment_id) {
      const { data: a } = await supabase.from("assignments").select("id").eq("id", parsed.assignment_id).eq("course_id", parsed.courseId).maybeSingle();
      if (!a) throw new UserFacingError("Choose an assignment from this course.");
      update.assignment_id = parsed.assignment_id;
    }
    if (type === "live_session" && parsed.live_session_id) {
      const { data: s } = await supabase.from("live_sessions").select("id").eq("id", parsed.live_session_id).eq("course_id", parsed.courseId).maybeSingle();
      if (!s) throw new UserFacingError("Choose a live session from this course.");
      update.live_session_id = parsed.live_session_id;
    }
    if (type === "recording") {
      if (data.source === "video_asset" && data.video_asset_id) {
        await courseVideo(String(data.video_asset_id));
        update.video_asset_id = String(data.video_asset_id);
        delete data.meeting_recording_id;
      } else if (data.source === "meeting_recording" && data.meeting_recording_id) {
        const { data: rec } = await admin
          .from("meeting_recordings")
          .select("id, live_sessions!inner(course_id)")
          .eq("id", String(data.meeting_recording_id))
          .eq("live_sessions.course_id", parsed.courseId)
          .maybeSingle();
        if (!rec) throw new UserFacingError("Choose a recording from this course's live sessions.");
        delete data.video_asset_id;
      }
    }

    const { error } = await supabase
      .from("lesson_content_blocks")
      .update({ ...update, data: update.data as Json })
      .eq("id", parsed.blockId)
      .eq("course_id", parsed.courseId);
    throwDbError(error, "save block");
    if (block.media_file_id && block.media_file_id !== update.media_file_id) await cleanupMediaFile(block.media_file_id as string);
    refreshBuilder(parsed.courseId);
    return ok(null, "Block saved");
  });
}

export async function deleteBlock(input: { courseId: string; blockId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const courseId = uuid.parse(input.courseId);
    const blockId = uuid.parse(input.blockId);
    await assertCourseEditor(courseId);
    const supabase = await createClient();
    const { data: block } = await supabase
      .from("lesson_content_blocks")
      .select("media_file_id")
      .eq("id", blockId)
      .eq("course_id", courseId)
      .maybeSingle();
    if (!block) throw new UserFacingError("Block not found.");
    const { error } = await supabase.from("lesson_content_blocks").delete().eq("id", blockId).eq("course_id", courseId);
    throwDbError(error, "delete block");
    await cleanupMediaFile(block.media_file_id as string | null);
    refreshBuilder(courseId);
    return ok(null, "Block removed");
  });
}

export async function reorderBlocks(input: { courseId: string; lessonId: string; blockIds: string[] }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const courseId = uuid.parse(input.courseId);
    const lessonId = uuid.parse(input.lessonId);
    const ids = z.array(uuid).max(200).parse(input.blockIds);
    await assertCourseEditor(courseId);
    const supabase = await createClient();
    const { error } = await supabase.rpc("reorder_lesson_blocks", { p_lesson: lessonId, p_block_ids: ids });
    throwDbError(error, "reorder blocks");
    refreshBuilder(courseId);
    return ok(null);
  });
}

const resourceSchema = z
  .object({
    courseId: uuid,
    lessonId: uuid,
    resourceId: uuid.optional(),
    title: z.string().trim().min(1, "Name the resource").max(200),
    description: z
      .string()
      .trim()
      .max(1000)
      .nullish()
      .transform((v) => v || null),
    resource_type: z.enum(["file", "link"]),
    media_file_id: uuid.nullish().transform((v) => v ?? null),
    url: z
      .string()
      .trim()
      .url("Enter a full link starting with https://")
      .refine((u) => /^https:\/\//i.test(u), "Links must use https://")
      .nullish()
      .transform((v) => v ?? null),
    is_downloadable: z.boolean().default(true),
  })
  .refine((r) => (r.resource_type === "file" ? Boolean(r.media_file_id) : Boolean(r.url)), {
    path: ["resource_type"],
    message: "Upload a file or enter a link",
  });

export async function saveResource(input: z.input<typeof resourceSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const parsed = resourceSchema.parse(input);
    const { user } = await assertCourseEditor(parsed.courseId);
    await assertLessonInCourse(parsed.courseId, parsed.lessonId);
    if (parsed.resource_type === "file") await assertCourseFile(parsed.courseId, parsed.media_file_id!);
    const supabase = await createClient();
    const values = {
      title: parsed.title,
      description: parsed.description,
      resource_type: parsed.resource_type,
      media_file_id: parsed.resource_type === "file" ? parsed.media_file_id : null,
      url: parsed.resource_type === "link" ? parsed.url : null,
      is_downloadable: parsed.is_downloadable,
    };
    if (parsed.resourceId) {
      const { data: before } = await supabase
        .from("lesson_resources")
        .select("media_file_id")
        .eq("id", parsed.resourceId)
        .eq("lesson_id", parsed.lessonId)
        .maybeSingle();
      if (!before) throw new UserFacingError("Resource not found.");
      const { error } = await supabase.from("lesson_resources").update(values).eq("id", parsed.resourceId);
      throwDbError(error, "update resource");
      if (before.media_file_id && before.media_file_id !== values.media_file_id) await cleanupMediaFile(before.media_file_id as string);
      refreshBuilder(parsed.courseId);
      return ok({ id: parsed.resourceId }, "Resource saved");
    }
    const { data: last } = await supabase
      .from("lesson_resources")
      .select("sort_order")
      .eq("lesson_id", parsed.lessonId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const created = must<{ id: string }>(
      await supabase
        .from("lesson_resources")
        .insert({
          ...values,
          course_id: parsed.courseId,
          lesson_id: parsed.lessonId,
          created_by: user.id,
          sort_order: ((last?.sort_order as number | undefined) ?? -1) + 1,
        })
        .select("id")
        .single(),
      "create resource",
    );
    refreshBuilder(parsed.courseId);
    return ok({ id: created.id }, "Resource added");
  });
}

export async function deleteResource(input: { courseId: string; resourceId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const courseId = uuid.parse(input.courseId);
    const resourceId = uuid.parse(input.resourceId);
    await assertCourseEditor(courseId);
    const supabase = await createClient();
    const { data: resource } = await supabase
      .from("lesson_resources")
      .select("media_file_id")
      .eq("id", resourceId)
      .eq("course_id", courseId)
      .maybeSingle();
    if (!resource) throw new UserFacingError("Resource not found.");
    const { error } = await supabase.from("lesson_resources").delete().eq("id", resourceId).eq("course_id", courseId);
    throwDbError(error, "delete resource");
    await cleanupMediaFile(resource.media_file_id as string | null);
    refreshBuilder(courseId);
    return ok(null, "Resource removed");
  });
}

export async function reorderResources(input: { courseId: string; lessonId: string; resourceIds: string[] }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const courseId = uuid.parse(input.courseId);
    const lessonId = uuid.parse(input.lessonId);
    const ids = z.array(uuid).max(200).parse(input.resourceIds);
    await assertCourseEditor(courseId);
    const supabase = await createClient();
    const { error } = await supabase.rpc("reorder_lesson_resources", { p_lesson: lessonId, p_resource_ids: ids });
    throwDbError(error, "reorder resources");
    refreshBuilder(courseId);
    return ok(null);
  });
}
