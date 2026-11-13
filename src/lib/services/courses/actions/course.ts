"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, ok, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { assertCourseEditor, assertTeacherOrAdmin } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { sanitizeRichText } from "@/lib/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { courseDetailsSchema, createCourseSchema, slugSchema, type CourseDetailsInput } from "@/lib/validation/course";
import { courseSlugFromTitle, uniqueSlug } from "@/lib/services/courses/slug";
import { must, revalidateCourse, throwDbError } from "@/lib/services/courses/action-helpers";

async function takenSlugs(base: string, excludeCourseId?: string): Promise<string[]> {
  const admin = createAdminClient();
  let query = admin.from("courses").select("slug").like("slug", `${base}%`);
  if (excludeCourseId) query = query.neq("id", excludeCourseId);
  const { data } = await query.limit(500);
  return ((data ?? []) as { slug: string }[]).map((r) => r.slug);
}

/** Create a draft course and open it in the builder. */
export async function createCourse(input: { title: string; categoryId?: string | null; area: "teach" | "admin" }): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    const user = await assertTeacherOrAdmin();
    const isAdmin = user.roles.includes("admin");
    if (input.area === "admin" && !isAdmin) throw new UserFacingError("Administrator access required.");
    if (!isAdmin && !user.canCreateCourses) {
      throw new UserFacingError("Your instructor account can't create courses yet. Ask an administrator to enable course creation.");
    }
    const parsed = createCourseSchema.parse(input);
    const base = courseSlugFromTitle(parsed.title);
    const slug = uniqueSlug(base, await takenSlugs(base));

    const supabase = await createClient();
    const created = must<{ id: string }>(
      await supabase
        .from("courses")
        .insert({
          title: parsed.title,
          slug,
          category_id: parsed.categoryId ?? null,
          status: "draft",
          visibility: "public",
          created_by: user.id,
        })
        .select("id")
        .single(),
      "create course",
    );
    await audit({ actor: user, action: "course.created", entityType: "course", entityId: created.id, summary: parsed.title });
    return ok({ id: created.id }, "Course created");
  });
  if (result.ok) redirect(`${input.area === "admin" ? "/admin/courses" : "/teach/courses"}/${result.data.id}`);
  return result;
}

/** Suggest a free slug for a title (used by the details form). */
export async function suggestCourseSlug(input: { courseId: string; title: string }): Promise<ActionResult<{ slug: string }>> {
  return runAction(async () => {
    await assertCourseEditor(z.uuid().parse(input.courseId));
    const base = courseSlugFromTitle(z.string().trim().min(1).max(200).parse(input.title));
    return ok({ slug: uniqueSlug(base, await takenSlugs(base, input.courseId)) });
  });
}

export async function checkCourseSlug(input: { courseId: string; slug: string }): Promise<ActionResult<{ available: boolean }>> {
  return runAction(async () => {
    await assertCourseEditor(z.uuid().parse(input.courseId));
    const parsed = slugSchema.safeParse(input.slug);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid address");
    const { data } = await createAdminClient().from("courses").select("id").eq("slug", parsed.data).neq("id", input.courseId).maybeSingle();
    return ok({ available: !data });
  });
}

export async function saveCourseDetails(input: CourseDetailsInput): Promise<ActionResult<{ slug: string }>> {
  return runAction(async () => {
    const parsed = courseDetailsSchema.parse(input);
    const { user } = await assertCourseEditor(parsed.courseId);

    const admin = createAdminClient();
    const { data: clash } = await admin.from("courses").select("id").eq("slug", parsed.slug).neq("id", parsed.courseId).maybeSingle();
    if (clash) return fail("Check the highlighted fields.", { slug: ["Another course already uses this address"] });

    if (parsed.promo_video_asset_id) {
      const { data: video } = await admin
        .from("video_assets")
        .select("id")
        .eq("id", parsed.promo_video_asset_id)
        .eq("course_id", parsed.courseId)
        .maybeSingle();
      if (!video) return fail("Check the highlighted fields.", { promo_video_asset_id: ["Choose a video from this course"] });
    }

    const supabase = await createClient();
    const { data: before } = await supabase.from("courses").select("slug, status").eq("id", parsed.courseId).single();
    const { error } = await supabase
      .from("courses")
      .update({
        title: parsed.title,
        slug: parsed.slug,
        short_description: parsed.short_description,
        description: sanitizeRichText(parsed.description),
        thumbnail_url: parsed.thumbnail_url,
        banner_url: parsed.banner_url,
        promo_video: parsed.promo_video_asset_id ? { video_asset_id: parsed.promo_video_asset_id } : null,
        category_id: parsed.category_id,
        level: parsed.level,
        language: parsed.language,
        estimated_duration_minutes: parsed.estimated_duration_minutes,
        learning_outcomes: parsed.learning_outcomes,
        requirements: parsed.requirements,
        target_audience: parsed.target_audience,
        tags: parsed.tags,
        visibility: parsed.visibility,
        is_free: parsed.is_free,
        sequential_progression: parsed.sequential_progression,
        discussions_enabled: parsed.discussions_enabled,
        certificate_enabled: parsed.certificate_enabled,
        certificate_min_progress: parsed.certificate_min_progress,
        certificate_require_quizzes: parsed.certificate_require_quizzes,
        certificate_require_assignments: parsed.certificate_require_assignments,
        seo_title: parsed.seo_title,
        seo_description: parsed.seo_description,
      })
      .eq("id", parsed.courseId);
    throwDbError(error, "save course details");

    if (before && before.slug !== parsed.slug) {
      await audit({
        actor: user,
        action: "course.slug_changed",
        entityType: "course",
        entityId: parsed.courseId,
        metadata: { from: before.slug, to: parsed.slug },
      });
    }
    revalidateCourse(parsed.courseId, parsed.slug);
    if (before?.slug && before.slug !== parsed.slug) revalidateCourse(parsed.courseId, before.slug);
    return ok({ slug: parsed.slug }, "Course saved");
  });
}
