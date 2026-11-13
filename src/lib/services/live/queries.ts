import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTeacherCourses } from "@/lib/services/teacher-analytics";
import type { SessionUser } from "@/lib/auth/session";
import type { LiveProvider, LiveSessionRow } from "./types";

/**
 * Read models for the live-class management screens. Instructors are scoped
 * to their assigned courses; admins see every course.
 */

export type SessionTab = "upcoming" | "past" | "canceled";

export interface SessionListRow extends LiveSessionRow {
  course_title: string;
  host_name: string | null;
  invited: number;
  recordings: number;
}

export async function scopedCourses(user: SessionUser, area: "teach" | "admin"): Promise<{ id: string; title: string }[]> {
  if (area === "admin") {
    const { data } = await createAdminClient()
      .from("courses")
      .select("id, title")
      .in("status", ["draft", "in_review", "published", "unpublished"])
      .order("title");
    return (data ?? []) as { id: string; title: string }[];
  }
  return (await getTeacherCourses(user.id)).filter((c) => c.status !== "archived").map((c) => ({ id: c.id, title: c.title }));
}

export async function listSessions(
  user: SessionUser,
  area: "teach" | "admin",
  params: { tab: SessionTab; courseId?: string; provider?: string; q?: string; from: number; to: number },
): Promise<{ rows: SessionListRow[]; total: number; courses: { id: string; title: string }[] }> {
  const courses = await scopedCourses(user, area);
  let ids = courses.map((c) => c.id);
  if (params.courseId) ids = ids.filter((id) => id === params.courseId);
  if (area === "teach" && !ids.length) return { rows: [], total: 0, courses };

  const admin = createAdminClient();
  const now = new Date().toISOString();
  let query = admin.from("live_sessions").select("*", { count: "exact" });
  if (area === "teach" || params.courseId) query = query.in("course_id", ids);
  if (params.provider) query = query.eq("provider", params.provider);
  if (params.q) query = query.ilike("title", `%${params.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
  if (params.tab === "canceled") query = query.eq("status", "canceled").order("starts_at", { ascending: false });
  else if (params.tab === "upcoming") {
    // Scheduled or currently running.
    query = query.in("status", ["scheduled", "live"]).order("starts_at", { ascending: true });
  } else {
    query = query.eq("status", "completed").lte("starts_at", now).order("starts_at", { ascending: false });
  }
  const { data, count } = await query.range(params.from, params.to);
  const sessions = (data ?? []) as LiveSessionRow[];

  const sessionIds = sessions.map((s) => s.id);
  const hostIds = [...new Set(sessions.map((s) => s.host_id).filter(Boolean))] as string[];
  const [attendees, recordings, hosts] = await Promise.all([
    sessionIds.length ? admin.from("live_session_attendees").select("session_id").in("session_id", sessionIds) : Promise.resolve({ data: [] }),
    sessionIds.length ? admin.from("meeting_recordings").select("session_id").in("session_id", sessionIds) : Promise.resolve({ data: [] }),
    hostIds.length ? admin.from("profiles").select("id, full_name").in("id", hostIds) : Promise.resolve({ data: [] }),
  ]);
  const countBy = (rows: { session_id: string }[]) => rows.reduce((m, r) => m.set(r.session_id, (m.get(r.session_id) ?? 0) + 1), new Map<string, number>());
  const invited = countBy((attendees.data ?? []) as { session_id: string }[]);
  const recs = countBy((recordings.data ?? []) as { session_id: string }[]);
  const hostName = new Map(((hosts.data ?? []) as { id: string; full_name: string }[]).map((h) => [h.id, h.full_name]));
  const courseTitle = new Map(courses.map((c) => [c.id, c.title]));

  // Admins may see sessions of archived courses not in the scoped list.
  const missing = [...new Set(sessions.map((s) => s.course_id).filter((id) => !courseTitle.has(id)))];
  if (missing.length) {
    const { data: extra } = await admin.from("courses").select("id, title").in("id", missing);
    for (const c of (extra ?? []) as { id: string; title: string }[]) courseTitle.set(c.id, c.title);
  }

  return {
    total: count ?? 0,
    courses,
    rows: sessions.map((s) => ({
      ...s,
      course_title: courseTitle.get(s.course_id) ?? "",
      host_name: s.host_id ? hostName.get(s.host_id) ?? null : null,
      invited: invited.get(s.id) ?? 0,
      recordings: recs.get(s.id) ?? 0,
    })),
  };
}

export interface SessionDetail {
  session: LiveSessionRow;
  course: { id: string; title: string; slug: string };
  hostName: string | null;
  attendees: { user_id: string; name: string; email: string | null; rsvp: string | null; invited_at: string }[];
  attendance: {
    id: string;
    user_id: string | null;
    participant_name: string | null;
    participant_email: string | null;
    joined_at: string | null;
    left_at: string | null;
    duration_seconds: number | null;
    source: "provider" | "manual" | "join_click";
  }[];
  recordings: {
    id: string;
    provider: LiveProvider | "video_asset";
    title: string | null;
    url: string | null;
    passcode: string | null;
    duration_seconds: number | null;
    recorded_at: string | null;
    is_visible: boolean;
    external_id: string | null;
  }[];
  resources: { id: string; title: string; url: string | null; media_file_id: string | null; file_name: string | null; created_at: string }[];
}

export async function getSessionDetail(sessionId: string): Promise<SessionDetail | null> {
  const admin = createAdminClient();
  const { data: session } = await admin.from("live_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (!session) return null;
  const s = session as LiveSessionRow;
  const [courseRes, hostRes, attendeesRes, attendanceRes, recordingsRes, resourcesRes] = await Promise.all([
    admin.from("courses").select("id, title, slug").eq("id", s.course_id).single(),
    s.host_id ? admin.from("profiles").select("full_name").eq("id", s.host_id).maybeSingle() : Promise.resolve({ data: null }),
    admin.from("live_session_attendees").select("user_id, rsvp, invited_at, profiles!inner(full_name, display_name)").eq("session_id", s.id),
    admin.from("live_session_attendance").select("*").eq("session_id", s.id).order("joined_at", { ascending: true, nullsFirst: false }),
    admin.from("meeting_recordings").select("*").eq("session_id", s.id).order("created_at", { ascending: true }),
    admin.from("live_session_resources").select("id, title, url, media_file_id, created_at, media_files(file_name)").eq("session_id", s.id).order("created_at"),
  ]);
  const attendees = (attendeesRes.data ?? []) as unknown as {
    user_id: string;
    rsvp: string | null;
    invited_at: string;
    profiles: { full_name: string; display_name: string | null };
  }[];
  const emails = new Map<string, string>();
  if (attendees.length) {
    const { data } = await admin.from("profile_private").select("user_id, email").in("user_id", attendees.map((a) => a.user_id));
    for (const p of (data ?? []) as { user_id: string; email: string }[]) emails.set(p.user_id, p.email);
  }
  return {
    session: s,
    course: courseRes.data as SessionDetail["course"],
    hostName: (hostRes.data as { full_name: string } | null)?.full_name ?? null,
    attendees: attendees
      .map((a) => ({
        user_id: a.user_id,
        name: a.profiles.full_name || a.profiles.display_name || "Student",
        email: emails.get(a.user_id) ?? null,
        rsvp: a.rsvp,
        invited_at: a.invited_at,
      }))
      .sort((x, y) => x.name.localeCompare(y.name)),
    attendance: (attendanceRes.data ?? []) as SessionDetail["attendance"],
    recordings: (recordingsRes.data ?? []) as SessionDetail["recordings"],
    resources: ((resourcesRes.data ?? []) as unknown as {
      id: string;
      title: string;
      url: string | null;
      media_file_id: string | null;
      created_at: string;
      media_files: { file_name: string } | null;
    }[]).map((r) => ({ id: r.id, title: r.title, url: r.url, media_file_id: r.media_file_id, file_name: r.media_files?.file_name ?? null, created_at: r.created_at })),
  };
}
