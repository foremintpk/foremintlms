import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { escapeLike } from "@/lib/list-params";
import { PUBLIC_TAGS } from "./tags";
import {
  averageRating,
  buildOutline,
  PLAN_COLUMNS,
  sortPlans,
  summarizeCoursePrice,
  toPublicPlan,
  type CatalogQuery,
  type RawLesson,
  type RawModule,
  type RawPlan,
} from "./shape";
import type {
  CategoryRow,
  CategorySummary,
  CourseCard,
  CourseDetail,
  CourseLevel,
  InstructorProfile,
  InstructorSummary,
  ProgramDetail,
  ProgramSummary,
  PublicPlan,
  PublicProduct,
  PublicReview,
} from "./types";

/**
 * Cached loaders for published catalog data. They run with the anonymous,
 * cookie-less client, so Row Level Security limits them to content that is
 * published for everyone; results are cached and tagged for invalidation.
 */

interface QueryResult<T> {
  data: T | null;
  error: { message: string } | null;
  count?: number | null;
}

/**
 * Unwrap a Supabase response. Row types narrow check-constrained text columns
 * (level, status, plan_type…) to unions; the database enforces those values.
 */
function must<T>(res: { data: unknown; error: { message: string } | null }, label: string): T {
  if (res.error) throw new Error(`[public:${label}] ${res.error.message}`);
  return (res.data ?? ([] as unknown)) as T;
}

const CATEGORY_COLUMNS =
  "id, slug, name, short_description, description, image_url, icon, accent_color, sort_order, seo_title, seo_description";

const COURSE_CARD_COLUMNS =
  "id, slug, title, short_description, thumbnail_url, level, is_free, is_featured, category_id, sort_order, published_at";

interface CourseCardRow {
  id: string;
  slug: string;
  title: string;
  short_description: string | null;
  thumbnail_url: string | null;
  level: CourseLevel;
  is_free: boolean;
  is_featured: boolean;
  category_id: string | null;
  sort_order: number;
  published_at: string | null;
}

const TEACHER_COLUMNS = "user_id, slug, public_name, headline, avatar_url, expertise";
const TEACHER_PROFILE_COLUMNS = `${TEACHER_COLUMNS}, bio, website_url, social_links, is_featured`;

interface TeacherRow {
  user_id: string;
  slug: string;
  public_name: string;
  headline: string | null;
  avatar_url: string | null;
  expertise: string[] | null;
  bio?: string | null;
  website_url?: string | null;
  social_links?: Record<string, string> | null;
  is_featured?: boolean;
}

function toInstructorProfile(t: TeacherRow): InstructorProfile {
  return {
    user_id: t.user_id,
    slug: t.slug,
    public_name: t.public_name,
    headline: t.headline,
    avatar_url: t.avatar_url,
    expertise: t.expertise ?? [],
    bio: t.bio ?? null,
    website_url: t.website_url ?? null,
    social_links: t.social_links ?? {},
    is_featured: Boolean(t.is_featured),
  };
}

// ---------------------------------------------------------------------------
// Building blocks (called inside cached scopes)
// ---------------------------------------------------------------------------

async function loadCategoriesMap(): Promise<Map<string, CategoryRow>> {
  const rows = must<CategoryRow[]>(
    await createPublicClient().from("course_categories").select(CATEGORY_COLUMNS).eq("status", "published"),
    "categories-map",
  );
  return new Map(rows.map((c) => [c.id, c]));
}

async function loadCoursePlans(courseIds: string[], now: Date): Promise<Map<string, PublicPlan[]>> {
  const out = new Map<string, PublicPlan[]>();
  if (courseIds.length === 0) return out;
  const products = must<{ id: string; course_id: string; pricing_plans: RawPlan[] | null }[]>(
    await createPublicClient()
      .from("products")
      .select(`id, course_id, pricing_plans(${PLAN_COLUMNS})`)
      .eq("kind", "course")
      .eq("status", "active")
      .in("course_id", courseIds),
    "course-plans",
  );
  for (const p of products) {
    const plans = (p.pricing_plans ?? []).filter((pl) => pl.visibility === "public").map((pl) => toPublicPlan(pl, now));
    out.set(p.course_id, sortPlans(plans));
  }
  return out;
}

