import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCourseRole, requireAdmin, requireTeacher, type CourseRole } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";
import type { BlockType } from "@/lib/validation/course-blocks";

export type BuilderArea = "teach" | "admin";

export function builderBasePath(area: BuilderArea): string {
  return area === "admin" ? "/admin/courses" : "/teach/courses";
}

export type CourseStatus = "draft" | "in_review" | "published" | "unpublished" | "archived";

export interface BuilderCourse {
  id: string;
  slug: string;
  title: string;
  short_description: string | null;
  description: string | null;
  thumbnail_url: string | null;
  banner_url: string | null;
  promo_video: { video_asset_id?: string } | null;
  category_id: string | null;
  level: "beginner" | "intermediate" | "advanced" | "all_levels";
  language: string;
  estimated_duration_minutes: number | null;
  learning_outcomes: string[];
  requirements: string[];
  target_audience: string[];
  tags: string[];
  visibility: "public" | "unlisted" | "private";
  status: CourseStatus;
  is_free: boolean;
  is_featured: boolean;
  sequential_progression: boolean;
  discussions_enabled: boolean;
  certificate_enabled: boolean;
  certificate_min_progress: number;
  certificate_require_quizzes: boolean;
  certificate_require_assignments: boolean;
  published_at: string | null;
  scheduled_publish_at: string | null;
  submitted_for_review_at: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
}

export const COURSE_COLUMNS =
  "id, slug, title, short_description, description, thumbnail_url, banner_url, promo_video, category_id, level, language, estimated_duration_minutes, learning_outcomes, requirements, target_audience, tags, visibility, status, is_free, is_featured, sequential_progression, discussions_enabled, certificate_enabled, certificate_min_progress, certificate_require_quizzes, certificate_require_assignments, published_at, scheduled_publish_at, submitted_for_review_at, reviewed_at, review_notes, seo_title, seo_description, created_at, updated_at";

export interface BuilderContext {
  user: SessionUser;
  role: CourseRole;
  course: BuilderCourse;
  area: BuilderArea;
  basePath: string;
  courseBase: string;
  canEdit: boolean;
}

const uuid = z.uuid();

/**
 * Page guard for every course-builder route. Admin routes require an
 * MFA-verified admin; teacher routes require an approved instructor
 * assigned to the course. Reads go through RLS.
 */
async function loadBuilderContextUncached(courseId: string, area: BuilderArea): Promise<BuilderContext> {
  if (!uuid.safeParse(courseId).success) notFound();
  const basePath = builderBasePath(area);
  const user = area === "admin" ? await requireAdmin(`${basePath}/${courseId}`) : await requireTeacher(`${basePath}/${courseId}`);
  const role = await getCourseRole(user, courseId);
  if (area === "admin" && !role.isAdmin) redirect("/access-denied");
  if (area === "teach" && !role.isInstructor) {
    // Admins who open a teacher URL are sent to the admin builder instead.
    if (role.isAdmin) redirect(`/admin/courses/${courseId}`);
    notFound();
  }
  const supabase = await createClient();
  const { data } = await supabase.from("courses").select(COURSE_COLUMNS).eq("id", courseId).maybeSingle();
  if (!data) notFound();
  return {
    user,
    role,
    course: data as BuilderCourse,
    area,
    basePath,
    courseBase: `${basePath}/${courseId}`,
    canEdit: role.canEdit,
  };
}

/** Memoised per request so the builder layout and page share one load. */
export const loadBuilderContext = cache(loadBuilderContextUncached);

export interface CategoryOption {
  id: string;
  name: string;
  status: string;
}

export async function listCategoryOptions(): Promise<CategoryOption[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("course_categories").select("id, name, status").neq("status", "archived").order("sort_order");
  return (data ?? []) as CategoryOption[];
}

export interface BuilderLesson {
  id: string;
  module_id: string;
  title: string;
  summary: string | null;
  lesson_type: "video" | "article" | "quiz" | "assignment" | "live" | "resource" | "mixed";
  sort_order: number;
  duration_minutes: number | null;
  is_preview: boolean;
  is_published: boolean;
  release_at: string | null;
  release_after_days: number | null;
  prerequisite_lesson_id: string | null;
  completion_rule: "manual" | "video_watched" | "quiz_passed" | "assignment_approved";
  block_count: number;
}

export interface BuilderModule {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_published: boolean;
  release_at: string | null;
  release_after_days: number | null;
  lessons: BuilderLesson[];
}

