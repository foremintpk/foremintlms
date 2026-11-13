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

export async function createCaseStudy(input: { title: string; kind: "case_study" | "success_story" }): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    const user = await assertAdmin();
    const data = z
      .object({ title: z.string().trim().min(1, "Enter a title").max(200), kind: z.enum(["case_study", "success_story"]) })
      .parse(input);
    const supabase = await createClient();
    const base = slugify(data.title) || "story";
    let slug = base;
    for (let i = 2; i < 50; i++) {
      const { data: hit } = await supabase.from("case_studies").select("id").eq("slug", slug).maybeSingle();
      if (!hit) break;
      slug = `${base}-${i}`;
    }
    const { data: row, error } = await supabase
      .from("case_studies")
      .insert({ title: data.title, kind: data.kind, slug, status: "draft", created_by: user.id })
      .select("id")
      .single();
    if (error) throw error;
    await audit({ actor: user, action: "case_study.created", entityType: "case_study", entityId: row.id, summary: data.title, metadata: { kind: data.kind } });
    return ok({ id: row.id as string });
  });
  if (result.ok) redirect(`/admin/case-studies/${result.data.id}`);
  return result as ActionResult<null>;
}

const mediaItem = z.object({
  url: z.string().trim().min(1).max(500),
  caption: z.string().trim().max(200).default(""),
});

const caseStudySchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(["case_study", "success_story"]),
    title: z.string().trim().min(1, "Enter a title").max(200),
    slug: z.string().trim().max(120),
    summary: z.string().trim().max(600).default(""),
    cover_image_url: z.string().trim().max(500).default(""),
    customer_name: z.string().trim().max(160).default(""),
    business_name: z.string().trim().max(160).default(""),
    challenge: z.string().max(40000).default(""),
    approach: z.string().max(40000).default(""),
    implementation: z.string().max(40000).default(""),
    outcome: z.string().max(40000).default(""),
    media: z.array(mediaItem).max(20).default([]),
    course_ids: z.array(z.uuid()).max(20).default([]),
    consent_confirmed: z.boolean(),
    is_featured: z.boolean(),
    status: z.enum(["draft", "published", "archived"]),
    seo_title: z.string().trim().max(70).default(""),
    seo_description: z.string().trim().max(170).default(""),
  })
  .refine((c) => c.status !== "published" || c.consent_confirmed, {
    path: ["consent_confirmed"],
    message: "Confirm you have permission before publishing",
  });

export async function saveCaseStudy(input: z.input<typeof caseStudySchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = caseStudySchema.parse(input);
    const slug = slugify(data.slug || data.title);
    if (!slug) return fail("Check the highlighted fields.", { slug: ["Enter a slug using letters and numbers"] });
    const supabase = await createClient();
    const { data: current } = await supabase.from("case_studies").select("slug, published_at, status").eq("id", data.id).maybeSingle();
    if (!current) throw new UserFacingError("This story no longer exists.");
    const publishing = data.status === "published";
    const { error } = await supabase
      .from("case_studies")
      .update({
        kind: data.kind,
        title: data.title,
        slug,
        summary: data.summary || null,
        cover_image_url: data.cover_image_url || null,
        customer_name: data.customer_name || null,
        business_name: data.business_name || null,
        challenge: data.challenge ? sanitizeRichText(data.challenge) : null,
        approach: data.approach ? sanitizeRichText(data.approach) : null,
        implementation: data.implementation ? sanitizeRichText(data.implementation) : null,
        outcome: data.outcome ? sanitizeRichText(data.outcome) : null,
        media: data.media,
        course_ids: data.course_ids,
        consent_confirmed: data.consent_confirmed,
        is_featured: data.is_featured,
        status: data.status,
        published_at: publishing ? (current.published_at ?? new Date().toISOString()) : current.published_at,
        seo_title: data.seo_title || null,
        seo_description: data.seo_description || null,
      })
      .eq("id", data.id);
    if (error) throw error.code === "23505" ? new UserFacingError("Another story already uses this slug.") : error;
    await audit({
      actor: user,
      action: "case_study.updated",
      entityType: "case_study",
      entityId: data.id,
      summary: data.title,
      metadata: { status: data.status, consent_confirmed: data.consent_confirmed },
    });
    refreshPublic(PUBLIC_TAGS.caseStudies, `case-study:${slug}`, `case-study:${current.slug as string}`);
    return ok(null, publishing && current.status !== "published" ? "Story published" : "Story saved");
  });
}

export async function deleteCaseStudy(input: { id: string }): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    const user = await assertAdmin();
    const { id } = z.object({ id: z.uuid() }).parse(input);
    const supabase = await createClient();
    const { data: row } = await supabase.from("case_studies").select("title, slug").eq("id", id).maybeSingle();
    const { error } = await supabase.from("case_studies").delete().eq("id", id);
    if (error) throw error;
    await audit({ actor: user, action: "case_study.deleted", entityType: "case_study", entityId: id, summary: row?.title ?? undefined });
    refreshPublic(PUBLIC_TAGS.caseStudies);
    return ok(null, "Story deleted");
  });
  if (result.ok) redirect("/admin/case-studies");
  return result;
}
