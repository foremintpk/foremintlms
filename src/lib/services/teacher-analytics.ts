import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { escapeLike } from "@/lib/list-params";
import type { SessionUser } from "@/lib/auth/session";

type RpcResponse<T> = { data: T | null; error: { message: string } | null };
type Rpcable = { rpc: unknown };

/**
 * Calls the teacher_* analytics functions (migration 20261114104001). Typed
 * locally so it compiles whether or not the generated Database types include
 * them yet.
 */
function teacherRpc<T>(client: Rpcable, fn: string, args: Record<string, unknown>): Promise<RpcResponse<T>> {
  return (client.rpc as (fn: string, args: Record<string, unknown>) => Promise<RpcResponse<T>>).call(client, fn, args);
}

/**
 * Data for the instructor workspace. Every query is scoped to the courses the
 * instructor is assigned to (course_instructors). Aggregates go through
 * SECURITY INVOKER RPCs with the user's own client, so RLS applies too.
 * No revenue or payment data is ever read here.
 */

export interface TeacherCourse {
  id: string;
  title: string;
  slug: string;
  status: string;
  thumbnail_url: string | null;
  role: "lead" | "assistant";
  can_edit: boolean;
}

export const getTeacherCourses = cache(async (userId: string): Promise<TeacherCourse[]> => {
  const { data } = await createAdminClient()
    .from("course_instructors")
    .select("role, can_edit, courses!inner(id, title, slug, status, thumbnail_url)")
    .eq("user_id", userId);
  return ((data ?? []) as unknown as { role: "lead" | "assistant"; can_edit: boolean; courses: Omit<TeacherCourse, "role" | "can_edit"> }[])
    .map((row) => ({ ...row.courses, role: row.role, can_edit: row.can_edit }))
    .sort((a, b) => a.title.localeCompare(b.title));
});

export async function getTeacherCourseIds(userId: string): Promise<string[]> {
  return (await getTeacherCourses(userId)).map((c) => c.id);
}

/** Throws a 404-style null when the course isn't assigned to this instructor. */
export async function assertTeachesCourse(userId: string, courseId: string): Promise<TeacherCourse | null> {
  return (await getTeacherCourses(userId)).find((c) => c.id === courseId) ?? null;
}

export interface CourseCompletion {
  course_id: string;
  enrollments: number;
  completed: number;
  avg_progress: number;
}

