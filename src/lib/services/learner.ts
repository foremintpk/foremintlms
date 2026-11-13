import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/lib/auth/session";
import {
  computeLessonLocks,
  isReleased,
  lessonReleaseDate,
  resolveCourseAccess,
  type AccessDecision,
  type CourseStatus,
  type EntitlementLike,
  type LockReason,
} from "@/lib/domain/access";
import { assignmentDueDate, learnerAssignmentStatus, type SubmissionLike } from "@/lib/services/assignments/due";
import { getPlaybackForAsset } from "@/lib/services/video";
import type { PlaybackSource } from "@/lib/services/video/types";
import { isAllowedEmbedUrl } from "@/lib/services/courses/embeds";
import { embedSource } from "@/components/learning/lib";

/**
 * Read models for the student workspace. Every function is scoped to the
 * signed-in learner's id; callers have already authenticated the user.
 */

export interface CourseRow {
  id: string;
  slug: string;
  title: string;
  short_description: string | null;
  description: string | null;
  thumbnail_url: string | null;
  banner_url: string | null;
  category_id: string | null;
  level: string;
  language: string;
  status: CourseStatus;
  visibility: "public" | "unlisted" | "private";
  is_free: boolean;
  sequential_progression: boolean;
  certificate_enabled: boolean;
  certificate_min_progress: number;
  certificate_require_quizzes: boolean;
  certificate_require_assignments: boolean;
  discussions_enabled: boolean;
  estimated_duration_minutes: number | null;
  learning_outcomes: string[];
}

export const COURSE_COLUMNS =
  "id, slug, title, short_description, description, thumbnail_url, banner_url, category_id, level, language, status, visibility, is_free, sequential_progression, certificate_enabled, certificate_min_progress, certificate_require_quizzes, certificate_require_assignments, discussions_enabled, estimated_duration_minutes, learning_outcomes";

export async function getCourseBySlug(slug: string): Promise<CourseRow | null> {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const { data } = await createAdminClient().from("courses").select(COURSE_COLUMNS).eq("slug", slug).maybeSingle();
  return (data as CourseRow | null) ?? null;
}

export async function getCourseById(id: string): Promise<CourseRow | null> {
  const { data } = await createAdminClient().from("courses").select(COURSE_COLUMNS).eq("id", id).maybeSingle();
  return (data as CourseRow | null) ?? null;
}

export interface InstructorRef {
  userId: string;
  name: string;
  role: "lead" | "assistant";
}

/** Display names of each course's instructors (public instructor name first). */
export async function getInstructors(courseIds: string[]): Promise<Map<string, InstructorRef[]>> {
  const out = new Map<string, InstructorRef[]>();
  if (courseIds.length === 0) return out;
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("course_instructors")
    .select("course_id, user_id, role, sort_order")
    .in("course_id", courseIds)
    .order("sort_order");
  const list = (rows ?? []) as { course_id: string; user_id: string; role: "lead" | "assistant" }[];
  const userIds = [...new Set(list.map((r) => r.user_id))];
  if (userIds.length === 0) return out;
  const [teachers, profiles] = await Promise.all([
    admin.from("teacher_profiles").select("user_id, public_name").in("user_id", userIds),
    admin.from("profiles").select("id, full_name").in("id", userIds),
  ]);
  const teacherName = new Map(((teachers.data ?? []) as { user_id: string; public_name: string }[]).map((t) => [t.user_id, t.public_name]));
  const profileName = new Map(((profiles.data ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]));
  for (const r of list) {
    const name = teacherName.get(r.user_id) || profileName.get(r.user_id) || "Instructor";
    out.set(r.course_id, [...(out.get(r.course_id) ?? []), { userId: r.user_id, name, role: r.role }]);
  }
  return out;
}

/** Published lessons (in published modules) per course. */
export async function getPublishedLessonCounts(courseIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (courseIds.length === 0) return out;
  const { data } = await createAdminClient()
    .from("lessons")
    .select("id, course_id, course_modules!inner(is_published)")
    .in("course_id", courseIds)
    .eq("is_published", true)
    .eq("course_modules.is_published", true);
  for (const row of (data ?? []) as { course_id: string }[]) out.set(row.course_id, (out.get(row.course_id) ?? 0) + 1);
  return out;
}

export async function getCompletedLessonCounts(userId: string, courseIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (courseIds.length === 0) return out;
  const { data } = await createAdminClient()
    .from("lesson_progress")
    .select("course_id, lessons!inner(is_published, course_modules!inner(is_published))")
    .eq("user_id", userId)
    .eq("status", "completed")
    .in("course_id", courseIds)
    .eq("lessons.is_published", true)
    .eq("lessons.course_modules.is_published", true);
  for (const row of (data ?? []) as { course_id: string }[]) out.set(row.course_id, (out.get(row.course_id) ?? 0) + 1);
  return out;
}

export async function getUserEntitlements(userId: string): Promise<EntitlementLike[]> {
  const { data } = await createAdminClient()
    .from("course_entitlements")
    .select("id, status, scope, course_id, starts_at, expires_at")
    .eq("user_id", userId);
  return (data ?? []) as EntitlementLike[];
}

export function activeAllAccess(entitlements: EntitlementLike[], now = new Date()): { active: boolean; expiresAt: string | null } {
  const decision = resolveCourseAccess({
    courseId: "__all_access_probe__",
    courseStatus: "published",
    isStaff: false,
    entitlements: entitlements.filter((e) => e.scope === "all_access"),
    now,
  });
  return { active: decision.hasAccess, expiresAt: decision.expiresAt };
}