export async function loadCurriculum(courseId: string): Promise<BuilderModule[]> {
  const supabase = await createClient();
  const [modulesRes, lessonsRes, blocksRes] = await Promise.all([
    supabase
      .from("course_modules")
      .select("id, title, description, sort_order, is_published, release_at, release_after_days")
      .eq("course_id", courseId)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("lessons")
      .select(
        "id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, is_published, release_at, release_after_days, prerequisite_lesson_id, completion_rule",
      )
      .eq("course_id", courseId)
      .order("sort_order")
      .order("created_at"),
    supabase.from("lesson_content_blocks").select("lesson_id").eq("course_id", courseId),
  ]);
  const counts = new Map<string, number>();
  for (const b of (blocksRes.data ?? []) as { lesson_id: string }[]) counts.set(b.lesson_id, (counts.get(b.lesson_id) ?? 0) + 1);
  const lessons = ((lessonsRes.data ?? []) as Omit<BuilderLesson, "block_count">[]).map((l) => ({ ...l, block_count: counts.get(l.id) ?? 0 }));
  return ((modulesRes.data ?? []) as Omit<BuilderModule, "lessons">[]).map((m) => ({
    ...m,
    lessons: lessons.filter((l) => l.module_id === m.id),
  }));
}

export interface BuilderBlock {
  id: string;
  lesson_id: string;
  block_type: BlockType;
  title: string | null;
  sort_order: number;
  data: Record<string, unknown>;
  video_asset_id: string | null;
  media_file_id: string | null;
  quiz_id: string | null;
  assignment_id: string | null;
  live_session_id: string | null;
}

export interface MediaFileSummary {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  status: string;
}

export interface VideoAssetSummary {
  id: string;
  provider: "youtube" | "mux" | "bunny";
  title: string | null;
  status: "waiting" | "processing" | "ready" | "errored";
  duration_seconds: number | null;
  thumbnail_url: string | null;
  error_message: string | null;
  created_at: string;
}

export interface LessonResourceRow {
  id: string;
  title: string;
  description: string | null;
  resource_type: "file" | "link";
  media_file_id: string | null;
  url: string | null;
  is_downloadable: boolean;
  sort_order: number;
  file: MediaFileSummary | null;
}

export interface LessonEditorData {
  lesson: BuilderLesson & { course_id: string };
  module: { id: string; title: string };
  blocks: BuilderBlock[];
  resources: LessonResourceRow[];
  mediaFiles: Record<string, MediaFileSummary>;
  videos: VideoAssetSummary[];
  quizzes: { id: string; title: string; status: string }[];
  assignments: { id: string; title: string; status: string }[];
  liveSessions: { id: string; title: string; starts_at: string; provider: string; status: string }[];
  recordings: { id: string; title: string | null; session_title: string; recorded_at: string | null }[];
}

