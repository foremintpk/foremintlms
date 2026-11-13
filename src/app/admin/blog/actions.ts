"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/guards";
import { fail, ok, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import { sanitizeRichText, stripHtml } from "@/lib/sanitize";
import { slugify } from "@/lib/format";
import { PUBLIC_TAGS, refreshPublic } from "@/lib/services/admin/revalidate";

function readingMinutes(html: string): number {
  const words = stripHtml(html).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

export async function createPost(input: { title: string }): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    const user = await assertAdmin();
    const { title } = z.object({ title: z.string().trim().min(1, "Enter a title").max(200) }).parse(input);
    const supabase = await createClient();
    const base = slugify(title) || "post";
    let slug = base;
    for (let i = 2; i < 50; i++) {
      const { data: hit } = await supabase.from("blog_posts").select("id").eq("slug", slug).maybeSingle();
      if (!hit) break;
      slug = `${base}-${i}`;
    }
    const { data, error } = await supabase
      .from("blog_posts")
      .insert({ title, slug, status: "draft", author_id: user.id, author_name: user.fullName || user.displayName })
      .select("id")
      .single();
    if (error) throw error;
    await audit({ actor: user, action: "blog.created", entityType: "blog_post", entityId: data.id, summary: title });
    return ok({ id: data.id as string });
  });
  if (result.ok) redirect(`/admin/blog/${result.data.id}`);
  return result as ActionResult<null>;
}

const postSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1, "Enter a title").max(200),
  slug: z.string().trim().max(120),
  excerpt: z.string().trim().max(600).default(""),
  body: z.string().max(200000).default(""),
  cover_image_url: z.string().trim().max(500).default(""),
  author_name: z.string().trim().max(120).default(""),
  category: z.string().trim().max(60).default(""),
  tags: z.string().max(400).default(""),
  intent: z.enum(["draft", "publish", "schedule", "archive"]),
  publish_at: z.string().trim().default(""),
  seo_title: z.string().trim().max(70).default(""),
  seo_description: z.string().trim().max(170).default(""),
});

export async function savePost(input: z.input<typeof postSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = postSchema.parse(input);
    const slug = slugify(data.slug || data.title);
    if (!slug) return fail("Check the highlighted fields.", { slug: ["Enter a slug using letters and numbers"] });
    const body = sanitizeRichText(data.body);
    const supabase = await createClient();
    const { data: current } = await supabase.from("blog_posts").select("slug, published_at, status").eq("id", data.id).maybeSingle();
    if (!current) throw new UserFacingError("This post no longer exists.");

    let status: "draft" | "scheduled" | "published" | "archived" = "draft";
    let publishedAt: string | null = (current.published_at as string | null) ?? null;
    const now = Date.now();
    if (data.intent === "publish" || data.intent === "schedule") {
      if (!stripHtml(body)) return fail("Check the highlighted fields.", { body: ["Write the post before publishing it"] });
      if (data.intent === "schedule") {
        const at = new Date(data.publish_at);
        if (!data.publish_at || Number.isNaN(at.getTime())) return fail("Check the highlighted fields.", { publish_at: ["Choose when to publish"] });
        if (at.getTime() <= now) return fail("Check the highlighted fields.", { publish_at: ["Choose a time in the future, or publish now"] });
        status = "scheduled";
        publishedAt = at.toISOString();
      } else {
        status = "published";
        publishedAt = current.status === "published" && publishedAt ? publishedAt : new Date().toISOString();
      }
    } else if (data.intent === "archive") {
      status = "archived";
    } else {
      status = "draft";
      if (current.status !== "published") publishedAt = null;
    }

    const tags = [...new Set(data.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 12);
    const { error } = await supabase
      .from("blog_posts")
      .update({
        title: data.title,
        slug,
        excerpt: data.excerpt || null,
        body,
        cover_image_url: data.cover_image_url || null,
        author_name: data.author_name || null,
        category: data.category || null,
        tags,
        reading_minutes: readingMinutes(body),
        status,
        published_at: publishedAt,
        seo_title: data.seo_title || null,
        seo_description: data.seo_description || null,
      })
      .eq("id", data.id);
    if (error) throw error.code === "23505" ? new UserFacingError("Another post already uses this slug.") : error;
    await audit({ actor: user, action: `blog.${data.intent === "draft" ? "saved" : data.intent === "publish" ? "published" : data.intent === "schedule" ? "scheduled" : "archived"}`, entityType: "blog_post", entityId: data.id, summary: data.title, metadata: { status, publishedAt } });
    refreshPublic(PUBLIC_TAGS.blog, `blog:${slug}`, `blog:${current.slug as string}`);
    const message =
      status === "published" ? "Post published" : status === "scheduled" ? "Post scheduled" : status === "archived" ? "Post archived" : "Draft saved";
    return ok(null, message);
  });
}

export async function deletePost(input: { id: string }): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    const user = await assertAdmin();
    const { id } = z.object({ id: z.uuid() }).parse(input);
    const supabase = await createClient();
    const { data: row } = await supabase.from("blog_posts").select("title, slug").eq("id", id).maybeSingle();
    const { error } = await supabase.from("blog_posts").delete().eq("id", id);
    if (error) throw error;
    await audit({ actor: user, action: "blog.deleted", entityType: "blog_post", entityId: id, summary: row?.title ?? undefined });
    refreshPublic(PUBLIC_TAGS.blog);
    return ok(null, "Post deleted");
  });
  if (result.ok) redirect("/admin/blog");
  return result;
}