// ---------------------------------------------------------------------------
// My courses
// ---------------------------------------------------------------------------

export interface LearnerCourseCard {
  enrollmentId: string;
  courseId: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  instructors: string[];
  enrollmentStatus: string;
  progressPercent: number;
  completedLessons: number;
  totalLessons: number;
  access: AccessDecision;
  lastLessonId: string | null;
  lastAccessedAt: string | null;
  enrolledAt: string;
  completedAt: string | null;
  categoryId: string | null;
  bucket: "active" | "completed" | "expired";
}

interface EnrollmentJoinRow {
  id: string;
  course_id: string;
  status: string;
  enrolled_at: string;
  completed_at: string | null;
  last_lesson_id: string | null;
  last_accessed_at: string | null;
  progress_percent: number | string;
  courses: { id: string; slug: string; title: string; thumbnail_url: string | null; status: CourseStatus; category_id: string | null } | null;
}

export async function getLearnerCourses(user: SessionUser): Promise<{
  cards: LearnerCourseCard[];
  allAccess: { active: boolean; expiresAt: string | null };
  entitlements: EntitlementLike[];
}> {
  const admin = createAdminClient();
  const [enrRes, entitlements] = await Promise.all([
    admin
      .from("enrollments")
      .select(
        "id, course_id, status, enrolled_at, completed_at, last_lesson_id, last_accessed_at, progress_percent, courses!inner(id, slug, title, thumbnail_url, status, category_id)",
      )
      .eq("user_id", user.id)
      .order("last_accessed_at", { ascending: false, nullsFirst: false }),
    getUserEntitlements(user.id),
  ]);
  const rows = ((enrRes.data ?? []) as unknown as EnrollmentJoinRow[]).filter((r) => r.courses);
  const ids = rows.map((r) => r.course_id);
  const [instructors, totals, completed] = await Promise.all([
    getInstructors(ids),
    getPublishedLessonCounts(ids),
    getCompletedLessonCounts(user.id, ids),
  ]);

  const cards = rows.map<LearnerCourseCard>((r) => {
    const course = r.courses!;
    const access = resolveCourseAccess({ courseId: r.course_id, courseStatus: course.status, isStaff: false, entitlements });
    const bucket: LearnerCourseCard["bucket"] =
      r.status === "completed" ? "completed" : access.hasAccess ? "active" : "expired";
    return {
      enrollmentId: r.id,
      courseId: r.course_id,
      slug: course.slug,
      title: course.title,
      thumbnailUrl: course.thumbnail_url,
      instructors: (instructors.get(r.course_id) ?? []).map((i) => i.name),
      enrollmentStatus: r.status,
      progressPercent: Number(r.progress_percent ?? 0),
      completedLessons: completed.get(r.course_id) ?? 0,
      totalLessons: totals.get(r.course_id) ?? 0,
      access,
      lastLessonId: r.last_lesson_id,
      lastAccessedAt: r.last_accessed_at,
      enrolledAt: r.enrolled_at,
      completedAt: r.completed_at,
      categoryId: course.category_id,
      bucket,
    };
  });

  return { cards, allAccess: activeAllAccess(entitlements), entitlements };
}

export interface CatalogCourse {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  thumbnailUrl: string | null;
  level: string;
  instructors: string[];
  totalLessons: number;
}

