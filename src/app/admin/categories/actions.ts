"use server";

import { z } from "zod";
import { assertAdmin } from "@/lib/auth/guards";
import { fail, ok, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import { sanitizeRichText } from "@/lib/sanitize";
import { slugify } from "@/lib/format";
import { PUBLIC_TAGS, refreshPublic } from "@/lib/services/admin/revalidate";

const categorySchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Enter a name").max(120),
  slug: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => v ?? ""),
  short_description: z.string().trim().max(280).optional().default(""),
  description: z.string().max(20000).optional().default(""),
  image_url: z.string().trim().max(500).optional().default(""),
  icon: z.string().trim().max(40).regex(/^[a-z0-9-]*$/, "Use a Lucide icon name like shopping-bag").optional().default(""),
  accent_color: z.union([z.literal(""), z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #5B3DF5")]).default(""),
  status: z.enum(["draft", "published", "archived"]),
  seo_title: z.string().trim().max(70).optional().default(""),
  seo_description: z.string().trim().max(170).optional().default(""),
});

export async function saveCategory(input: z.input<typeof categorySchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = categorySchema.parse(input);
    const slug = slugify(data.slug || data.name);
    if (!slug) return fail("Check the highlighted fields.", { slug: ["Enter a slug using letters and numbers"] });
    const supabase = await createClient();
    const row = {
      name: data.name,
      slug,
      short_description: data.short_description || null,
      description: data.description ? sanitizeRichText(data.description) : null,
      image_url: data.image_url || null,
      icon: data.icon || null,
      accent_color: data.accent_color || null,
      status: data.status,
      seo_title: data.seo_title || null,
      seo_description: data.seo_description || null,
    };
    let id = data.id;
    if (id) {
      const { error } = await supabase.from("course_categories").update(row).eq("id", id);
      if (error) throw error.code === "23505" ? new UserFacingError("Another category already uses this slug.") : error;
    } else {
      const { data: max } = await supabase.from("course_categories").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
      const { data: created, error } = await supabase
        .from("course_categories")
        .insert({ ...row, sort_order: (max?.sort_order ?? 0) + 1 })
        .select("id")
        .single();
      if (error) throw error.code === "23505" ? new UserFacingError("Another category already uses this slug.") : error;
      id = created.id as string;
    }
    await audit({ actor: user, action: data.id ? "category.updated" : "category.created", entityType: "course_category", entityId: id, summary: data.name });
    refreshPublic(PUBLIC_TAGS.categories, PUBLIC_TAGS.courses);
    return ok({ id: id! }, data.id ? "Category saved" : "Category created");
  });
}

export async function reorderCategories(input: { ids: string[] }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const { ids } = z.object({ ids: z.array(z.uuid()).min(1).max(500) }).parse(input);
    const supabase = await createClient();
    const results = await Promise.all(ids.map((id, index) => supabase.from("course_categories").update({ sort_order: index + 1 }).eq("id", id)));
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
    await audit({ actor: user, action: "category.reordered", entityType: "course_category", summary: `${ids.length} categories reordered` });
    refreshPublic(PUBLIC_TAGS.categories);
    return ok(null, "Order saved");
  });
}

export async function setCategoryStatus(input: { id: string; status: "draft" | "published" | "archived" }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = z.object({ id: z.uuid(), status: z.enum(["draft", "published", "archived"]) }).parse(input);
    const supabase = await createClient();
    const { error } = await supabase.from("course_categories").update({ status: data.status }).eq("id", data.id);
    if (error) throw error;
    await audit({ actor: user, action: `category.${data.status}`, entityType: "course_category", entityId: data.id });
    refreshPublic(PUBLIC_TAGS.categories, PUBLIC_TAGS.courses);
    return ok(null, data.status === "published" ? "Category published" : data.status === "archived" ? "Category archived" : "Category moved to drafts");
  });
}

export async function deleteCategory(input: { id: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const { id } = z.object({ id: z.uuid() }).parse(input);
    const supabase = await createClient();
    const { count } = await supabase.from("courses").select("id", { count: "exact", head: true }).eq("category_id", id);
    if ((count ?? 0) > 0) throw new UserFacingError("This category still has courses. Move them or archive the category instead.");
    const { data: cat } = await supabase.from("course_categories").select("name").eq("id", id).maybeSingle();
    const { error } = await supabase.from("course_categories").delete().eq("id", id);
    if (error) throw error;
    await audit({ actor: user, action: "category.deleted", entityType: "course_category", entityId: id, summary: cat?.name ?? undefined });
    refreshPublic(PUBLIC_TAGS.categories);
    return ok(null, "Category deleted");
  });
}

/** Set exactly which courses belong to a category. */
export async function assignCategoryCourses(input: { categoryId: string; courseIds: string[] }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = z.object({ categoryId: z.uuid(), courseIds: z.array(z.uuid()).max(1000) }).parse(input);
    const supabase = await createClient();
    const { data: current } = await supabase.from("courses").select("id").eq("category_id", data.categoryId);
    const currentIds = new Set(((current ?? []) as { id: string }[]).map((c) => c.id));
    const wanted = new Set(data.courseIds);
    const remove = [...currentIds].filter((id) => !wanted.has(id));
    const add = [...wanted].filter((id) => !currentIds.has(id));
    if (remove.length) {
      const { error } = await supabase.from("courses").update({ category_id: null }).in("id", remove);
      if (error) throw error;
    }
    if (add.length) {
      const { error } = await supabase.from("courses").update({ category_id: data.categoryId }).in("id", add);
      if (error) throw error;
    }
    await audit({
      actor: user,
      action: "category.courses_assigned",
      entityType: "course_category",
      entityId: data.categoryId,
      metadata: { added: add, removed: remove },
    });
    refreshPublic(PUBLIC_TAGS.categories, PUBLIC_TAGS.courses);
    return ok(null, "Courses updated");
  });
}