async function loadInstructorsForCourses(courseIds: string[]): Promise<Map<string, InstructorProfile[]>> {
  const out = new Map<string, InstructorProfile[]>();
  if (courseIds.length === 0) return out;
  const supabase = createPublicClient();
  const links = must<{ course_id: string; user_id: string; role: string; sort_order: number }[]>(
    await supabase.from("course_instructors").select("course_id, user_id, role, sort_order").in("course_id", courseIds),
    "course-instructors",
  );
  const userIds = [...new Set(links.map((l) => l.user_id))];
  if (userIds.length === 0) return out;
  const teachers = must<TeacherRow[]>(
    await supabase.from("teacher_profiles").select(TEACHER_PROFILE_COLUMNS).in("user_id", userIds),
    "course-teachers",
  );
  const byUser = new Map(teachers.map((t) => [t.user_id, toInstructorProfile(t)]));
  const sorted = [...links].sort((a, b) => (a.role === b.role ? a.sort_order - b.sort_order : a.role === "lead" ? -1 : 1));
  for (const link of sorted) {
    const teacher = byUser.get(link.user_id);
    if (!teacher) continue; // instructor not approved or not public
    const list = out.get(link.course_id) ?? [];
    list.push(teacher);
    out.set(link.course_id, list);
  }
  return out;
}

async function loadLessonStats(courseIds: string[]): Promise<Map<string, { count: number; minutes: number }>> {
  const out = new Map<string, { count: number; minutes: number }>();
  if (courseIds.length === 0) return out;
  const rows = must<{ course_id: string; duration_minutes: number | null }[]>(
    await createPublicClient()
      .from("lessons")
      .select("course_id, duration_minutes, course_modules!inner(is_published)")
      .in("course_id", courseIds)
      .eq("is_published", true)
      .eq("course_modules.is_published", true),
    "lesson-stats",
  );
  for (const r of rows) {
    const s = out.get(r.course_id) ?? { count: 0, minutes: 0 };
    s.count += 1;
    s.minutes += r.duration_minutes ?? 0;
    out.set(r.course_id, s);
  }
  return out;
}

async function loadRatings(courseIds: string[]): Promise<Map<string, { average: number; count: number }>> {
  const out = new Map<string, { average: number; count: number }>();
  if (courseIds.length === 0) return out;
  const rows = must<{ course_id: string; rating: number }[]>(
    await createPublicClient().from("course_reviews").select("course_id, rating").eq("status", "published").in("course_id", courseIds),
    "ratings",
  );
  const grouped = new Map<string, number[]>();
  for (const r of rows) grouped.set(r.course_id, [...(grouped.get(r.course_id) ?? []), r.rating]);
  for (const [id, ratings] of grouped) {
    const avg = averageRating(ratings);
    if (avg) out.set(id, avg);
  }
  return out;
}

