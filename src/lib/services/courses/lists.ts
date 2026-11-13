import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { escapeLike, type ListParams } from "@/lib/list-params";
import type { CourseStatus } from "./builder";

export interface CourseListRow {
  id: string;
  title: string;
  slug: string;
  status: CourseStatus;
  visibility: string;
  thumbnail_url: string | null;
  is_featured: boolean;
  updated_at: string;
  submitted_for_review_at: string | null;
  scheduled_publish_at: string | null;
  category_name: string | null;
  instructors: string[];
  lesson_count: number;
  enrollment_count: number;
}

async function decorate(rows: Omit<CourseListRow, "instructors" | "lesson_count" | "enrollment_count" | "category_name">[] & { category_id?: string | null }[]) {
  if (rows.length === 0) return [] as CourseListRow[];
  const admin = createAdminClient();
  const ids = rows.map((r) => r.id);
  const categoryIds = [...new Set(rows.map((r) => (r as { category_id?: string | null }).category_id).filter(Boolean))] as string[];
  const [instRes, lessonRes, enrollRes, catRes] = await Promise.all([
    admin.from("course_instructors").select("course_id, user_id, sort_order").in("course_id", ids).order("sort_order"),
    admin.from("lessons").select("course_id").in("course_id", ids),
    admin.from("enrollments").select("course_id").in("course_id", ids),
    categoryIds.length ? admin.from("course_categories").select("id, name").in("id", categoryIds) : Promise.resolve({ data: [] }),
  ]);
  const inst = (instRes.data ?? []) as { course_id: string; user_id: string }[];
  const teacherIds = [...new Set(inst.map((i) => i.user_id))];
  const { data: teachers } = teacherIds.length
    ? await admin.from("teacher_profiles").select("user_id, public_name").in("user_id", teacherIds)
    : { data: [] };
  const names = new Map(((teachers ?? []) as { user_id: string; public_name: string }[]).map((t) => [t.user_id, t.public_name]));
  const cats = new Map(((catRes.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const countBy = (list: { course_id: string }[], id: string) => list.filter((x) => x.course_id === id).length;
  return rows.map((r) => ({
    ...r,
    category_name: cats.get((r as { category_id?: string | null }).category_id ?? "") ?? null,
    instructors: inst.filter((i) => i.course_id === r.id).map((i) => names.get(i.user_id) ?? "Instructor"),
    lesson_count: countBy((lessonRes.data ?? []) as { course_id: string }[], r.id),
    enrollment_count: countBy((enrollRes.data ?? []) as { course_id: string }[], r.id),
  })) as CourseListRow[];
}

const LIST_COLUMNS =
  "id, title, slug, status, visibility, thumbnail_url, is_featured, updated_at, submitted_for_review_at, scheduled_publish_at, category_id";

/** Courses assigned to the signed-in teacher (RLS). */
export async function listTeacherCourses(userId: string): Promise<CourseListRow[]> {
  const supabase = await createClient();
  const { data: assigned } = await supabase.from("course_instructors").select("course_id").eq("user_id", userId);
  const ids = ((assigned ?? []) as { course_id: string }[]).map((a) => a.course_id);
  if (ids.length === 0) return [];
  const { data } = await supabase.from("courses").select(LIST_COLUMNS).in("id", ids).order("updated_at", { ascending: false });
  return decorate((data ?? []) as Parameters<typeof decorate>[0]);
}

/** Admin catalogue with search, filters and pagination (RLS: admin). */
export async function listAdminCourses(params: ListParams, tab: "all" | "review") {
  const supabase = await createClient();
  let query = supabase.from("courses").select(LIST_COLUMNS, { count: "exact" });
  if (tab === "review") query = query.eq("status", "in_review");
  else if (params.filters.status) query = query.eq("status", params.filters.status);
  else query = query.neq("status", "archived");
  if (params.filters.category) query = query.eq("category_id", params.filters.category);
  if (params.filters.instructor) {
    const { data: ids } = await createAdminClient().from("course_instructors").select("course_id").eq("user_id", params.filters.instructor);
    const courseIds = ((ids ?? []) as { course_id: string }[]).map((i) => i.course_id);
    query = query.in("id", courseIds.length ? courseIds : ["00000000-0000-0000-0000-000000000000"]);
  }
  if (params.q) query = query.ilike("title", `%${escapeLike(params.q)}%`);
  const sortColumn = params.sort === "title" ? "title" : params.sort === "status" ? "status" : tab === "review" ? "submitted_for_review_at" : "updated_at";
  query = query.order(sortColumn, { ascending: params.dir === "asc" }).range(params.from, params.to);
  const { data, count } = await query;
  return { rows: await decorate((data ?? []) as Parameters<typeof decorate>[0]), total: count ?? 0 };
}

export async function listInstructorFilterOptions() {
  const { data } = await createAdminClient().from("teacher_profiles").select("user_id, public_name").eq("status", "approved").order("public_name");
  return ((data ?? []) as { user_id: string; public_name: string }[]).map((t) => ({ value: t.user_id, label: t.public_name }));
}

export async function countCoursesInReview(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase.from("courses").select("id", { count: "exact", head: true }).eq("status", "in_review");
  return count ?? 0;
}
