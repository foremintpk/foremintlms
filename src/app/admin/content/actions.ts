"use server";

import { z } from "zod";
import { assertAdmin } from "@/lib/auth/guards";
import { fail, ok, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import { PAGE_SECTIONS, sectionSchemas, type SectionKey } from "@/lib/cms/sections";
import { PUBLIC_TAGS, refreshPublic } from "@/lib/services/admin/revalidate";

async function pageSlug(pageId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.from("cms_pages").select("slug").eq("id", pageId).maybeSingle();
  if (!data) throw new UserFacingError("This page no longer exists.");
  return data.slug as string;
}

const seoSchema = z.object({
  pageId: z.uuid(),
  title: z.string().trim().min(1).max(120),
  seo_title: z.string().trim().max(70).default(""),
  seo_description: z.string().trim().max(170).default(""),
  og_image_url: z.string().trim().max(500).default(""),
});

export async function savePageSeo(input: z.input<typeof seoSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = seoSchema.parse(input);
    const supabase = await createClient();
    const { error } = await supabase
      .from("cms_pages")
      .update({
        title: data.title,
        seo_title: data.seo_title || null,
        seo_description: data.seo_description || null,
        og_image_url: data.og_image_url || null,
        updated_by: user.id,
      })
      .eq("id", data.pageId);
    if (error) throw error;
    const slug = await pageSlug(data.pageId);
    await audit({ actor: user, action: "cms.page_seo_updated", entityType: "cms_page", entityId: data.pageId, summary: slug });
    refreshPublic(PUBLIC_TAGS.cms, `cms:${slug}`);
    return ok(null, "Page details saved");
  });
}

export async function saveSection(input: { pageId: string; sectionKey: string; content: unknown }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const base = z.object({ pageId: z.uuid(), sectionKey: z.string() }).parse(input);
    const slug = await pageSlug(base.pageId);
    const allowed = PAGE_SECTIONS[slug] ?? [];
    if (!allowed.includes(base.sectionKey as SectionKey)) throw new UserFacingError("This section doesn't belong to this page.");
    const key = base.sectionKey as SectionKey;
    const parsed = sectionSchemas[key].safeParse(input.content);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".") || "_";
        (fieldErrors[path] ??= []).push(issue.message);
      }
      return fail("Some fields need attention.", fieldErrors);
    }
    const supabase = await createClient();
    const { data: existing } = await supabase.from("cms_sections").select("id").eq("page_id", base.pageId).eq("section_key", key).maybeSingle();
    if (existing) {
      const { error } = await supabase.from("cms_sections").update({ content: parsed.data, updated_by: user.id }).eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("cms_sections").insert({
        page_id: base.pageId,
        section_key: key,
        content: parsed.data,
        sort_order: allowed.indexOf(key) + 1,
        is_visible: true,
        updated_by: user.id,
      });
      if (error) throw error;
    }
    await audit({ actor: user, action: "cms.section_updated", entityType: "cms_section", entityId: existing?.id ?? null, summary: `${slug} / ${key}` });
    refreshPublic(PUBLIC_TAGS.cms, `cms:${slug}`);
    return ok(null, "Section saved");
  });
}

export async function setSectionVisibility(input: { sectionId: string; visible: boolean }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = z.object({ sectionId: z.uuid(), visible: z.boolean() }).parse(input);
    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("cms_sections")
      .update({ is_visible: data.visible, updated_by: user.id })
      .eq("id", data.sectionId)
      .select("section_key, cms_pages(slug)")
      .single();
    if (error) throw error;
    const slug = (row.cms_pages as unknown as { slug: string } | null)?.slug ?? "";
    await audit({ actor: user, action: data.visible ? "cms.section_shown" : "cms.section_hidden", entityType: "cms_section", entityId: data.sectionId, summary: `${slug} / ${row.section_key}` });
    refreshPublic(PUBLIC_TAGS.cms, `cms:${slug}`);
    return ok(null, data.visible ? "Section shown" : "Section hidden");
  });
}

export async function reorderSections(input: { pageId: string; ids: string[] }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = z.object({ pageId: z.uuid(), ids: z.array(z.uuid()).min(1).max(40) }).parse(input);
    const supabase = await createClient();
    const results = await Promise.all(
      data.ids.map((id, index) => supabase.from("cms_sections").update({ sort_order: index + 1 }).eq("id", id).eq("page_id", data.pageId)),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
    const slug = await pageSlug(data.pageId);
    await audit({ actor: user, action: "cms.sections_reordered", entityType: "cms_page", entityId: data.pageId, summary: slug });
    refreshPublic(PUBLIC_TAGS.cms, `cms:${slug}`);
    return ok(null, "Order saved");
  });
}