async function buildCourseCards(rows: CourseCardRow[], now: Date): Promise<CourseCard[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [categories, plans, instructors, stats, ratings] = await Promise.all([
    loadCategoriesMap(),
    loadCoursePlans(ids, now),
    loadInstructorsForCourses(ids),
    loadLessonStats(ids),
    loadRatings(ids),
  ]);
  return rows.map((r) => {
    const cat = r.category_id ? categories.get(r.category_id) : undefined;
    const price = summarizeCoursePrice(r.is_free, plans.get(r.id) ?? []);
    const stat = stats.get(r.id);
    return {
      id: r.id,
      slug: r.slug,
      title: r.title,
      short_description: r.short_description,
      thumbnail_url: r.thumbnail_url ?? cat?.image_url ?? null,
      level: r.level,
      is_free: r.is_free,
      is_featured: r.is_featured,
      category: cat ? { slug: cat.slug, name: cat.name } : null,
      instructors: (instructors.get(r.id) ?? []).map((i) => ({ slug: i.slug, public_name: i.public_name })),
      lessonCount: stat?.count ?? 0,
      durationMinutes: stat && stat.minutes > 0 ? stat.minutes : null,
      rating: ratings.get(r.id) ?? null,
      priceLabel: price.priceLabel,
      accessLabel: price.accessLabel,
    };
  });
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function getCategories(): Promise<CategorySummary[]> {
  "use cache";
  cacheTag(PUBLIC_TAGS.categories, PUBLIC_TAGS.courses);
  cacheLife("minutes");
  const supabase = createPublicClient();
  const [cats, courses] = await Promise.all([
    supabase.from("course_categories").select(CATEGORY_COLUMNS).eq("status", "published").order("sort_order"),
    supabase.from("courses").select("category_id").eq("status", "published").eq("visibility", "public"),
  ]);
  const rows = must<CategoryRow[]>(cats, "categories");
  const counts = new Map<string, number>();
  for (const c of must<{ category_id: string | null }[]>(courses, "category-counts")) {
    if (c.category_id) counts.set(c.category_id, (counts.get(c.category_id) ?? 0) + 1);
  }
  return rows.map((c) => ({ ...c, courseCount: counts.get(c.id) ?? 0 }));
}

export async function getCategoryBySlug(slug: string): Promise<{ category: CategoryRow; courses: CourseCard[] } | null> {
  "use cache";
  cacheTag(PUBLIC_TAGS.categories, PUBLIC_TAGS.courses, PUBLIC_TAGS.pricing);
  cacheLife("minutes");
  const supabase = createPublicClient();
  const category = must<CategoryRow | null>(
    await supabase.from("course_categories").select(CATEGORY_COLUMNS).eq("slug", slug).eq("status", "published").maybeSingle(),
    "category",
  );
  if (!category) return null;
  const rows = must<CourseCardRow[]>(
    await supabase
      .from("courses")
      .select(COURSE_CARD_COLUMNS)
      .eq("status", "published")
      .eq("visibility", "public")
      .eq("category_id", category.id)
      .order("is_featured", { ascending: false })
      .order("sort_order")
      .order("published_at", { ascending: false }),
    "category-courses",
  );
  return { category, courses: await buildCourseCards(rows, new Date()) };
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

export async function getFeaturedCourses(limit = 6): Promise<CourseCard[]> {
  "use cache";
  cacheTag(PUBLIC_TAGS.courses, PUBLIC_TAGS.pricing, PUBLIC_TAGS.reviews);
  cacheLife("minutes");
  const rows = must<CourseCardRow[]>(
    await createPublicClient()
      .from("courses")
      .select(COURSE_CARD_COLUMNS)
      .eq("status", "published")
      .eq("visibility", "public")
      .order("is_featured", { ascending: false })
      .order("sort_order")
      .order("published_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 12)),
    "featured-courses",
  );
  return buildCourseCards(rows, new Date());
}

export const CATALOG_PAGE_SIZE = 12;

export async function searchCourses(query: CatalogQuery): Promise<{ courses: CourseCard[]; total: number }> {
  "use cache";
  cacheTag(PUBLIC_TAGS.courses, PUBLIC_TAGS.pricing, PUBLIC_TAGS.categories);
  cacheLife("minutes");
  const supabase = createPublicClient();
  let categoryId: string | null = null;
  if (query.category) {
    const cat = must<{ id: string } | null>(
      await supabase.from("course_categories").select("id").eq("slug", query.category).eq("status", "published").maybeSingle(),
      "catalog-category",
    );
    if (!cat) return { courses: [], total: 0 };
    categoryId = cat.id;
  }
  let q = supabase
    .from("courses")
    .select(COURSE_CARD_COLUMNS, { count: "exact" })
    .eq("status", "published")
    .eq("visibility", "public");
  if (categoryId) q = q.eq("category_id", categoryId);
  if (query.level) q = q.eq("level", query.level);
  if (query.price === "free") q = q.eq("is_free", true);
  if (query.price === "paid") q = q.eq("is_free", false);
  if (query.q) {
    const term = escapeLike(query.q);
    q = q.or(`title.ilike.%${term}%,short_description.ilike.%${term}%`);
  }
  if (query.sort === "newest") q = q.order("published_at", { ascending: false });
  else if (query.sort === "title") q = q.order("title");
  else q = q.order("is_featured", { ascending: false }).order("sort_order").order("published_at", { ascending: false });
  const from = (query.page - 1) * CATALOG_PAGE_SIZE;
  const res = await q.range(from, from + CATALOG_PAGE_SIZE - 1);
  const rows = must<CourseCardRow[]>(res, "catalog");
  return { courses: await buildCourseCards(rows, new Date()), total: res.count ?? rows.length };
}

const COURSE_DETAIL_COLUMNS =
  "id, slug, title, short_description, description, thumbnail_url, banner_url, level, language, estimated_duration_minutes, learning_outcomes, requirements, target_audience, tags, is_free, certificate_enabled, status, visibility, category_id, seo_title, seo_description, published_at, updated_at";

interface CourseDetailRow {
  id: string;
  slug: string;
  title: string;
  short_description: string | null;
  description: string | null;
  thumbnail_url: string | null;
  banner_url: string | null;
  level: CourseLevel;
  language: string;
  estimated_duration_minutes: number | null;
  learning_outcomes: string[] | null;
  requirements: string[] | null;
  target_audience: string[] | null;
  tags: string[] | null;
  is_free: boolean;
  certificate_enabled: boolean;
  status: string;
  visibility: string;
  category_id: string | null;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
  updated_at: string;
}

export async function getCourseBySlug(slug: string): Promise<CourseDetail | null> {
  "use cache";
  cacheTag(PUBLIC_TAGS.courses, `course:${slug}`, PUBLIC_TAGS.reviews, PUBLIC_TAGS.instructors);
  cacheLife("minutes");
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const supabase = createPublicClient();
  const row = must<CourseDetailRow | null>(
    await supabase
      .from("courses")
      .select(COURSE_DETAIL_COLUMNS)
      .eq("slug", slug)
      .eq("status", "published")
      .in("visibility", ["public", "unlisted"])
      .maybeSingle(),
    "course",
  );
  if (!row) return null;

  const [category, modules, lessons, instructors, ratings] = await Promise.all([
    row.category_id
      ? supabase.from("course_categories").select(CATEGORY_COLUMNS).eq("id", row.category_id).eq("status", "published").maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("course_modules").select("id, title, description, sort_order").eq("course_id", row.id).eq("is_published", true),
    supabase
      .from("lessons")
      .select("id, module_id, title, lesson_type, sort_order, duration_minutes, is_preview")
      .eq("course_id", row.id)
      .eq("is_published", true),
    loadInstructorsForCourses([row.id]),
    loadRatings([row.id]),
  ]);

  const outline = buildOutline(must<RawModule[]>(modules, "modules"), must<RawLesson[]>(lessons, "lessons"));
  const lessonList = outline.flatMap((m) => m.lessons);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    short_description: row.short_description,
    description: row.description,
    thumbnail_url: row.thumbnail_url,
    banner_url: row.banner_url,
    level: row.level,
    language: row.language,
    estimated_duration_minutes: row.estimated_duration_minutes,
    learning_outcomes: row.learning_outcomes ?? [],
    requirements: row.requirements ?? [],
    target_audience: row.target_audience ?? [],
    tags: row.tags ?? [],
    is_free: row.is_free,
    certificate_enabled: row.certificate_enabled,
    status: row.status,
    visibility: row.visibility,
    category: must<CategoryRow | null>(category as QueryResult<CategoryRow | null>, "course-category"),
    seo_title: row.seo_title,
    seo_description: row.seo_description,
    published_at: row.published_at,
    updated_at: row.updated_at,
    instructors: instructors.get(row.id) ?? [],
    modules: outline,
    lessonCount: lessonList.length,
    totalLessonMinutes: lessonList.reduce((s, l) => s + (l.duration_minutes ?? 0), 0),
    rating: ratings.get(row.id) ?? null,
  };
}

export async function getRelatedCourses(courseId: string, categoryId: string | null, limit = 3): Promise<CourseCard[]> {
  "use cache";
  cacheTag(PUBLIC_TAGS.courses, PUBLIC_TAGS.pricing);
  cacheLife("minutes");
  const supabase = createPublicClient();
  let q = supabase
    .from("courses")
    .select(COURSE_CARD_COLUMNS)
    .eq("status", "published")
    .eq("visibility", "public")
    .neq("id", courseId)
    .order("is_featured", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(limit);
  if (categoryId) q = q.eq("category_id", categoryId);
  let rows = must<CourseCardRow[]>(await q, "related");
  if (rows.length < limit && categoryId) {
    const extra = must<CourseCardRow[]>(
      await supabase
        .from("courses")
        .select(COURSE_CARD_COLUMNS)
        .eq("status", "published")
        .eq("visibility", "public")
        .neq("id", courseId)
        .neq("category_id", categoryId)
        .order("is_featured", { ascending: false })
        .limit(limit - rows.length),
      "related-extra",
    );
    rows = [...rows, ...extra];
  }
  return buildCourseCards(rows, new Date());
}

/** Course cards by id, keeping the order of `ids`. */
export async function getCourseCardsByIds(ids: string[]): Promise<CourseCard[]> {
  "use cache";
  cacheTag(PUBLIC_TAGS.courses, PUBLIC_TAGS.pricing);
  cacheLife("minutes");
  if (ids.length === 0) return [];
  const rows = must<CourseCardRow[]>(
    await createPublicClient().from("courses").select(COURSE_CARD_COLUMNS).eq("status", "published").in("id", ids),
    "cards-by-id",
  );
  const order = new Map(ids.map((id, i) => [id, i]));
  rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return buildCourseCards(rows, new Date());
}

/** Published reviews with a privacy-preserving reviewer name ("Sam K."). */
export async function getCourseReviews(courseId: string, limit = 12): Promise<PublicReview[]> {
  "use cache";
  cacheTag(PUBLIC_TAGS.reviews, `reviews:${courseId}`);
  cacheLife("minutes");
  // Defined in migration 20261114100000_site_public_reviews.sql; typed loosely
  // so this compiles before and after the generated types include it.
  const client = createPublicClient() as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<QueryResult<PublicReview[]>>;
  };
  const res = await client.rpc("get_published_course_reviews", { p_course: courseId, p_limit: limit });
  return must<PublicReview[]>(res, "reviews");
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

interface ProductRow {
  id: string;
  kind: "course" | "bundle" | "membership";
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  course_id: string | null;
  grants_all_courses: boolean;
  is_featured: boolean;
  sort_order: number;
  pricing_plans: RawPlan[] | null;
  product_courses: { course_id: string; sort_order: number }[] | null;
  course_bundles: { headline: string | null; highlights: string[] | null }[] | { headline: string | null; highlights: string[] | null } | null;
}

const PRODUCT_SELECT = `id, kind, name, slug, description, image_url, course_id, grants_all_courses, is_featured, sort_order, pricing_plans(${PLAN_COLUMNS}), product_courses(course_id, sort_order), course_bundles(headline, highlights)`;

async function shapeProducts(rows: ProductRow[], now: Date): Promise<PublicProduct[]> {
  const courseIds = [...new Set(rows.flatMap((r) => (r.product_courses ?? []).map((pc) => pc.course_id)))];
  const courses = courseIds.length
    ? must<{ id: string; slug: string; title: string }[]>(
        await createPublicClient().from("courses").select("id, slug, title").eq("status", "published").in("id", courseIds),
        "product-courses",
      )
    : [];
  const courseById = new Map(courses.map((c) => [c.id, c]));
  return rows
    .map((r) => {
      const bundle = Array.isArray(r.course_bundles) ? r.course_bundles[0] : r.course_bundles;
      const plans = sortPlans((r.pricing_plans ?? []).filter((p) => p.visibility === "public").map((p) => toPublicPlan(p, now)));
      return {
        id: r.id,
        kind: r.kind,
        name: r.name,
        slug: r.slug,
        description: r.description,
        image_url: r.image_url,
        course_id: r.course_id,
        grants_all_courses: r.grants_all_courses,
        is_featured: r.is_featured,
        sort_order: r.sort_order,
        plans,
        courses: [...(r.product_courses ?? [])]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((pc) => courseById.get(pc.course_id))
          .filter((c): c is { id: string; slug: string; title: string } => Boolean(c)),
        headline: bundle?.headline ?? null,
        highlights: bundle?.highlights ?? [],
      };
    })
    .filter((p) => p.plans.length > 0);
}

/** Plans for one course: its own product, plus bundles and memberships that include it. */
export async function getCoursePricing(courseId: string): Promise<{ own: PublicProduct | null; included: PublicProduct[] }> {
  "use cache";
  cacheTag(PUBLIC_TAGS.pricing, `pricing:${courseId}`);
  cacheLife("minutes");
  const supabase = createPublicClient();
  const now = new Date();
  const [ownRes, linkRes, allAccessRes] = await Promise.all([
    supabase.from("products").select(PRODUCT_SELECT).eq("kind", "course").eq("status", "active").eq("course_id", courseId).maybeSingle(),
    supabase.from("product_courses").select("product_id").eq("course_id", courseId),
    supabase.from("products").select(PRODUCT_SELECT).eq("kind", "membership").eq("status", "active").eq("grants_all_courses", true),
  ]);
  const ownRow = must<ProductRow | null>(ownRes as QueryResult<ProductRow | null>, "own-product");
  const linkedIds = must<{ product_id: string }[]>(linkRes, "linked-products")
    .map((l) => l.product_id)
    .filter((id) => id !== ownRow?.id);
  const linked = linkedIds.length
    ? must<ProductRow[]>(
        await supabase.from("products").select(PRODUCT_SELECT).in("id", linkedIds).in("kind", ["bundle", "membership"]).eq("status", "active"),
        "linked",
      )
    : [];
  const allAccess = must<ProductRow[]>(allAccessRes as QueryResult<ProductRow[]>, "all-access");
  const includedRows = [...linked, ...allAccess.filter((a) => !linked.some((l) => l.id === a.id))].sort(
    (a, b) => Number(b.is_featured) - Number(a.is_featured) || a.sort_order - b.sort_order,
  );
  const [own] = ownRow ? await shapeProducts([ownRow], now) : [null];
  return { own: own ?? null, included: await shapeProducts(includedRows, now) };
}

/** Memberships and bundles for the pricing page and home pricing section. */
export async function getPricingCatalog(): Promise<{ memberships: PublicProduct[]; bundles: PublicProduct[]; coursesWithPlans: number }> {
  "use cache";
  cacheTag(PUBLIC_TAGS.pricing, PUBLIC_TAGS.courses);
  cacheLife("minutes");
  const supabase = createPublicClient();
  const now = new Date();
  const [rowsRes, courseProducts] = await Promise.all([
    supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .in("kind", ["membership", "bundle"])
      .eq("status", "active")
      .order("is_featured", { ascending: false })
      .order("sort_order"),
    supabase.from("products").select("id, pricing_plans!inner(id)").eq("kind", "course").eq("status", "active"),
  ]);
  const shaped = await shapeProducts(must<ProductRow[]>(rowsRes as QueryResult<ProductRow[]>, "pricing-products"), now);
  return {
    memberships: shaped.filter((p) => p.kind === "membership"),
    bundles: shaped.filter((p) => p.kind === "bundle"),
    coursesWithPlans: must<{ id: string }[]>(courseProducts, "course-products").length,
  };
}

// ---------------------------------------------------------------------------
// Instructors
// ---------------------------------------------------------------------------

export async function getInstructors(opts: { featuredOnly?: boolean; limit?: number } = {}): Promise<InstructorSummary[]> {
  "use cache";
  cacheTag(PUBLIC_TAGS.instructors);
  cacheLife("minutes");
  let q = createPublicClient()
    .from("teacher_profiles")
    .select(TEACHER_COLUMNS)
    .eq("status", "approved")
    .eq("is_public", true)
    .order("is_featured", { ascending: false })
    .order("sort_order")
    .order("public_name");
  if (opts.featuredOnly) q = q.eq("is_featured", true);
  if (opts.limit) q = q.limit(opts.limit);
  return must<TeacherRow[]>(await q, "instructors").map((t) => ({
    user_id: t.user_id,
    slug: t.slug,
    public_name: t.public_name,
    headline: t.headline,
    avatar_url: t.avatar_url,
    expertise: t.expertise ?? [],
  }));
}

export async function getInstructorBySlug(slug: string): Promise<{ instructor: InstructorProfile; courses: CourseCard[] } | null> {
  "use cache";
  cacheTag(PUBLIC_TAGS.instructors, PUBLIC_TAGS.courses);
  cacheLife("minutes");
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const supabase = createPublicClient();
  const teacher = must<TeacherRow | null>(
    await supabase.from("teacher_profiles").select(TEACHER_PROFILE_COLUMNS).eq("slug", slug).eq("status", "approved").eq("is_public", true).maybeSingle(),
    "instructor",
  );
  if (!teacher) return null;
  const links = must<{ course_id: string }[]>(
    await supabase.from("course_instructors").select("course_id").eq("user_id", teacher.user_id),
    "instructor-courses",
  );
  const ids = links.map((l) => l.course_id);
  const rows = ids.length
    ? must<CourseCardRow[]>(
        await supabase
          .from("courses")
          .select(COURSE_CARD_COLUMNS)
          .eq("status", "published")
          .eq("visibility", "public")
          .in("id", ids)
          .order("published_at", { ascending: false }),
        "instructor-course-rows",
      )
    : [];
  return { instructor: toInstructorProfile(teacher), courses: await buildCourseCards(rows, new Date()) };
}

// ---------------------------------------------------------------------------
// Learning programs
// ---------------------------------------------------------------------------

interface ProgramRow {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description?: string | null;
  image_url: string | null;
  level: CourseLevel;
  is_featured: boolean;
  learning_path_courses: { course_id: string; sort_order: number; is_required: boolean }[] | null;
}

export async function getPrograms(): Promise<ProgramSummary[]> {
  "use cache";
  cacheTag(PUBLIC_TAGS.programs, PUBLIC_TAGS.courses);
  cacheLife("minutes");
  const rows = must<ProgramRow[]>(
    await createPublicClient()
      .from("learning_paths")
      .select("id, slug, title, summary, image_url, level, is_featured, learning_path_courses(course_id, sort_order, is_required)")
      .eq("status", "published")
      .order("is_featured", { ascending: false })
      .order("sort_order"),
    "programs",
  );
  return rows.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    image_url: p.image_url,
    level: p.level,
    is_featured: p.is_featured,
    courseCount: p.learning_path_courses?.length ?? 0,
  }));
}