/** Published courses an all-access member hasn't opened yet. */
export async function getAllAccessLibrary(excludeCourseIds: string[], limit = 60): Promise<CatalogCourse[]> {
  let query = createAdminClient()
    .from("courses")
    .select("id, slug, title, short_description, thumbnail_url, level")
    .eq("status", "published")
    .eq("visibility", "public")
    .order("sort_order")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (excludeCourseIds.length) query = query.not("id", "in", `(${excludeCourseIds.join(",")})`);
  const { data } = await query;
  const rows = (data ?? []) as { id: string; slug: string; title: string; short_description: string | null; thumbnail_url: string | null; level: string }[];
  const ids = rows.map((r) => r.id);
  const [instructors, totals] = await Promise.all([getInstructors(ids), getPublishedLessonCounts(ids)]);
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    shortDescription: r.short_description,
    thumbnailUrl: r.thumbnail_url,
    level: r.level,
    instructors: (instructors.get(r.id) ?? []).map((i) => i.name),
    totalLessons: totals.get(r.id) ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Course outline (modules, lessons, progress, drip and locks)
// ---------------------------------------------------------------------------

export interface OutlineLesson {
  id: string;
  moduleId: string;
  title: string;
  summary: string | null;
  lessonType: string;
  durationMinutes: number | null;
  isPreview: boolean;
  isPublished: boolean;
  completionRule: "manual" | "video_watched" | "quiz_passed" | "assignment_approved";
  prerequisiteLessonId: string | null;
  status: "not_started" | "in_progress" | "completed";
  progressPercent: number;
  videoPositionSeconds: number;
  videoDurationSeconds: number | null;
  releaseAt: string | null;
  released: boolean;
  lock: LockReason;
  index: number;
}

export interface OutlineModule {
  id: string;
  title: string;
  description: string | null;
  isPublished: boolean;
  lessons: OutlineLesson[];
}

export interface CourseOutline {
  modules: OutlineModule[];
  lessons: OutlineLesson[];
  totalLessons: number;
  completedLessons: number;
}

interface ModuleRow {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_published: boolean;
  release_at: string | null;
  release_after_days: number | null;
}

interface LessonRow {
  id: string;
  module_id: string;
  title: string;
  summary: string | null;
  lesson_type: string;
  sort_order: number;
  duration_minutes: number | null;
  is_preview: boolean;
  is_published: boolean;
  release_at: string | null;
  release_after_days: number | null;
  prerequisite_lesson_id: string | null;
  completion_rule: OutlineLesson["completionRule"];
}

interface ProgressRow {
  lesson_id: string;
  status: "in_progress" | "completed";
  progress_percent: number | string;
  video_position_seconds: number | string;
  video_duration_seconds: number | string | null;
}

export async function getCourseOutline(
  course: Pick<CourseRow, "id" | "sequential_progression">,
  userId: string,
  opts: { isStaff: boolean; enrolledAt: string | null; now?: Date },
): Promise<CourseOutline> {
  const admin = createAdminClient();
  const now = opts.now ?? new Date();
  let modulesQ = admin
    .from("course_modules")
    .select("id, title, description, sort_order, is_published, release_at, release_after_days")
    .eq("course_id", course.id)
    .order("sort_order")
    .order("created_at");
  let lessonsQ = admin
    .from("lessons")
    .select(
      "id, module_id, title, summary, lesson_type, sort_order, duration_minutes, is_preview, is_published, release_at, release_after_days, prerequisite_lesson_id, completion_rule",
    )
    .eq("course_id", course.id)
    .order("sort_order")
    .order("created_at");
  if (!opts.isStaff) {
    modulesQ = modulesQ.eq("is_published", true);
    lessonsQ = lessonsQ.eq("is_published", true);
  }
  const [modulesRes, lessonsRes, progressRes] = await Promise.all([
    modulesQ,
    lessonsQ,
    admin
      .from("lesson_progress")
      .select("lesson_id, status, progress_percent, video_position_seconds, video_duration_seconds")
      .eq("user_id", userId)
      .eq("course_id", course.id),
  ]);
  const modules = (modulesRes.data ?? []) as ModuleRow[];
  const lessons = (lessonsRes.data ?? []) as LessonRow[];
  const progress = new Map(((progressRes.data ?? []) as ProgressRow[]).map((p) => [p.lesson_id, p]));
  const moduleIds = new Set(modules.map((m) => m.id));
  const enrolledAt = opts.enrolledAt ? new Date(opts.enrolledAt) : null;

  const ordered: { lesson: LessonRow; module: ModuleRow }[] = [];
  for (const m of modules) {
    for (const l of lessons.filter((x) => x.module_id === m.id)) ordered.push({ lesson: l, module: m });
  }
  const completed = new Set(
    ordered.filter(({ lesson }) => progress.get(lesson.id)?.status === "completed").map(({ lesson }) => lesson.id),
  );
  const locks = opts.isStaff
    ? new Map<string, LockReason>()
    : computeLessonLocks(
        ordered.map(({ lesson }) => ({ id: lesson.id, prerequisite_lesson_id: lesson.prerequisite_lesson_id })),
        completed,
        course.sequential_progression,
      );

  const flat: OutlineLesson[] = ordered.map(({ lesson, module }, index) => {
    const p = progress.get(lesson.id);
    const releaseDate = lessonReleaseDate(lesson, module, enrolledAt);
    const released = opts.isStaff || isReleased(releaseDate, now);
    return {
      id: lesson.id,
      moduleId: module.id,
      title: lesson.title,
      summary: lesson.summary,
      lessonType: lesson.lesson_type,
      durationMinutes: lesson.duration_minutes,
      isPreview: lesson.is_preview,
      isPublished: lesson.is_published && module.is_published,
      completionRule: lesson.completion_rule,
      prerequisiteLessonId: lesson.prerequisite_lesson_id,
      status: p ? p.status : "not_started",
      progressPercent: Number(p?.progress_percent ?? 0),
      videoPositionSeconds: Number(p?.video_position_seconds ?? 0),
      videoDurationSeconds: p?.video_duration_seconds != null ? Number(p.video_duration_seconds) : null,
      releaseAt: releaseDate && releaseDate.getTime() < 8.64e15 ? releaseDate.toISOString() : null,
      released,
      lock: locks.get(lesson.id) ?? null,
      index,
    };
  });

  return {
    modules: modules
      .filter((m) => moduleIds.has(m.id))
      .map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        isPublished: m.is_published,
        lessons: flat.filter((l) => l.moduleId === m.id),
      })),
    lessons: flat,
    totalLessons: flat.filter((l) => l.isPublished).length,
    completedLessons: flat.filter((l) => l.isPublished && l.status === "completed").length,
  };
}

