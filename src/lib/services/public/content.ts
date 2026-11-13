import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { PAGE_SECTIONS, parseSection, sectionSchemas, type SectionContent, type SectionKey } from "@/lib/cms/sections";
import { PUBLIC_TAGS } from "./tags";
import type { BlogPost, BlogPostSummary, CaseStudyRow, FaqRow, LegalDocumentView, LegalVersion, TestimonialRow } from "./types";

/**
 * Unwrap a Supabase response. Row types narrow check-constrained text columns
 * (level, status, plan_type…) to unions; the database enforces those values.
 */
function must<T>(res: { data: unknown; error: { message: string } | null }, label: string): T {
  if (res.error) throw new Error(`[public:${label}] ${res.error.message}`);
  return (res.data ?? ([] as unknown)) as T;
}

// ---------------------------------------------------------------------------
// CMS pages
// ---------------------------------------------------------------------------

export interface CmsSectionView<K extends SectionKey = SectionKey> {
  key: K;
  visible: boolean;
  content: SectionContent<K>;
}

export interface CmsPageView {
  slug: string;
  title: string;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  sections: Partial<{ [K in SectionKey]: CmsSectionView<K> }>;
}

/** Fallback content when a section row is missing or fails validation. */
function defaultSection<K extends SectionKey>(key: K): SectionContent<K> | null {
  const fallbacks: Partial<Record<SectionKey, unknown>> = {
    hero: {},
    featured_courses: { title: "Courses built for doing, not just watching" },
    categories: { title: "Popular learning categories" },
    why: { title: "Why learners choose Foremint Academy" },
    how_it_works: { title: "How learning works" },
    formats: { title: "Ways to learn" },
    instructors: { title: "Learn from practitioners" },
    testimonials: { title: "What learners say" },
    case_studies: { title: "Learning in practice" },
    pricing: { title: "Plans that fit how you learn" },
    faq: { title: "Questions, answered" },
    final_cta: { title: "Your next skill starts with one lesson" },
  };
  const parsed = sectionSchemas[key].safeParse(fallbacks[key] ?? {});
  return parsed.success ? (parsed.data as SectionContent<K>) : null;
}

export async function getCmsPage(slug: "home" | "about"): Promise<CmsPageView> {
  "use cache";
  cacheTag(PUBLIC_TAGS.cms, `cms:${slug}`);
  cacheLife("hours");
  const supabase = createPublicClient();
  const page = must<{ id: string; slug: string; title: string; seo_title: string | null; seo_description: string | null; og_image_url: string | null } | null>(
    await supabase
      .from("cms_pages")
      .select("id, slug, title, seo_title, seo_description, og_image_url")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle(),
    "cms-page",
  );
  const rows = page
    ? must<{ section_key: string; is_visible: boolean; content: unknown }[]>(
        await supabase.from("cms_sections").select("section_key, is_visible, content").eq("page_id", page.id),
        "cms-sections",
      )
    : [];
  const byKey = new Map(rows.map((r) => [r.section_key, r]));
  const sections: CmsPageView["sections"] = {};
  for (const key of PAGE_SECTIONS[slug] ?? []) {
    const row = byKey.get(key);
    // Hidden rows are filtered by RLS for anonymous readers; missing ⇒ hidden
    // only when the page exists, otherwise fall back to defaults.
    if (!row && page) {
      const fallback = rows.length === 0 ? defaultSection(key) : null;
      if (fallback) (sections as Record<string, unknown>)[key] = { key, visible: true, content: fallback };
      continue;
    }
    const content = row ? (parseSection(key, row.content) ?? defaultSection(key)) : defaultSection(key);
    if (content) (sections as Record<string, unknown>)[key] = { key, visible: row ? row.is_visible : true, content };
  }
  return {
    slug,
    title: page?.title ?? (slug === "home" ? "Home" : "About"),
    seo_title: page?.seo_title ?? null,
    seo_description: page?.seo_description ?? null,
    og_image_url: page?.og_image_url ?? null,
    sections,
  };
}

// ---------------------------------------------------------------------------
// FAQs, testimonials, case studies
// ---------------------------------------------------------------------------

export async function getFaqs(opts: { homeOnly?: boolean } = {}): Promise<FaqRow[]> {
  "use cache";
  cacheTag(PUBLIC_TAGS.faqs);
  cacheLife("hours");
  let q = createPublicClient().from("faqs").select("id, question, answer, category, sort_order").eq("is_published", true).order("sort_order");
  if (opts.homeOnly) q = q.eq("show_on_home", true);
  return must<FaqRow[]>(await q, "faqs");
}