export async function getProgramBySlug(slug: string): Promise<ProgramDetail | null> {
  "use cache";
  cacheTag(PUBLIC_TAGS.programs, PUBLIC_TAGS.courses, PUBLIC_TAGS.pricing);
  cacheLife("minutes");
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const row = must<ProgramRow | null>(
    await createPublicClient()
      .from("learning_paths")
      .select("id, slug, title, summary, description, image_url, level, is_featured, learning_path_courses(course_id, sort_order, is_required)")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle(),
    "program",
  );
  if (!row) return null;
  const links = [...(row.learning_path_courses ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const ids = links.map((l) => l.course_id);
  const rows = ids.length
    ? must<CourseCardRow[]>(
        await createPublicClient().from("courses").select(COURSE_CARD_COLUMNS).eq("status", "published").in("id", ids),
        "program-courses",
      )
    : [];
  const cards = await buildCourseCards(rows, new Date());
  const byId = new Map(cards.map((c) => [c.id, c]));
  const courses = links
    .map((l) => {
      const card = byId.get(l.course_id);
      return card ? { ...card, is_required: l.is_required } : null;
    })
    .filter((c): c is CourseCard & { is_required: boolean } => Boolean(c));
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    description: row.description ?? null,
    image_url: row.image_url,
    level: row.level,
    is_featured: row.is_featured,
    courseCount: courses.length,
    courses,
  };
}

// ---------------------------------------------------------------------------
// Header navigation
// ---------------------------------------------------------------------------

export async function getNavCategories(): Promise<{ slug: string; name: string; short_description: string | null }[]> {
  "use cache";
  cacheTag(PUBLIC_TAGS.categories);
  cacheLife("hours");
  const rows = must<{ slug: string; name: string; short_description: string | null }[]>(
    await createPublicClient()
      .from("course_categories")
      .select("slug, name, short_description")
      .eq("status", "published")
      .order("sort_order"),
    "nav-categories",
  );
  return rows;
}