/** First lesson to open: the last one viewed, else the first incomplete unlocked one. */
export function pickResumeLesson(outline: CourseOutline, lastLessonId: string | null): OutlineLesson | null {
  const playable = outline.lessons.filter((l) => l.released && !l.lock);
  if (lastLessonId) {
    const last = playable.find((l) => l.id === lastLessonId);
    if (last && last.status !== "completed") return last;
  }
  return playable.find((l) => l.status !== "completed") ?? playable[0] ?? null;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface PendingAssignment {
  id: string;
  title: string;
  courseSlug: string;
  courseTitle: string;
  dueAt: string | null;
  status: ReturnType<typeof learnerAssignmentStatus>;
}

export async function getPendingAssignments(userId: string, courses: LearnerCourseCard[], limit = 50): Promise<PendingAssignment[]> {
  const accessible = courses.filter((c) => c.access.hasAccess);
  if (accessible.length === 0) return [];
  const admin = createAdminClient();
  const ids = accessible.map((c) => c.courseId);
  const [assignRes, subRes] = await Promise.all([
    admin
      .from("assignments")
      .select("id, course_id, title, due_at, due_days_after_enrollment")
      .in("course_id", ids)
      .eq("status", "published"),
    admin
      .from("assignment_submissions")
      .select("assignment_id, status, grade_points, attempt_number")
      .eq("user_id", userId)
      .in("course_id", ids)
      .order("attempt_number", { ascending: false }),
  ]);
  const latest = new Map<string, SubmissionLike>();
  for (const s of (subRes.data ?? []) as (SubmissionLike & { assignment_id: string })[]) {
    if (!latest.has(s.assignment_id)) latest.set(s.assignment_id, s);
  }
  const byCourse = new Map(accessible.map((c) => [c.courseId, c]));
  const now = new Date();
  const items = ((assignRes.data ?? []) as { id: string; course_id: string; title: string; due_at: string | null; due_days_after_enrollment: number | null }[])
    .map((a) => {
      const course = byCourse.get(a.course_id)!;
      const due = assignmentDueDate(a, course.enrolledAt);
      return {
        id: a.id,
        title: a.title,
        courseSlug: course.slug,
        courseTitle: course.title,
        dueAt: due ? due.toISOString() : null,
        status: learnerAssignmentStatus(latest.get(a.id), due, now),
      };
    });
  return items
    .sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"))
    .slice(0, limit);
}

export interface UpcomingSession {
  id: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  provider: string;
  status: string;
  courseTitle: string;
  courseSlug: string;
}

/** Live sessions visible to the learner (RLS: has_course_access). */
export async function getUpcomingSessions(limit = 5): Promise<UpcomingSession[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 3 * 3_600_000).toISOString();
  const { data } = await supabase
    .from("live_sessions")
    .select("id, title, starts_at, duration_minutes, provider, status, courses(title, slug)")
    .in("status", ["scheduled", "live"])
    .gte("starts_at", since)
    .order("starts_at")
    .limit(limit);
  const now = Date.now();
  return ((data ?? []) as unknown as {
    id: string;
    title: string;
    starts_at: string;
    duration_minutes: number;
    provider: string;
    status: string;
    courses: { title: string; slug: string } | null;
  }[])
    .filter((s) => new Date(s.starts_at).getTime() + s.duration_minutes * 60_000 > now)
    .map((s) => ({
      id: s.id,
      title: s.title,
      startsAt: s.starts_at,
      durationMinutes: s.duration_minutes,
      provider: s.provider,
      status: s.status,
      courseTitle: s.courses?.title ?? "",
      courseSlug: s.courses?.slug ?? "",
    }));
}

export interface DashboardData {
  courses: LearnerCourseCard[];
  allAccess: { active: boolean; expiresAt: string | null };
  continueCourse: LearnerCourseCard | null;
  overallProgress: number;
  totals: { lessonsCompleted: number; coursesCompleted: number; certificates: number };
  sessions: UpcomingSession[];
  announcements: { id: string; title: string; body: string; published_at: string }[];
  assignments: PendingAssignment[];
  notifications: { id: string; title: string; body: string | null; url: string | null; created_at: string; read_at: string | null }[];
  certificates: { id: string; certificate_number: string; course_title: string; issued_at: string }[];
  recommended: CatalogCourse[];
  history: { lessonId: string; lessonTitle: string; courseSlug: string; courseTitle: string; viewedAt: string; status: string }[];
}