async function courseCompletion(courseIds: string[], from?: string | null, to?: string | null): Promise<CourseCompletion[]> {
  if (!courseIds.length) return [];
  const supabase = await createClient();
  const { data, error } = await teacherRpc<CourseCompletion[]>(supabase, "teacher_course_completion", {
    p_course_ids: courseIds,
    p_from: from ?? null,
    p_to: to ?? null,
  });
  if (error) throw new Error(`teacher_course_completion failed: ${error.message}`);
  return (data ?? []).map((r) => ({
    course_id: r.course_id,
    enrollments: Number(r.enrollments),
    completed: Number(r.completed),
    avg_progress: Number(r.avg_progress ?? 0),
  }));
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardSession {
  id: string;
  title: string;
  starts_at: string;
  duration_minutes: number;
  provider: string;
  course_id: string;
  join_url: string | null;
}

export interface DashboardConversation {
  id: string;
  otherName: string;
  preview: string | null;
  last_message_at: string | null;
  unread: boolean;
}

export interface TeacherDashboard {
  courses: (TeacherCourse & { enrollments: number; completed: number; avgProgress: number })[];
  studentCount: number;
  pendingSubmissions: number;
  pendingQuizReviews: number;
  unansweredQuestions: number;
  upcomingSessions: DashboardSession[];
  conversations: DashboardConversation[];
  notifications: { id: string; title: string; body: string | null; url: string | null; created_at: string; read_at: string | null }[];
}

export async function getTeacherDashboard(user: SessionUser): Promise<TeacherDashboard> {
  const courses = await getTeacherCourses(user.id);
  const ids = courses.map((c) => c.id);
  const admin = createAdminClient();
  const supabase = await createClient();

  const empty = { count: 0 };
  const [completion, studentCountRes, subs, attempts, questions, sessions, participants, notifications] = await Promise.all([
    courseCompletion(ids),
    ids.length ? teacherRpc<number>(supabase, "teacher_student_count", { p_course_ids: ids }) : Promise.resolve({ data: 0 }),
    ids.length
      ? admin.from("assignment_submissions").select("id", { count: "exact", head: true }).in("course_id", ids).in("status", ["submitted", "under_review"])
      : Promise.resolve(empty),
    ids.length
      ? admin.from("quiz_attempts").select("id", { count: "exact", head: true }).in("course_id", ids).eq("status", "needs_review")
      : Promise.resolve(empty),
    ids.length
      ? admin
          .from("course_discussions")
          .select("id", { count: "exact", head: true })
          .in("course_id", ids)
          .eq("kind", "question")
          .eq("is_resolved", false)
          .eq("reply_count", 0)
          .eq("status", "visible")
      : Promise.resolve(empty),
    ids.length
      ? admin
          .from("live_sessions")
          .select("id, title, starts_at, duration_minutes, provider, course_id, join_url")
          .in("course_id", ids)
          .in("status", ["scheduled", "live"])
          .gte("starts_at", new Date(Date.now() - 3 * 3600_000).toISOString())
          .order("starts_at", { ascending: true })
          .limit(5)
      : Promise.resolve({ data: [] }),
    admin
      .from("conversation_participants")
      .select("conversation_id, last_read_at, conversations!inner(id, last_message_at)")
      .eq("user_id", user.id)
      .not("conversations.last_message_at", "is", null)
      .order("last_message_at", { ascending: false, referencedTable: "conversations" })
      .limit(5),
    admin
      .from("notifications")
      .select("id, title, body, url, created_at, read_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const byCourse = new Map(completion.map((c) => [c.course_id, c]));

  const convRows = ((participants.data ?? []) as unknown as {
    conversation_id: string;
    last_read_at: string | null;
    conversations: { id: string; last_message_at: string | null };
  }[]).sort((a, b) => (b.conversations.last_message_at ?? "").localeCompare(a.conversations.last_message_at ?? ""));
  const convIds = convRows.map((r) => r.conversation_id);
  let conversations: DashboardConversation[] = [];
  if (convIds.length) {
    const [{ data: others }, { data: messages }] = await Promise.all([
      admin
        .from("conversation_participants")
        .select("conversation_id, profiles!inner(full_name, display_name)")
        .in("conversation_id", convIds)
        .neq("user_id", user.id),
      admin
        .from("messages")
        .select("conversation_id, body, created_at")
        .in("conversation_id", convIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    const nameOf = new Map<string, string>();
    for (const o of (others ?? []) as unknown as { conversation_id: string; profiles: { full_name: string; display_name: string | null } }[]) {
      if (!nameOf.has(o.conversation_id)) nameOf.set(o.conversation_id, o.profiles.display_name || o.profiles.full_name || "Student");
    }
    const previewOf = new Map<string, string>();
    for (const m of (messages ?? []) as { conversation_id: string; body: string }[]) {
      if (!previewOf.has(m.conversation_id)) previewOf.set(m.conversation_id, m.body.slice(0, 120));
    }
    conversations = convRows.map((r) => ({
      id: r.conversation_id,
      otherName: nameOf.get(r.conversation_id) ?? "Conversation",
      preview: previewOf.get(r.conversation_id) ?? null,
      last_message_at: r.conversations.last_message_at,
      unread: Boolean(r.conversations.last_message_at && (!r.last_read_at || r.conversations.last_message_at > r.last_read_at)),
    }));
  }

  return {
    courses: courses.map((c) => {
      const stats = byCourse.get(c.id);
      return { ...c, enrollments: stats?.enrollments ?? 0, completed: stats?.completed ?? 0, avgProgress: stats?.avg_progress ?? 0 };
    }),
    studentCount: Number((studentCountRes as { data: unknown }).data ?? 0),
    pendingSubmissions: subs.count ?? 0,
    pendingQuizReviews: attempts.count ?? 0,
    unansweredQuestions: questions.count ?? 0,
    upcomingSessions: (sessions.data ?? []) as DashboardSession[],
    conversations,
    notifications: (notifications.data ?? []) as TeacherDashboard["notifications"],
  };
}

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

export interface StudentListRow {
  enrollment_id: string;
  user_id: string;
  course_id: string;
  course_title: string;
  full_name: string;
  avatar_url: string | null;
  email: string | null;
  status: string;
  progress_percent: number;
  enrolled_at: string;
  last_accessed_at: string | null;
}

export async function listTeacherStudents(
  user: SessionUser,
  params: { q: string; courseId?: string; status?: string; progress?: string; from: number; to: number },
): Promise<{ rows: StudentListRow[]; total: number }> {
  const courses = await getTeacherCourses(user.id);
  let ids = courses.map((c) => c.id);
  if (params.courseId) ids = ids.filter((id) => id === params.courseId);
  if (!ids.length) return { rows: [], total: 0 };
  const admin = createAdminClient();

  // Search by name or email among students of these courses only.
  let userFilter: string[] | null = null;
  if (params.q) {
    const term = `%${escapeLike(params.q)}%`;
    const { data: enrolled } = await admin.from("enrollments").select("user_id").in("course_id", ids).limit(5000);
    const pool = [...new Set((enrolled ?? []).map((e: { user_id: string }) => e.user_id))];
    if (!pool.length) return { rows: [], total: 0 };
    const [byName, byEmail] = await Promise.all([
      admin.from("profiles").select("id").in("id", pool).or(`full_name.ilike.${term},display_name.ilike.${term}`),
      admin.from("profile_private").select("user_id").in("user_id", pool).ilike("email", term),
    ]);
    userFilter = [
      ...new Set([
        ...(byName.data ?? []).map((r: { id: string }) => r.id),
        ...(byEmail.data ?? []).map((r: { user_id: string }) => r.user_id),
      ]),
    ];
    if (!userFilter.length) return { rows: [], total: 0 };
  }

  let query = admin
    .from("enrollments")
    .select("id, user_id, course_id, status, progress_percent, enrolled_at, last_accessed_at, profiles!inner(full_name, display_name, avatar_url)", { count: "exact" })
    .in("course_id", ids);
  if (userFilter) query = query.in("user_id", userFilter);
  if (params.status) query = query.eq("status", params.status);
  if (params.progress === "not_started") query = query.eq("progress_percent", 0);
  if (params.progress === "in_progress") query = query.gt("progress_percent", 0).lt("progress_percent", 100);
  if (params.progress === "finished") query = query.gte("progress_percent", 100);
  const { data, count } = await query.order("last_accessed_at", { ascending: false, nullsFirst: false }).range(params.from, params.to);

  const rows = (data ?? []) as unknown as {
    id: string;
    user_id: string;
    course_id: string;
    status: string;
    progress_percent: number;
    enrolled_at: string;
    last_accessed_at: string | null;
    profiles: { full_name: string; display_name: string | null; avatar_url: string | null };
  }[];
  const emails = new Map<string, string>();
  if (rows.length) {
    const { data: priv } = await admin.from("profile_private").select("user_id, email").in("user_id", [...new Set(rows.map((r) => r.user_id))]);
    for (const p of (priv ?? []) as { user_id: string; email: string }[]) emails.set(p.user_id, p.email);
  }
  const titleOf = new Map(courses.map((c) => [c.id, c.title]));
  return {
    total: count ?? 0,
    rows: rows.map((r) => ({
      enrollment_id: r.id,
      user_id: r.user_id,
      course_id: r.course_id,
      course_title: titleOf.get(r.course_id) ?? "",
      full_name: r.profiles.full_name || r.profiles.display_name || "Student",
      avatar_url: r.profiles.avatar_url,
      email: emails.get(r.user_id) ?? null,
      status: r.status,
      progress_percent: Number(r.progress_percent),
      enrolled_at: r.enrolled_at,
      last_accessed_at: r.last_accessed_at,
    })),
  };
}

export interface StudentCourseDetail {
  course: TeacherCourse;
  enrollment: { status: string; progress_percent: number; enrolled_at: string; completed_at: string | null; last_accessed_at: string | null };
  lessonsTotal: number;
  lessonsCompleted: number;
  quizzes: { quiz_id: string; title: string; attempts: number; best_percent: number | null; passed: boolean; awaiting_review: boolean }[];
  assignments: { submission_id: string; assignment_id: string; title: string; status: string; grade_points: number | null; max_points: number; is_late: boolean; submitted_at: string }[];
}

export interface StudentDetail {
  id: string;
  full_name: string;
  avatar_url: string | null;
  headline: string | null;
  timezone: string;
  email: string | null;
  courses: StudentCourseDetail[];
  activity: { at: string; kind: "lesson" | "quiz" | "assignment"; label: string; course_title: string }[];
}

export async function getStudentDetail(user: SessionUser, studentId: string): Promise<StudentDetail | null> {
  const courses = await getTeacherCourses(user.id);
  const ids = courses.map((c) => c.id);
  if (!ids.length) return null;
  const admin = createAdminClient();
  const { data: enrollments } = await admin
    .from("enrollments")
    .select("course_id, status, progress_percent, enrolled_at, completed_at, last_accessed_at")
    .eq("user_id", studentId)
    .in("course_id", ids);
  if (!enrollments?.length) return null; // not one of this instructor's students

  const studentCourseIds = (enrollments as { course_id: string }[]).map((e) => e.course_id);
  const [profileRes, privRes, lessonsRes, progressRes, attemptsRes, submissionsRes, quizzesRes, assignmentsRes] = await Promise.all([
    admin.from("profiles").select("full_name, display_name, avatar_url, headline, timezone").eq("id", studentId).maybeSingle(),
    admin.from("profile_private").select("email").eq("user_id", studentId).maybeSingle(),
    admin.from("lessons").select("id, course_id, title, is_published, course_modules!inner(is_published)").in("course_id", studentCourseIds),
    admin
      .from("lesson_progress")
      .select("lesson_id, course_id, status, last_viewed_at, completed_at")
      .eq("user_id", studentId)
      .in("course_id", studentCourseIds)
      .order("last_viewed_at", { ascending: false }),
    admin
      .from("quiz_attempts")
      .select("quiz_id, course_id, status, percent, passed, submitted_at")
      .eq("user_id", studentId)
      .in("course_id", studentCourseIds)
      .order("submitted_at", { ascending: false, nullsFirst: false }),
    admin
      .from("assignment_submissions")
      .select("id, assignment_id, course_id, status, grade_points, is_late, submitted_at, attempt_number")
      .eq("user_id", studentId)
      .in("course_id", studentCourseIds)
      .order("submitted_at", { ascending: false }),
    admin.from("quizzes").select("id, title, course_id").in("course_id", studentCourseIds).neq("status", "archived"),
    admin.from("assignments").select("id, title, course_id, max_points").in("course_id", studentCourseIds).neq("status", "archived"),
  ]);
  const profile = profileRes.data as { full_name: string; display_name: string | null; avatar_url: string | null; headline: string | null; timezone: string } | null;
  if (!profile) return null;

  const lessons = ((lessonsRes.data ?? []) as unknown as { id: string; course_id: string; title: string; is_published: boolean; course_modules: { is_published: boolean } }[]).filter(
    (l) => l.is_published && l.course_modules.is_published,
  );
  const lessonTitle = new Map(lessons.map((l) => [l.id, l.title]));
  const progress = (progressRes.data ?? []) as { lesson_id: string; course_id: string; status: string; last_viewed_at: string; completed_at: string | null }[];
  const attempts = (attemptsRes.data ?? []) as { quiz_id: string; course_id: string; status: string; percent: number | null; passed: boolean | null; submitted_at: string | null }[];
  const submissions = (submissionsRes.data ?? []) as { id: string; assignment_id: string; course_id: string; status: string; grade_points: number | null; is_late: boolean; submitted_at: string }[];
  const quizzes = (quizzesRes.data ?? []) as { id: string; title: string; course_id: string }[];
  const assignments = (assignmentsRes.data ?? []) as { id: string; title: string; course_id: string; max_points: number }[];
  const quizTitle = new Map(quizzes.map((q) => [q.id, q.title]));
  const assignment = new Map(assignments.map((a) => [a.id, a]));
  const titleOf = new Map(courses.map((c) => [c.id, c.title]));

  const detailCourses: StudentCourseDetail[] = (enrollments as unknown as (StudentCourseDetail["enrollment"] & { course_id: string })[]).map((enrollment) => {
    const course = courses.find((c) => c.id === enrollment.course_id)!;
    const courseLessons = lessons.filter((l) => l.course_id === course.id);
    const lessonIds = new Set(courseLessons.map((l) => l.id));
    const quizStats = quizzes
      .filter((q) => q.course_id === course.id)
      .map((q) => {
        const mine = attempts.filter((a) => a.quiz_id === q.id && a.status !== "in_progress");
        const graded = mine.filter((a) => a.percent !== null).map((a) => Number(a.percent));
        return {
          quiz_id: q.id,
          title: q.title,
          attempts: mine.length,
          best_percent: graded.length ? Math.max(...graded) : null,
          passed: mine.some((a) => a.passed === true),
          awaiting_review: mine.some((a) => a.status === "needs_review"),
        };
      });
    // Latest submission per assignment.
    const latest = new Map<string, (typeof submissions)[number]>();
    for (const s of submissions.filter((s) => s.course_id === course.id)) if (!latest.has(s.assignment_id)) latest.set(s.assignment_id, s);
    return {
      course,
      enrollment: {
        status: enrollment.status,
        progress_percent: Number(enrollment.progress_percent),
        enrolled_at: enrollment.enrolled_at,
        completed_at: enrollment.completed_at,
        last_accessed_at: enrollment.last_accessed_at,
      },
      lessonsTotal: courseLessons.length,
      lessonsCompleted: progress.filter((p) => p.status === "completed" && lessonIds.has(p.lesson_id)).length,
      quizzes: quizStats,
      assignments: [...latest.values()].map((s) => ({
        submission_id: s.id,
        assignment_id: s.assignment_id,
        title: assignment.get(s.assignment_id)?.title ?? "Assignment",
        status: s.status,
        grade_points: s.grade_points === null ? null : Number(s.grade_points),
        max_points: Number(assignment.get(s.assignment_id)?.max_points ?? 0),
        is_late: s.is_late,
        submitted_at: s.submitted_at,
      })),
    };
  });

  const activity: StudentDetail["activity"] = [
    ...progress.slice(0, 15).map((p) => ({
      at: p.completed_at ?? p.last_viewed_at,
      kind: "lesson" as const,
      label: `${p.status === "completed" ? "Completed" : "Viewed"} “${lessonTitle.get(p.lesson_id) ?? "lesson"}”`,
      course_title: titleOf.get(p.course_id) ?? "",
    })),
    ...attempts
      .filter((a) => a.submitted_at)
      .slice(0, 10)
      .map((a) => ({
        at: a.submitted_at!,
        kind: "quiz" as const,
        label: `Submitted quiz “${quizTitle.get(a.quiz_id) ?? "quiz"}”${a.percent !== null ? ` · ${Number(a.percent)}%` : ""}`,
        course_title: titleOf.get(a.course_id) ?? "",
      })),
    ...submissions.slice(0, 10).map((s) => ({
      at: s.submitted_at,
      kind: "assignment" as const,
      label: `Submitted “${assignment.get(s.assignment_id)?.title ?? "assignment"}”`,
      course_title: titleOf.get(s.course_id) ?? "",
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 20);

  return {
    id: studentId,
    full_name: profile.full_name || profile.display_name || "Student",
    avatar_url: profile.avatar_url,
    headline: profile.headline,
    timezone: profile.timezone,
    email: (privRes.data as { email: string } | null)?.email ?? null,
    courses: detailCourses,
    activity,
  };
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export interface AnalyticsRange {
  from: Date;
  to: Date;
  bucket: "day" | "week";
}

export interface TeacherAnalytics {
  courses: TeacherCourse[];
  selectedCourseIds: string[];
  enrollmentSeries: { date: string; enrollments: number }[];
  totalEnrollments: number;
  completion: { course_id: string; title: string; enrollments: number; completed: number; rate: number; avgProgress: number }[];
  dropoff: { courseId: string; courseTitle: string; lessons: { position: number; title: string; module: string; completed: number; enrolled: number; percent: number }[] } | null;
  quizzes: { quiz_id: string; course_title: string; title: string; attempts: number; students: number; avg_percent: number | null; pass_rate: number | null; awaiting_review: number }[];
  assignments: {
    assignment_id: string;
    course_title: string;
    title: string;
    max_points: number;
    submissions: number;
    pending: number;
    graded: number;
    resubmission_requested: number;
    late: number;
    avg_grade_percent: number | null;
  }[];
}

export async function getTeacherAnalytics(user: SessionUser, range: AnalyticsRange, courseId?: string): Promise<TeacherAnalytics> {
  const courses = await getTeacherCourses(user.id);
  const selected = courseId && courses.some((c) => c.id === courseId) ? [courseId] : courses.map((c) => c.id);
  const titleOf = new Map(courses.map((c) => [c.id, c.title]));
  if (!selected.length) {
    return { courses, selectedCourseIds: [], enrollmentSeries: [], totalEnrollments: 0, completion: [], dropoff: null, quizzes: [], assignments: [] };
  }
  const supabase = await createClient();
  const from = range.from.toISOString();
  const to = range.to.toISOString();
  const dropoffCourse = selected.length === 1 ? selected[0] : null;

  const [series, completion, quizzes, assignments, dropoff] = await Promise.all([
    teacherRpc<unknown[]>(supabase, "teacher_enrollment_series", { p_course_ids: selected, p_from: from, p_to: to, p_bucket: range.bucket }),
    courseCompletion(selected, from, to),
    teacherRpc<unknown[]>(supabase, "teacher_quiz_stats", { p_course_ids: selected, p_from: from, p_to: to }),
    teacherRpc<unknown[]>(supabase, "teacher_assignment_stats", { p_course_ids: selected, p_from: from, p_to: to }),
    dropoffCourse
      ? teacherRpc<unknown[]>(supabase, "teacher_lesson_dropoff", { p_course_id: dropoffCourse })
      : Promise.resolve<RpcResponse<unknown[]>>({ data: null, error: null }),
  ]);
  for (const r of [series, quizzes, assignments, dropoff]) {
    if (r.error) throw new Error(`teacher analytics query failed: ${r.error.message}`);
  }

  const enrollmentSeries = ((series.data ?? []) as unknown as { bucket_start: string; enrollments: number }[]).map((r) => ({
    date: r.bucket_start,
    enrollments: Number(r.enrollments),
  }));

  return {
    courses,
    selectedCourseIds: selected,
    enrollmentSeries,
    totalEnrollments: enrollmentSeries.reduce((s, r) => s + r.enrollments, 0),
    completion: completion
      .map((c) => ({
        course_id: c.course_id,
        title: titleOf.get(c.course_id) ?? "",
        enrollments: c.enrollments,
        completed: c.completed,
        rate: c.enrollments ? Math.round((c.completed / c.enrollments) * 1000) / 10 : 0,
        avgProgress: c.avg_progress,
      }))
      .sort((a, b) => b.rate - a.rate),
    dropoff: dropoffCourse
      ? {
          courseId: dropoffCourse,
          courseTitle: titleOf.get(dropoffCourse) ?? "",
          lessons: ((dropoff.data ?? []) as unknown as { position: number; lesson_title: string; module_title: string; completed_students: number; enrolled_students: number }[]).map((r) => ({
            position: Number(r.position),
            title: r.lesson_title,
            module: r.module_title,
            completed: Number(r.completed_students),
            enrolled: Number(r.enrolled_students),
            percent: Number(r.enrolled_students) ? Math.round((Number(r.completed_students) / Number(r.enrolled_students)) * 1000) / 10 : 0,
          })),
        }
      : null,
    quizzes: ((quizzes.data ?? []) as unknown as {
      quiz_id: string;
      course_id: string;
      title: string;
      attempts: number;
      students: number;
      avg_percent: number | null;
      pass_rate: number | null;
      awaiting_review: number;
    }[]).map((q) => ({
      quiz_id: q.quiz_id,
      course_title: titleOf.get(q.course_id) ?? "",
      title: q.title,
      attempts: Number(q.attempts),
      students: Number(q.students),
      avg_percent: q.avg_percent === null ? null : Number(q.avg_percent),
      pass_rate: q.pass_rate === null ? null : Number(q.pass_rate),
      awaiting_review: Number(q.awaiting_review),
    })),
    assignments: ((assignments.data ?? []) as unknown as {
      assignment_id: string;
      course_id: string;
      title: string;
      max_points: number;
      submissions: number;
      pending: number;
      graded: number;
      resubmission_requested: number;
      late: number;
      avg_grade_percent: number | null;
    }[]).map((a) => ({
      assignment_id: a.assignment_id,
      course_title: titleOf.get(a.course_id) ?? "",
      title: a.title,
      max_points: Number(a.max_points),
      submissions: Number(a.submissions),
      pending: Number(a.pending),
      graded: Number(a.graded),
      resubmission_requested: Number(a.resubmission_requested),
      late: Number(a.late),
      avg_grade_percent: a.avg_grade_percent === null ? null : Number(a.avg_grade_percent),
    })),
  };
}

// ---------------------------------------------------------------------------
// Review queue
// ---------------------------------------------------------------------------

export interface ReviewQueueItem {
  kind: "submission" | "quiz";
  id: string;
  course_id: string;
  course_title: string;
  title: string;
  student_name: string;
  submitted_at: string | null;
  status: string;
  is_late: boolean;
  attempt_number: number;
}

export async function getReviewQueue(
  user: SessionUser,
  params: { courseId?: string; kind?: "submission" | "quiz"; scope: "pending" | "reviewed" },
): Promise<ReviewQueueItem[]> {
  const courses = await getTeacherCourses(user.id);
  let ids = courses.map((c) => c.id);
  if (params.courseId) ids = ids.filter((id) => id === params.courseId);
  if (!ids.length) return [];
  const admin = createAdminClient();
  const titleOf = new Map(courses.map((c) => [c.id, c.title]));
  const subStatuses = params.scope === "pending" ? ["submitted", "under_review"] : ["graded", "approved", "resubmission_requested"];
  const quizStatuses = params.scope === "pending" ? ["needs_review"] : ["graded"];

  const [subsRes, attemptsRes] = await Promise.all([
    params.kind === "quiz"
      ? Promise.resolve({ data: [] })
      : admin
          .from("assignment_submissions")
          .select("id, course_id, status, is_late, submitted_at, attempt_number, user_id, assignments!inner(title)")
          .in("course_id", ids)
          .in("status", subStatuses)
          .order("submitted_at", { ascending: params.scope === "pending" })
          .limit(200),
    params.kind === "submission"
      ? Promise.resolve({ data: [] })
      : admin
          .from("quiz_attempts")
          .select("id, course_id, status, submitted_at, attempt_number, user_id, graded_by, quizzes!inner(title)")
          .in("course_id", ids)
          .in("status", quizStatuses)
          .order("submitted_at", { ascending: params.scope === "pending" })
          .limit(200),
  ]);
  const subs = (subsRes.data ?? []) as unknown as {
    id: string;
    course_id: string;
    status: string;
    is_late: boolean;
    submitted_at: string;
    attempt_number: number;
    user_id: string;
    assignments: { title: string };
  }[];
  const attempts = ((attemptsRes.data ?? []) as unknown as {
    id: string;
    course_id: string;
    status: string;
    submitted_at: string | null;
    attempt_number: number;
    user_id: string;
    graded_by: string | null;
    quizzes: { title: string };
  }[]).filter((a) => params.scope === "pending" || a.graded_by !== null); // reviewed = manually graded

  const userIds = [...new Set([...subs.map((s) => s.user_id), ...attempts.map((a) => a.user_id)])];
  const names = new Map<string, string>();
  if (userIds.length) {
    const { data } = await admin.from("profiles").select("id, full_name, display_name").in("id", userIds);
    for (const p of (data ?? []) as { id: string; full_name: string; display_name: string | null }[]) names.set(p.id, p.full_name || p.display_name || "Student");
  }

  const items: ReviewQueueItem[] = [
    ...subs.map((s) => ({
      kind: "submission" as const,
      id: s.id,
      course_id: s.course_id,
      course_title: titleOf.get(s.course_id) ?? "",
      title: s.assignments.title,
      student_name: names.get(s.user_id) ?? "Student",
      submitted_at: s.submitted_at,
      status: s.status,
      is_late: s.is_late,
      attempt_number: s.attempt_number,
    })),
    ...attempts.map((a) => ({
      kind: "quiz" as const,
      id: a.id,
      course_id: a.course_id,
      course_title: titleOf.get(a.course_id) ?? "",
      title: a.quizzes.title,
      student_name: names.get(a.user_id) ?? "Student",
      submitted_at: a.submitted_at,
      status: a.status,
      is_late: false,
      attempt_number: a.attempt_number,
    })),
  ];
  return items.sort((a, b) =>
    params.scope === "pending"
      ? (a.submitted_at ?? "").localeCompare(b.submitted_at ?? "")
      : (b.submitted_at ?? "").localeCompare(a.submitted_at ?? ""),
  );
}
