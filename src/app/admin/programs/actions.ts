"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/guards";
import { fail, ok, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import { sanitizeRichText } from "@/lib/sanitize";
import { slugify } from "@/lib/format";
import { PUBLIC_TAGS, refreshPublic } from "@/lib/services/admin/revalidate";

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const supabase = await createClient();
  const root = slugify(base) || "program";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    let q = supabase.from("learning_paths").select("id").eq("slug", candidate);
    if (excludeId) q = q.neq("id", excludeId);
    const { data } = await q.maybeSingle();
    if (!data) return candidate;
  }
  throw new UserFacingError("Couldn't find a free URL slug. Choose a different title.");
}

export async function createProgram(input: { title: string }): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    const user = await assertAdmin();
    const { title } = z.object({ title: z.string().trim().min(1, "Enter a title").max(200) }).parse(input);
    const supabase = await createClient();
    const slug = await uniqueSlug(title);
    const { data, error } = await supabase.from("learning_paths").insert({ title, slug, status: "draft" }).select("id").single();
    if (error) throw error;
    await audit({ actor: user, action: "program.created", entityType: "learning_path", entityId: data.id, summary: title });
    return ok({ id: data.id as string });
  });
  if (result.ok) redirect(`/admin/programs/${result.data.id}`);
  return result as ActionResult<null>;
}

const programSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1, "Enter a title").max(200),
  slug: z.string().trim().max(120),
  summary: z.string().trim().max(400).default(""),
  description: z.string().max(40000).default(""),
  image_url: z.string().trim().max(500).default(""),
  level: z.enum(["beginner", "intermediate", "advanced", "all_levels"]),
  status: z.enum(["draft", "published", "archived"]),
  is_featured: z.boolean(),
  sort_order: z.coerce.number().int().min(0).max(10000),
});

export async function saveProgram(input: z.input<typeof programSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = programSchema.parse(input);
    const slug = slugify(data.slug || data.title);
    if (!slug) return fail("Check the highlighted fields.", { slug: ["Enter a slug using letters and numbers"] });
    const supabase = await createClient();
    if (data.status === "published") {
      const { count } = await supabase.from("learning_path_courses").select("course_id", { count: "exact", head: true }).eq("learning_path_id", data.id);
      if ((count ?? 0) === 0) throw new UserFacingError("Add at least one course before publishing this program.");
    }
    const { error } = await supabase
      .from("learning_paths")
      .update({
        title: data.title,
        slug,
        summary: data.summary || null,
        description: data.description ? sanitizeRichText(data.description) : null,
        image_url: data.image_url || null,
        level: data.level,
        status: data.status,
        is_featured: data.is_featured,
        sort_order: data.sort_order,
      })
      .eq("id", data.id);
    if (error) throw error.code === "23505" ? new UserFacingError("Another program already uses this slug.") : error;
    await audit({ actor: user, action: "program.updated", entityType: "learning_path", entityId: data.id, summary: data.title, metadata: { status: data.status } });
    refreshPublic(PUBLIC_TAGS.programs);
    return ok(null, "Program saved");
  });
}

export async function setProgramCourses(input: { id: string; items: { course_id: string; is_required: boolean }[] }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = z
      .object({
        id: z.uuid(),
        items: z.array(z.object({ course_id: z.uuid(), is_required: z.boolean() })).max(100),
      })
      .parse(input);
    const ids = data.items.map((i) => i.course_id);
    if (new Set(ids).size !== ids.length) throw new UserFacingError("A course can only appear once in a program.");
    const supabase = await createClient();
    const { error: delError } = await supabase.from("learning_path_courses").delete().eq("learning_path_id", data.id);
    if (delError) throw delError;
    if (data.items.length) {
      const { error } = await supabase.from("learning_path_courses").insert(
        data.items.map((item, index) => ({
          learning_path_id: data.id,
          course_id: item.course_id,
          is_required: item.is_required,
          sort_order: index + 1,
        })),
      );
      if (error) throw error;
    }
    await audit({ actor: user, action: "program.courses_updated", entityType: "learning_path", entityId: data.id, metadata: { courseIds: ids } });
    refreshPublic(PUBLIC_TAGS.programs, PUBLIC_TAGS.courses);
    return ok(null, "Program courses saved");
  });
}

export async function deleteProgram(input: { id: string }): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    const user = await assertAdmin();
    const { id } = z.object({ id: z.uuid() }).parse(input);
    const supabase = await createClient();
    const { data: row } = await supabase.from("learning_paths").select("title").eq("id", id).maybeSingle();
    const { error } = await supabase.from("learning_paths").delete().eq("id", id);
    if (error) throw error;
    await audit({ actor: user, action: "program.deleted", entityType: "learning_path", entityId: id, summary: row?.title ?? undefined });
    refreshPublic(PUBLIC_TAGS.programs);
    return ok(null, "Program deleted");
  });
  if (result.ok) redirect("/admin/programs");
  return result;
}