export async function getLearnerDashboard(user: SessionUser): Promise<DashboardData> {
  const admin = createAdminClient();
  const supabase = await createClient();
  const { cards, allAccess } = await getLearnerCourses(user);

  const enrolledIds = cards.map((c) => c.courseId);
  const categories = [...new Set(cards.map((c) => c.categoryId).filter(Boolean))] as string[];

  const [sessions, announcementsRes, assignments, notificationsRes, certificatesRes, historyRes, certCount] = await Promise.all([
    getUpcomingSessions(4),
    supabase
      .from("announcements")
      .select("id, title, body, published_at")
      .not("published_at", "is", null)
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(3),
    getPendingAssignments(user.id, cards, 5),
    admin
      .from("notifications")
      .select("id, title, body, url, created_at, read_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("certificates")
      .select("id, certificate_number, course_title, issued_at")
      .eq("user_id", user.id)
      .eq("status", "issued")
      .order("issued_at", { ascending: false })
      .limit(3),
    admin
      .from("lesson_progress")
      .select("lesson_id, status, last_viewed_at, lessons(title), courses(slug, title)")
      .eq("user_id", user.id)
      .order("last_viewed_at", { ascending: false })
      .limit(6),
    admin.from("certificates").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "issued"),
  ]);

  let recommendedRows: { id: string }[] = [];
  {
    let q = admin.from("courses").select("id").eq("status", "published").eq("visibility", "public").limit(6);
    if (enrolledIds.length) q = q.not("id", "in", `(${enrolledIds.join(",")})`);
    if (categories.length) q = q.in("category_id", categories);
    const { data } = await q.order("is_featured", { ascending: false }).order("published_at", { ascending: false });
    recommendedRows = (data ?? []) as { id: string }[];
    if (recommendedRows.length < 3 && categories.length) {
      let fallback = admin.from("courses").select("id").eq("status", "published").eq("visibility", "public").limit(6);
      if (enrolledIds.length) fallback = fallback.not("id", "in", `(${enrolledIds.join(",")})`);
      const { data: more } = await fallback.order("is_featured", { ascending: false });
      const seen = new Set(recommendedRows.map((r) => r.id));
      recommendedRows = [...recommendedRows, ...((more ?? []) as { id: string }[]).filter((r) => !seen.has(r.id))];
    }
  }
  const recommendedIds = recommendedRows.slice(0, 3).map((r) => r.id);
  const recommended = recommendedIds.length
    ? (await getAllAccessLibrary(enrolledIds, 30)).filter((c) => recommendedIds.includes(c.id)).slice(0, 3)
    : [];

  const learning = cards.filter((c) => c.access.hasAccess || c.bucket === "completed");
  const totalLessons = learning.reduce((s, c) => s + c.totalLessons, 0);
  const doneLessons = learning.reduce((s, c) => s + Math.min(c.completedLessons, c.totalLessons), 0);
  const continueCourse =
    cards.find((c) => c.bucket === "active" && c.lastAccessedAt) ?? cards.find((c) => c.bucket === "active") ?? null;

  return {
    courses: cards,
    allAccess,
    continueCourse,
    overallProgress: totalLessons ? Math.round((doneLessons / totalLessons) * 100) : 0,
    totals: {
      lessonsCompleted: cards.reduce((s, c) => s + c.completedLessons, 0),
      coursesCompleted: cards.filter((c) => c.bucket === "completed").length,
      certificates: certCount.count ?? 0,
    },
    sessions,
    announcements: (announcementsRes.data ?? []) as DashboardData["announcements"],
    assignments,
    notifications: (notificationsRes.data ?? []) as DashboardData["notifications"],
    certificates: (certificatesRes.data ?? []) as DashboardData["certificates"],
    recommended,
    history: ((historyRes.data ?? []) as unknown as {
      lesson_id: string;
      status: string;
      last_viewed_at: string;
      lessons: { title: string } | null;
      courses: { slug: string; title: string } | null;
    }[])
      .filter((h) => h.lessons && h.courses)
      .map((h) => ({
        lessonId: h.lesson_id,
        lessonTitle: h.lessons!.title,
        courseSlug: h.courses!.slug,
        courseTitle: h.courses!.title,
        viewedAt: h.last_viewed_at,
        status: h.status,
      })),
  };
}

// ---------------------------------------------------------------------------
// Lesson content (the player)
// ---------------------------------------------------------------------------

export interface FileMeta {
  id: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface QuizSummary {
  id: string;
  title: string;
  description: string | null;
  passingScore: number;
  timeLimitMinutes: number | null;
  maxAttempts: number | null;
  attemptsUsed: number;
  bestPercent: number | null;
  passed: boolean;
  pendingReview: boolean;
  inProgress: boolean;
}

export interface AssignmentSummary {
  id: string;
  title: string;
  dueAt: string | null;
  maxPoints: number;
  status: ReturnType<typeof learnerAssignmentStatus>;
  gradePoints: number | null;
}

export interface SessionSummary {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  durationMinutes: number;
  provider: string;
  status: string;
}

export interface ResourceItem {
  id: string;
  title: string;
  description: string | null;
  kind: "file" | "link";
  url: string | null;
  downloadable: boolean;
  file: FileMeta | null;
}

export interface VideoItem {
  assetId: string;
  title: string | null;
  status: "ready" | "waiting" | "processing" | "errored" | "missing";
  playback: PlaybackSource | null;
}

export type LessonBlockView =
  | { kind: "video"; id: string; title: string | null; caption: string | null; video: VideoItem }
  | { kind: "video_playlist"; id: string; title: string | null; caption: string | null; items: VideoItem[] }
  | { kind: "embed"; id: string; title: string | null; caption: string | null; src: string | null; url: string | null; aspect: string; provider: string | null }
  | { kind: "rich_text"; id: string; title: string | null; html: string }
  | {
      kind: "file";
      id: string;
      title: string | null;
      variant: "pdf" | "document" | "presentation" | "spreadsheet" | "image" | "file";
      file: FileMeta | null;
      description: string | null;
      caption: string | null;
      alt: string | null;
      allowDownload: boolean;
    }
  | { kind: "link"; id: string; title: string | null; url: string | null; label: string; description: string | null }
  | { kind: "quiz"; id: string; title: string | null; intro: string | null; quiz: QuizSummary | null }
  | { kind: "assignment"; id: string; title: string | null; intro: string | null; assignment: AssignmentSummary | null }
  | { kind: "live_session"; id: string; title: string | null; intro: string | null; session: SessionSummary | null }
  | {
      kind: "recording";
      id: string;
      title: string | null;
      caption: string | null;
      video: VideoItem | null;
      external: { url: string; passcode: string | null; title: string | null } | null;
    }
  | { kind: "resource_collection"; id: string; title: string | null; heading: string | null; description: string | null; resources: ResourceItem[] };

interface BlockRow {
  id: string;
  block_type: string;
  title: string | null;
  sort_order: number;
  data: Record<string, unknown> | null;
  video_asset_id: string | null;
  media_file_id: string | null;
  quiz_id: string | null;
  assignment_id: string | null;
  live_session_id: string | null;
}

interface ResourceRow {
  id: string;
  title: string;
  description: string | null;
  resource_type: "file" | "link";
  media_file_id: string | null;
  url: string | null;
  is_downloadable: boolean;
}

interface MediaRow {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  status: string;
  course_id: string | null;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);

async function courseFileMeta(ids: string[], courseId: string): Promise<Map<string, FileMeta>> {
  if (ids.length === 0) return new Map();
  const { data } = await createAdminClient()
    .from("media_files")
    .select("id, file_name, mime_type, size_bytes, status, course_id")
    .in("id", [...new Set(ids)]);
  return new Map(
    ((data ?? []) as MediaRow[])
      .filter((f) => f.status === "ready" && f.course_id === courseId)
      .map((f) => [f.id, { id: f.id, name: f.file_name, mimeType: f.mime_type, size: Number(f.size_bytes) }]),
  );
}

function toResourceItem(r: ResourceRow, files: Map<string, FileMeta>): ResourceItem {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    kind: r.resource_type,
    url: r.resource_type === "link" && r.url && /^https?:\/\//i.test(r.url) ? r.url : null,
    downloadable: r.is_downloadable,
    file: r.media_file_id ? (files.get(r.media_file_id) ?? null) : null,
  };
}