export async function getTestimonials(opts: { limit?: number; featuredFirst?: boolean } = {}): Promise<TestimonialRow[]> {
  "use cache";
  cacheTag(PUBLIC_TAGS.testimonials);
  cacheLife("hours");
  let q = createPublicClient()
    .from("testimonials")
    .select("id, person_name, person_role, company, avatar_url, quote, rating, is_featured, course_id, sort_order")
    .eq("status", "published")
    .order("is_featured", { ascending: false })
    .order("sort_order");
  if (opts.limit) q = q.limit(opts.limit);
  const rows = must<(Omit<TestimonialRow, "course"> & { course_id: string | null })[]>(await q, "testimonials");
  const courseIds = [...new Set(rows.map((r) => r.course_id).filter(Boolean))] as string[];
  const courses = courseIds.length
    ? must<{ id: string; slug: string; title: string }[]>(
        await createPublicClient().from("courses").select("id, slug, title").eq("status", "published").in("id", courseIds),
        "testimonial-courses",
      )
    : [];
  const byId = new Map(courses.map((c) => [c.id, c]));
  return rows.map(({ course_id, ...r }) => {
    const c = course_id ? byId.get(course_id) : undefined;
    return { ...r, course: c ? { slug: c.slug, title: c.title } : null };
  });
}

const CASE_STUDY_LIST =
  "id, slug, kind, title, summary, cover_image_url, customer_name, business_name, is_featured, published_at, course_ids, seo_title, seo_description";

export async function getCaseStudies(kind: "case_study" | "success_story", limit?: number): Promise<CaseStudyRow[]> {
  "use cache";
  cacheTag(PUBLIC_TAGS.caseStudies);
  cacheLife("hours");
  let q = createPublicClient()
    .from("case_studies")
    .select(CASE_STUDY_LIST)
    .eq("status", "published")
    .eq("kind", kind)
    .order("is_featured", { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false });
  if (limit) q = q.limit(limit);
  const rows = must<Omit<CaseStudyRow, "challenge" | "approach" | "implementation" | "outcome" | "media">[]>(await q, "case-studies");
  return rows.map((r) => ({ ...r, challenge: null, approach: null, implementation: null, outcome: null, media: [], course_ids: r.course_ids ?? [] }));
}

export async function getCaseStudyBySlug(kind: "case_study" | "success_story", slug: string): Promise<CaseStudyRow | null> {
  "use cache";
  cacheTag(PUBLIC_TAGS.caseStudies, `case-study:${slug}`);
  cacheLife("hours");
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const row = must<CaseStudyRow | null>(
    await createPublicClient()
      .from("case_studies")
      .select(`${CASE_STUDY_LIST}, challenge, approach, implementation, outcome, media`)
      .eq("status", "published")
      .eq("kind", kind)
      .eq("slug", slug)
      .maybeSingle(),
    "case-study",
  );
  if (!row) return null;
  return { ...row, media: Array.isArray(row.media) ? row.media : [], course_ids: row.course_ids ?? [] };
}

// ---------------------------------------------------------------------------
// Blog
// ---------------------------------------------------------------------------

const BLOG_LIST = "id, slug, title, excerpt, cover_image_url, author_name, category, tags, reading_minutes, published_at";
export const BLOG_PAGE_SIZE = 9;

export async function getBlogPosts(opts: { category?: string | null; page?: number } = {}): Promise<{ posts: BlogPostSummary[]; total: number }> {
  "use cache";
  cacheTag(PUBLIC_TAGS.blog);
  cacheLife("minutes");
  const page = Math.max(1, opts.page ?? 1);
  let q = createPublicClient()
    .from("blog_posts")
    .select(BLOG_LIST, { count: "exact" })
    .eq("status", "published")
    .order("published_at", { ascending: false });
  if (opts.category) q = q.eq("category", opts.category);
  const from = (page - 1) * BLOG_PAGE_SIZE;
  const res = await q.range(from, from + BLOG_PAGE_SIZE - 1);
  const posts = must<BlogPostSummary[]>(res, "blog");
  return { posts: posts.map((p) => ({ ...p, tags: p.tags ?? [] })), total: res.count ?? posts.length };
}