export async function loadLessonEditor(courseId: string, lessonId: string): Promise<LessonEditorData | null> {
  if (!uuid.safeParse(lessonId).success) return null;
  const supabase = await createClient();
  const { data: lesson } = await supabase
    .from("lessons")
    .select(
      "id, course_id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, is_published, release_at, release_after_days, prerequisite_lesson_id, completion_rule",
    )
    .eq("id", lessonId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (!lesson) return null;

  const [moduleRes, blocksRes, resourcesRes, videosRes, quizzesRes, assignmentsRes, sessionsRes] = await Promise.all([
    supabase.from("course_modules").select("id, title").eq("id", lesson.module_id).single(),
    supabase
      .from("lesson_content_blocks")
      .select("id, lesson_id, block_type, title, sort_order, data, video_asset_id, media_file_id, quiz_id, assignment_id, live_session_id")
      .eq("lesson_id", lessonId)
      .order("sort_order"),
    supabase
      .from("lesson_resources")
      .select("id, title, description, resource_type, media_file_id, url, is_downloadable, sort_order")
      .eq("lesson_id", lessonId)
      .order("sort_order"),
    supabase
      .from("video_assets")
      .select("id, provider, title, status, duration_seconds, thumbnail_url, error_message, created_at")
      .eq("course_id", courseId)
      .order("created_at", { ascending: false }),
    supabase.from("quizzes").select("id, title, status").eq("course_id", courseId).neq("status", "archived").order("created_at"),
    supabase.from("assignments").select("id, title, status").eq("course_id", courseId).neq("status", "archived").order("created_at"),
    supabase
      .from("live_sessions")
      .select("id, title, starts_at, provider, status")
      .eq("course_id", courseId)
      .neq("status", "canceled")
      .order("starts_at", { ascending: false })
      .limit(100),
  ]);

  const sessions = (sessionsRes.data ?? []) as LessonEditorData["liveSessions"];
  let recordings: LessonEditorData["recordings"] = [];
  if (sessions.length) {
    const { data } = await supabase
      .from("meeting_recordings")
      .select("id, title, recorded_at, session_id")
      .in("session_id", sessions.map((s) => s.id))
      .order("recorded_at", { ascending: false });
    const titles = new Map(sessions.map((s) => [s.id, s.title]));
    recordings = ((data ?? []) as { id: string; title: string | null; recorded_at: string | null; session_id: string }[]).map((r) => ({
      id: r.id,
      title: r.title,
      recorded_at: r.recorded_at,
      session_title: titles.get(r.session_id) ?? "Live session",
    }));
  }

  const blocks = (blocksRes.data ?? []) as BuilderBlock[];
  const resources = (resourcesRes.data ?? []) as Omit<LessonResourceRow, "file">[];
  const fileIds = [
    ...new Set([...blocks.map((b) => b.media_file_id), ...resources.map((r) => r.media_file_id)].filter((v): v is string => Boolean(v))),
  ];
  const mediaFiles: Record<string, MediaFileSummary> = {};
  if (fileIds.length) {
    const { data } = await supabase.from("media_files").select("id, file_name, mime_type, size_bytes, status").in("id", fileIds);
    for (const f of (data ?? []) as MediaFileSummary[]) mediaFiles[f.id] = { ...f, size_bytes: Number(f.size_bytes) };
  }

  const { course_id, ...rest } = lesson as BuilderLesson & { course_id: string };
  return {
    lesson: { ...rest, course_id, block_count: blocks.length },
    module: moduleRes.data as { id: string; title: string },
    blocks,
    resources: resources.map((r) => ({ ...r, file: r.media_file_id ? (mediaFiles[r.media_file_id] ?? null) : null })),
    mediaFiles,
    videos: ((videosRes.data ?? []) as VideoAssetSummary[]).map((v) => ({
      ...v,
      duration_seconds: v.duration_seconds === null ? null : Number(v.duration_seconds),
    })),
    quizzes: (quizzesRes.data ?? []) as LessonEditorData["quizzes"],
    assignments: (assignmentsRes.data ?? []) as LessonEditorData["assignments"],
    liveSessions: sessions,
    recordings,
  };
}

export interface InstructorRow {
  user_id: string;
  role: "lead" | "assistant";
  can_edit: boolean;
  name: string;
  email: string | null;
  avatar_url: string | null;
}

/** Admin-only: current instructors and the approved teachers that can be added. */
export async function loadInstructorAssignments(courseId: string) {
  const admin = createAdminClient();
  const [assignedRes, teachersRes] = await Promise.all([
    admin.from("course_instructors").select("user_id, role, can_edit, sort_order").eq("course_id", courseId).order("sort_order"),
    admin.from("teacher_profiles").select("user_id, public_name, avatar_url, status").eq("status", "approved").order("public_name"),
  ]);
  const teachers = (teachersRes.data ?? []) as { user_id: string; public_name: string; avatar_url: string | null }[];
  const assigned = (assignedRes.data ?? []) as { user_id: string; role: "lead" | "assistant"; can_edit: boolean }[];
  const ids = [...new Set([...assigned.map((a) => a.user_id), ...teachers.map((t) => t.user_id)])];
  const emails = new Map<string, string>();
  const names = new Map<string, string>();
  if (ids.length) {
    const [privRes, profRes] = await Promise.all([
      admin.from("profile_private").select("user_id, email").in("user_id", ids),
      admin.from("profiles").select("id, full_name").in("id", ids),
    ]);
    for (const p of (privRes.data ?? []) as { user_id: string; email: string }[]) emails.set(p.user_id, p.email);
    for (const p of (profRes.data ?? []) as { id: string; full_name: string }[]) names.set(p.id, p.full_name);
  }
  const teacherById = new Map(teachers.map((t) => [t.user_id, t]));
  const rows: InstructorRow[] = assigned.map((a) => ({
    user_id: a.user_id,
    role: a.role,
    can_edit: a.can_edit,
    name: teacherById.get(a.user_id)?.public_name || names.get(a.user_id) || "Instructor",
    email: emails.get(a.user_id) ?? null,
    avatar_url: teacherById.get(a.user_id)?.avatar_url ?? null,
  }));
  const available = teachers
    .filter((t) => !assigned.some((a) => a.user_id === t.user_id))
    .map((t) => ({ user_id: t.user_id, name: t.public_name || names.get(t.user_id) || "Instructor", email: emails.get(t.user_id) ?? null }));
  return { rows, available };
}

/** Readiness checklist shown before submitting or publishing. */
export async function courseReadiness(course: BuilderCourse) {
  const modules = await loadCurriculum(course.id);
  const publishedLessons = modules.filter((m) => m.is_published).flatMap((m) => m.lessons.filter((l) => l.is_published));
  const emptyLessons = publishedLessons.filter((l) => l.block_count === 0);
  const items = [
    { key: "description", label: "Short and full description", done: Boolean(course.short_description && course.description && course.description.length > 40) },
    { key: "thumbnail", label: "Course thumbnail", done: Boolean(course.thumbnail_url) },
    { key: "category", label: "Category", done: Boolean(course.category_id) },
    { key: "outcomes", label: "At least three learning outcomes", done: course.learning_outcomes.length >= 3 },
    { key: "lessons", label: "At least one published lesson", done: publishedLessons.length > 0 },
    {
      key: "content",
      label: emptyLessons.length ? `Content in every published lesson (${emptyLessons.length} empty)` : "Content in every published lesson",
      done: publishedLessons.length > 0 && emptyLessons.length === 0,
    },
  ];
  return { items, ready: items.every((i) => i.done), lessonCount: publishedLessons.length };
}