/**
 * Resolve a lesson's blocks for rendering. Blocks are read with the user's
 * own client so RLS re-applies access, drip release and preview rules.
 * Only videos/files belonging to this course are ever rendered.
 */
export async function getLessonBlocks(
  user: SessionUser,
  ctx: { courseId: string; lessonId: string; enrolledAt: string | null; resumeSeconds: number },
): Promise<LessonBlockView[]> {
  const supabase = await createClient();
  const admin = createAdminClient();
  const { data } = await supabase
    .from("lesson_content_blocks")
    .select("id, block_type, title, sort_order, data, video_asset_id, media_file_id, quiz_id, assignment_id, live_session_id")
    .eq("lesson_id", ctx.lessonId)
    .order("sort_order")
    .order("created_at");
  const blocks = (data ?? []) as BlockRow[];
  if (blocks.length === 0) return [];

  const videoIds = new Set<string>();
  const fileIds = new Set<string>();
  const quizIds = new Set<string>();
  const assignmentIds = new Set<string>();
  const sessionIds = new Set<string>();
  const recordingIds = new Set<string>();
  for (const b of blocks) {
    const d = b.data ?? {};
    if (b.video_asset_id) videoIds.add(b.video_asset_id);
    if (b.block_type === "video_playlist" && Array.isArray(d.video_asset_ids)) {
      for (const v of d.video_asset_ids) if (typeof v === "string") videoIds.add(v);
    }
    if (b.block_type === "recording") {
      const vid = str(d.video_asset_id);
      const rec = str(d.meeting_recording_id);
      if (vid) videoIds.add(vid);
      if (rec) recordingIds.add(rec);
    }
    if (b.media_file_id) fileIds.add(b.media_file_id);
    if (b.quiz_id) quizIds.add(b.quiz_id);
    if (b.assignment_id) assignmentIds.add(b.assignment_id);
    if (b.live_session_id) sessionIds.add(b.live_session_id);
  }
  const hasCollection = blocks.some((b) => b.block_type === "resource_collection");

  const [recordingsRes, resourcesRes] = await Promise.all([
    recordingIds.size
      ? supabase.from("meeting_recordings").select("id, url, passcode, title, video_asset_id").in("id", [...recordingIds])
      : Promise.resolve({ data: [] }),
    hasCollection
      ? supabase
          .from("lesson_resources")
          .select("id, title, description, resource_type, media_file_id, url, is_downloadable, sort_order")
          .eq("lesson_id", ctx.lessonId)
          .order("sort_order")
      : Promise.resolve({ data: [] }),
  ]);
  const recordings = new Map(
    ((recordingsRes.data ?? []) as { id: string; url: string | null; passcode: string | null; title: string | null; video_asset_id: string | null }[]).map(
      (r) => [r.id, r],
    ),
  );
  for (const r of recordings.values()) if (r.video_asset_id) videoIds.add(r.video_asset_id);
  const resources = (resourcesRes.data ?? []) as ResourceRow[];
  for (const r of resources) if (r.media_file_id) fileIds.add(r.media_file_id);

  const [assetsRes, files, quizzesRes, assignmentsRes, sessionsRes] = await Promise.all([
    videoIds.size ? admin.from("video_assets").select("id, title, status, course_id").in("id", [...videoIds]) : Promise.resolve({ data: [] }),
    courseFileMeta([...fileIds], ctx.courseId),
    quizIds.size
      ? admin
          .from("quizzes")
          .select("id, title, description, passing_score, time_limit_minutes, max_attempts, status, course_id")
          .in("id", [...quizIds])
      : Promise.resolve({ data: [] }),
    assignmentIds.size
      ? admin
          .from("assignments")
          .select("id, title, due_at, due_days_after_enrollment, max_points, status, course_id")
          .in("id", [...assignmentIds])
      : Promise.resolve({ data: [] }),
    sessionIds.size
      ? supabase.from("live_sessions").select("id, title, description, starts_at, duration_minutes, provider, status").in("id", [...sessionIds])
      : Promise.resolve({ data: [] }),
  ]);

  const assets = new Map(
    ((assetsRes.data ?? []) as { id: string; title: string | null; status: VideoItem["status"]; course_id: string | null }[])
      .filter((a) => a.course_id === ctx.courseId)
      .map((a) => [a.id, a]),
  );

  const playbackCache = new Map<string, VideoItem>();
  let firstVideo = true;
  const video = async (assetId: string | null): Promise<VideoItem> => {
    if (!assetId) return { assetId: "", title: null, status: "missing", playback: null };
    const cached = playbackCache.get(assetId);
    if (cached) return cached;
    const asset = assets.get(assetId);
    let item: VideoItem;
    if (!asset) item = { assetId, title: null, status: "missing", playback: null };
    else if (asset.status !== "ready") item = { assetId, title: asset.title, status: asset.status, playback: null };
    else {
      // Resume only the lesson's first video; the others start from zero.
      const start = firstVideo ? ctx.resumeSeconds : 0;
      firstVideo = false;
      const playback = await getPlaybackForAsset(assetId, user.id, start);
      item = { assetId, title: asset.title, status: playback ? "ready" : "errored", playback };
    }
    playbackCache.set(assetId, item);
    return item;
  };

  const quizSummaries = new Map<string, QuizSummary>();
  const quizRows = ((quizzesRes.data ?? []) as {
    id: string;
    title: string;
    description: string | null;
    passing_score: number;
    time_limit_minutes: number | null;
    max_attempts: number | null;
    status: string;
    course_id: string;
  }[]).filter((q) => q.course_id === ctx.courseId && q.status === "published");
  if (quizRows.length) {
    const { data: attempts } = await admin
      .from("quiz_attempts")
      .select("quiz_id, status, percent, passed")
      .eq("user_id", user.id)
      .in("quiz_id", quizRows.map((q) => q.id));
    const all = (attempts ?? []) as { quiz_id: string; status: string; percent: number | null; passed: boolean | null }[];
    for (const q of quizRows) {
      const mine = all.filter((a) => a.quiz_id === q.id);
      const finished = mine.filter((a) => a.status !== "in_progress");
      const best = finished.reduce<number | null>(
        (m, a) => (a.percent == null ? m : m == null ? Number(a.percent) : Math.max(m, Number(a.percent))),
        null,
      );
      quizSummaries.set(q.id, {
        id: q.id,
        title: q.title,
        description: q.description,
        passingScore: q.passing_score,
        timeLimitMinutes: q.time_limit_minutes,
        maxAttempts: q.max_attempts,
        attemptsUsed: finished.length,
        bestPercent: best,
        passed: finished.some((a) => a.passed),
        pendingReview: finished.some((a) => a.status === "needs_review"),
        inProgress: mine.some((a) => a.status === "in_progress"),
      });
    }
  }

  const assignmentSummaries = new Map<string, AssignmentSummary>();
  const assignmentRows = ((assignmentsRes.data ?? []) as {
    id: string;
    title: string;
    due_at: string | null;
    due_days_after_enrollment: number | null;
    max_points: number;
    status: string;
    course_id: string;
  }[]).filter((a) => a.course_id === ctx.courseId && a.status === "published");
  if (assignmentRows.length) {
    const { data: subs } = await admin
      .from("assignment_submissions")
      .select("assignment_id, status, grade_points, attempt_number")
      .eq("user_id", user.id)
      .in("assignment_id", assignmentRows.map((a) => a.id))
      .order("attempt_number", { ascending: false });
    const latest = new Map<string, SubmissionLike>();
    for (const s of (subs ?? []) as (SubmissionLike & { assignment_id: string })[]) {
      if (!latest.has(s.assignment_id)) latest.set(s.assignment_id, s);
    }
    for (const a of assignmentRows) {
      const due = assignmentDueDate(a, ctx.enrolledAt);
      const sub = latest.get(a.id);
      assignmentSummaries.set(a.id, {
        id: a.id,
        title: a.title,
        dueAt: due?.toISOString() ?? null,
        maxPoints: Number(a.max_points),
        status: learnerAssignmentStatus(sub, due),
        gradePoints: sub?.grade_points != null ? Number(sub.grade_points) : null,
      });
    }
  }

  const sessions = new Map<string, SessionSummary>(
    ((sessionsRes.data ?? []) as {
      id: string;
      title: string;
      description: string | null;
      starts_at: string;
      duration_minutes: number;
      provider: string;
      status: string;
    }[]).map((s) => [
      s.id,
      { id: s.id, title: s.title, description: s.description, startsAt: s.starts_at, durationMinutes: s.duration_minutes, provider: s.provider, status: s.status },
    ]),
  );

  const views: LessonBlockView[] = [];
  for (const b of blocks) {
    const d = b.data ?? {};
    switch (b.block_type) {
      case "video":
        views.push({ kind: "video", id: b.id, title: b.title, caption: str(d.caption), video: await video(b.video_asset_id) });
        break;
      case "video_playlist": {
        const ids = Array.isArray(d.video_asset_ids) ? (d.video_asset_ids as unknown[]).filter((v): v is string => typeof v === "string") : [];
        const items: VideoItem[] = [];
        for (const id of ids) items.push(await video(id));
        views.push({ kind: "video_playlist", id: b.id, title: b.title, caption: str(d.caption), items });
        break;
      }
      case "embed": {
        const stored = str(d.embed_url);
        const fallback = embedSource(str(d.url));
        const src = stored && isAllowedEmbedUrl(stored) ? stored : (fallback?.src ?? null);
        views.push({
          kind: "embed",
          id: b.id,
          title: b.title,
          caption: str(d.caption),
          src,
          url: str(d.url),
          aspect: str(d.aspect) ?? "16:9",
          provider: str(d.provider) ?? fallback?.provider ?? null,
        });
        break;
      }
      case "rich_text":
        views.push({ kind: "rich_text", id: b.id, title: b.title, html: str(d.html) ?? "" });
        break;
      case "pdf":
      case "document":
      case "presentation":
      case "spreadsheet":
      case "image":
      case "file":
        views.push({
          kind: "file",
          id: b.id,
          title: b.title,
          variant: b.block_type,
          file: b.media_file_id ? (files.get(b.media_file_id) ?? null) : null,
          description: str(d.description),
          caption: str(d.caption),
          alt: str(d.alt),
          allowDownload: d.allow_download !== false,
        });
        break;
      case "link": {
        const url = str(d.url);
        views.push({
          kind: "link",
          id: b.id,
          title: b.title,
          url: url && /^https:\/\//i.test(url) ? url : null,
          label: str(d.label) ?? b.title ?? "Open link",
          description: str(d.description),
        });
        break;
      }
      case "quiz":
        views.push({ kind: "quiz", id: b.id, title: b.title, intro: str(d.intro), quiz: b.quiz_id ? (quizSummaries.get(b.quiz_id) ?? null) : null });
        break;
      case "assignment":
        views.push({
          kind: "assignment",
          id: b.id,
          title: b.title,
          intro: str(d.intro),
          assignment: b.assignment_id ? (assignmentSummaries.get(b.assignment_id) ?? null) : null,
        });
        break;
      case "live_session":
        views.push({
          kind: "live_session",
          id: b.id,
          title: b.title,
          intro: str(d.intro),
          session: b.live_session_id ? (sessions.get(b.live_session_id) ?? null) : null,
        });
        break;
      case "recording": {
        const recId = str(d.meeting_recording_id);
        const rec = recId ? recordings.get(recId) : undefined;
        const assetId = rec?.video_asset_id ?? str(d.video_asset_id);
        views.push({
          kind: "recording",
          id: b.id,
          title: b.title,
          caption: str(d.caption),
          video: assetId ? await video(assetId) : null,
          external:
            rec && !rec.video_asset_id && rec.url && /^https:\/\//i.test(rec.url) ? { url: rec.url, passcode: rec.passcode, title: rec.title } : null,
        });
        break;
      }
      case "resource_collection":
        views.push({
          kind: "resource_collection",
          id: b.id,
          title: b.title,
          heading: str(d.heading),
          description: str(d.description),
          resources: resources.map((r) => toResourceItem(r, files)),
        });
        break;
    }
  }
  return views;
}