export async function getBlogCategories(): Promise<string[]> {
  "use cache";
  cacheTag(PUBLIC_TAGS.blog);
  cacheLife("hours");
  const rows = must<{ category: string | null }[]>(
    await createPublicClient().from("blog_posts").select("category").eq("status", "published").not("category", "is", null),
    "blog-categories",
  );
  return [...new Set(rows.map((r) => r.category).filter((c): c is string => Boolean(c && c.trim())))].sort();
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  "use cache";
  cacheTag(PUBLIC_TAGS.blog, `blog:${slug}`);
  cacheLife("hours");
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const row = must<BlogPost | null>(
    await createPublicClient()
      .from("blog_posts")
      .select(`${BLOG_LIST}, body, seo_title, seo_description, updated_at`)
      .eq("status", "published")
      .eq("slug", slug)
      .maybeSingle(),
    "blog-post",
  );
  return row ? { ...row, tags: row.tags ?? [] } : null;
}

export async function getRecentBlogPosts(limit = 3, excludeId?: string): Promise<BlogPostSummary[]> {
  "use cache";
  cacheTag(PUBLIC_TAGS.blog);
  cacheLife("minutes");
  let q = createPublicClient().from("blog_posts").select(BLOG_LIST).eq("status", "published").order("published_at", { ascending: false }).limit(limit);
  if (excludeId) q = q.neq("id", excludeId);
  return must<BlogPostSummary[]>(await q, "recent-blog").map((p) => ({ ...p, tags: p.tags ?? [] }));
}

// ---------------------------------------------------------------------------
// Legal documents
// ---------------------------------------------------------------------------

export const LEGAL_SLUGS = ["terms", "privacy", "refund", "cookies"] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

export function isLegalSlug(value: string): value is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(value);
}

export async function getLegalDocument(slug: LegalSlug): Promise<LegalDocumentView | null> {
  "use cache";
  cacheTag(PUBLIC_TAGS.legal, `legal:${slug}`);
  cacheLife("hours");
  const supabase = createPublicClient();
  const doc = must<{ id: string; slug: string; title: string; current_version_id: string | null } | null>(
    await supabase.from("legal_documents").select("id, slug, title, current_version_id").eq("slug", slug).maybeSingle(),
    "legal-doc",
  );
  if (!doc) return null;
  const versions = must<LegalVersion[]>(
    await supabase
      .from("legal_document_versions")
      .select("id, version, body, change_summary, effective_date, status, published_at")
      .eq("document_id", doc.id)
      .in("status", ["published", "superseded"])
      .order("version", { ascending: false }),
    "legal-versions",
  );
  const current = versions.find((v) => v.id === doc.current_version_id) ?? versions.find((v) => v.status === "published") ?? null;
  return {
    slug: doc.slug,
    title: doc.title,
    current,
    history: versions.map((v) => ({
      id: v.id,
      version: v.version,
      change_summary: v.change_summary,
      effective_date: v.effective_date,
      status: v.status,
      published_at: v.published_at,
    })),
  };
}

// ---------------------------------------------------------------------------
// Sitemap
// ---------------------------------------------------------------------------

export interface SitemapData {
  courses: { slug: string; updated_at: string }[];
  categories: { slug: string; updated_at: string }[];
  instructors: { slug: string; updated_at: string }[];
  programs: { slug: string; updated_at: string }[];
  posts: { slug: string; updated_at: string }[];
  caseStudies: { slug: string; kind: string; updated_at: string }[];
  legal: { slug: string; updated_at: string }[];
}

export async function getSitemapData(): Promise<SitemapData> {
  "use cache";
  cacheTag(PUBLIC_TAGS.courses, PUBLIC_TAGS.categories, PUBLIC_TAGS.instructors, PUBLIC_TAGS.programs, PUBLIC_TAGS.blog, PUBLIC_TAGS.caseStudies, PUBLIC_TAGS.legal);
  cacheLife("hours");
  const s = createPublicClient();
  const [courses, categories, instructors, programs, posts, caseStudies, legal] = await Promise.all([
    s.from("courses").select("slug, updated_at").eq("status", "published").eq("visibility", "public"),
    s.from("course_categories").select("slug, updated_at").eq("status", "published"),
    s.from("teacher_profiles").select("slug, updated_at").eq("status", "approved").eq("is_public", true),
    s.from("learning_paths").select("slug, updated_at").eq("status", "published"),
    s.from("blog_posts").select("slug, updated_at").eq("status", "published"),
    s.from("case_studies").select("slug, kind, updated_at").eq("status", "published"),
    s.from("legal_documents").select("slug, updated_at"),
  ]);
  return {
    courses: must(courses, "sm-courses"),
    categories: must(categories, "sm-categories"),
    instructors: must(instructors, "sm-instructors"),
    programs: must(programs, "sm-programs"),
    posts: must(posts, "sm-posts"),
    caseStudies: must(caseStudies, "sm-case-studies"),
    legal: must(legal, "sm-legal"),
  };
}