export interface LessonDetail {
  id: string;
  course_id: string;
  module_id: string;
  title: string;
  summary: string | null;
  lesson_type: string;
  is_preview: boolean;
  is_published: boolean;
  completion_rule: OutlineLesson["completionRule"];
  duration_minutes: number | null;
  course_modules: { is_published: boolean; title: string } | null;
}

export async function getLessonDetail(lessonId: string): Promise<LessonDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(lessonId)) return null;
  const { data } = await createAdminClient()
    .from("lessons")
    .select("id, course_id, module_id, title, summary, lesson_type, is_preview, is_published, completion_rule, duration_minutes, course_modules(is_published, title)")
    .eq("id", lessonId)
    .maybeSingle();
  return (data as unknown as LessonDetail | null) ?? null;
}

export interface NoteRow {
  id: string;
  body: string;
  position_seconds: number | null;
  created_at: string;
  updated_at: string;
}

export interface BookmarkRow {
  id: string;
  label: string | null;
  position_seconds: number | null;
  created_at: string;
}

/** The learner's own notes and bookmarks (RLS: owner only). */
export async function getLessonNotesAndBookmarks(lessonId: string): Promise<{ notes: NoteRow[]; bookmarks: BookmarkRow[] }> {
  const supabase = await createClient();
  const [notes, bookmarks] = await Promise.all([
    supabase
      .from("student_notes")
      .select("id, body, position_seconds, created_at, updated_at")
      .eq("lesson_id", lessonId)
      .order("created_at", { ascending: false }),
    supabase
      .from("bookmarks")
      .select("id, label, position_seconds, created_at")
      .eq("lesson_id", lessonId)
      .order("position_seconds", { ascending: true, nullsFirst: true }),
  ]);
  return { notes: (notes.data ?? []) as NoteRow[], bookmarks: (bookmarks.data ?? []) as BookmarkRow[] };
}

/** Lesson resources for the side panel (RLS: can_view_lesson). */
export async function getLessonResources(lessonId: string, courseId: string): Promise<ResourceItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lesson_resources")
    .select("id, title, description, resource_type, media_file_id, url, is_downloadable, sort_order")
    .eq("lesson_id", lessonId)
    .order("sort_order");
  const rows = (data ?? []) as ResourceRow[];
  const files = await courseFileMeta(rows.map((r) => r.media_file_id).filter(Boolean) as string[], courseId);
  return rows.map((r) => toResourceItem(r, files));
}
