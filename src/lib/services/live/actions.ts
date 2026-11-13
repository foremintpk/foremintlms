"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { assertCourseStaff, assertTeacherOrAdmin } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { fail, ok, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/services/notifications";
import { disconnectProvider } from "./providers";
import {
  cancelLiveSession,
  createLiveSession,
  getLiveSession,
  inviteCourseStudents,
  notifySessionAudience,
  syncSessionArtifacts,
  updateLiveSession,
  type SessionInput,
} from "./sessions";
import { isValidTimeZone, zonedLocalToUtc } from "./time";
import type { LiveSessionRow } from "./types";

const httpsUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => /^https:\/\/[^\s]+$/i.test(v), "Use a full https:// link");

const sessionSchema = z
  .object({
    courseId: z.uuid(),
    title: z.string().trim().min(3, "Give the class a title").max(200),
    description: z.string().trim().max(4000).nullish(),
    provider: z.enum(["zoom", "google_meet", "external"]),
    externalUrl: httpsUrl.nullish().or(z.literal("")),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
    time: z.string().regex(/^\d{2}:\d{2}$/, "Choose a start time"),
    timezone: z.string().refine(isValidTimeZone, "Choose a valid time zone"),
    durationMinutes: z.coerce.number().int().min(5, "At least 5 minutes").max(600, "At most 10 hours"),
    announcement: z.string().trim().max(2000).nullish(),
    notifyStudents: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    if (v.provider === "external" && !v.externalUrl) {
      ctx.addIssue({ code: "custom", path: ["externalUrl"], message: "Add the meeting link students should use" });
    }
  });

function toSessionInput(v: z.infer<typeof sessionSchema>): SessionInput {
  let startsAt: Date;
  try {
    startsAt = zonedLocalToUtc(v.date, v.time, v.timezone);
  } catch {
    throw new UserFacingError("Check the date, time and time zone.");
  }
  return {
    courseId: v.courseId,
    title: v.title,
    description: v.description || null,
    provider: v.provider,
    externalUrl: v.externalUrl || null,
    startsAt,
    durationMinutes: v.durationMinutes,
    timezone: v.timezone,
    announcement: v.announcement || null,
  };
}

async function loadStaffSession(sessionId: string): Promise<{ session: LiveSessionRow; user: Awaited<ReturnType<typeof assertCourseStaff>>["user"] }> {
  const id = z.uuid().parse(sessionId);
  const session = await getLiveSession(id);
  if (!session) throw new UserFacingError("This class no longer exists.");
  const { user } = await assertCourseStaff(session.course_id);
  return { session, user };
}

export async function scheduleLiveSessionAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const parsed = sessionSchema.parse(input);
    const { user } = await assertCourseStaff(parsed.courseId);
    const values = toSessionInput(parsed);
    if (values.startsAt.getTime() < Date.now() - 5 * 60_000) {
      return fail("The start time is in the past.", { time: ["Choose a time in the future"] });
    }
    const session = await createLiveSession(user, values, { notifyStudents: parsed.notifyStudents });
    await audit({
      actor: user,
      action: "live_session.scheduled",
      entityType: "live_session",
      entityId: session.id,
      summary: `Scheduled "${session.title}" (${session.provider})`,
      metadata: { course_id: session.course_id, starts_at: session.starts_at },
    });
    refresh();
    return ok({ id: session.id }, "Class scheduled");
  });
}

export async function updateLiveSessionAction(input: unknown): Promise<ActionResult<{ id: string; warning: string | null }>> {
  return runAction(async () => {
    const raw = z.object({ sessionId: z.uuid() }).passthrough().parse(input);
    const { session, user } = await loadStaffSession(raw.sessionId);
    const parsed = sessionSchema.parse({ ...raw, courseId: session.course_id });
    const { session: updated, syncWarning } = await updateLiveSession(user, session, toSessionInput(parsed), {
      notifyStudents: parsed.notifyStudents,
    });
    await audit({
      actor: user,
      action: "live_session.updated",
      entityType: "live_session",
      entityId: session.id,
      summary: `Updated "${updated.title}"`,
      metadata: { from: session.starts_at, to: updated.starts_at, provider: updated.provider, sync_warning: syncWarning },
    });
    refresh();
    return ok({ id: updated.id, warning: syncWarning }, syncWarning ? "Class saved — the meeting provider wasn't fully updated" : "Class updated");
  });
}

export async function cancelLiveSessionAction(input: { sessionId: string; reason?: string; notifyStudents?: boolean }): Promise<ActionResult<{ warning: string | null }>> {
  return runAction(async () => {
    const { session, user } = await loadStaffSession(input.sessionId);
    const reason = z.string().trim().max(500).optional().parse(input.reason) || null;
    const { syncWarning } = await cancelLiveSession(session, reason, { notifyStudents: input.notifyStudents !== false });
    await audit({
      actor: user,
      action: "live_session.canceled",
      entityType: "live_session",
      entityId: session.id,
      summary: `Cancelled "${session.title}"`,
      metadata: { reason, sync_warning: syncWarning },
    });
    refresh();
    return ok({ warning: syncWarning }, "Class cancelled");
  });
}

export async function inviteStudentsAction(input: { sessionId: string }): Promise<ActionResult<{ invited: number }>> {
  return runAction(async () => {
    const { session } = await loadStaffSession(input.sessionId);
    const fresh = await inviteCourseStudents(session);
    if (fresh.length && session.status === "scheduled") {
      await notifySessionAudience(session, fresh, {
        template: "learning.live_class_scheduled",
        type: "live_scheduled",
        title: `Live class scheduled: ${session.title}`,
        idempotencyKey: `live-scheduled:${session.id}`,
      });
    }
    refresh();
    return ok({ invited: fresh.length }, fresh.length ? `Invited ${fresh.length} new student${fresh.length === 1 ? "" : "s"}` : "Everyone with access is already invited");
  });
}

export async function syncSessionArtifactsAction(input: { sessionId: string }): Promise<ActionResult<{ notes: string[] }>> {
  return runAction(async () => {
    const { session, user } = await loadStaffSession(input.sessionId);
    const result = await syncSessionArtifacts(session);
    await audit({ actor: user, action: "live_session.synced", entityType: "live_session", entityId: session.id, metadata: { ...result } });
    refresh();
    const parts = [
      `${result.recordingsAdded} new recording${result.recordingsAdded === 1 ? "" : "s"}`,
      `${result.attendanceRows} attendance record${result.attendanceRows === 1 ? "" : "s"} (${result.matchedStudents} matched to students)`,
    ];
    return ok({ notes: result.notes }, result.notes.length ? `Synced with notes: ${result.notes[0]}` : `Synced: ${parts.join(", ")}`);
  });
}

const resourceSchema = z
  .object({
    sessionId: z.uuid(),
    title: z.string().trim().min(1, "Give the resource a title").max(200),
    mediaFileId: z.uuid().nullish(),
    url: httpsUrl.nullish().or(z.literal("")),
  })
  .refine((v) => Boolean(v.mediaFileId || v.url), { message: "Upload a file or add a link", path: ["url"] });

export async function addSessionResourceAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const parsed = resourceSchema.parse(input);
    const { session, user } = await loadStaffSession(parsed.sessionId);
    const admin = createAdminClient();
    if (parsed.mediaFileId) {
      const { data: file } = await admin
        .from("media_files")
        .select("id, purpose, course_id, status")
        .eq("id", parsed.mediaFileId)
        .maybeSingle();
      if (!file || file.purpose !== "live_resource" || file.course_id !== session.course_id || file.status !== "ready") {
        throw new UserFacingError("That upload can't be attached to this class.");
      }
    }
    const { data, error } = await admin
      .from("live_session_resources")
      .insert({ session_id: session.id, title: parsed.title, media_file_id: parsed.mediaFileId ?? null, url: parsed.url || null, created_by: user.id })
      .select("id")
      .single();
    if (error || !data) throw new Error(`resource insert failed: ${error?.message}`);
    await audit({ actor: user, action: "live_session.resource_added", entityType: "live_session", entityId: session.id, summary: parsed.title });
    refresh();
    return ok({ id: data.id as string }, "Resource added");
  });
}

export async function removeSessionResourceAction(input: { resourceId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const id = z.uuid().parse(input.resourceId);
    const admin = createAdminClient();
    const { data: resource } = await admin.from("live_session_resources").select("id, session_id, title").eq("id", id).maybeSingle();
    if (!resource) throw new UserFacingError("Resource not found.");
    const { user } = await loadStaffSession(resource.session_id as string);
    await admin.from("live_session_resources").delete().eq("id", id);
    await audit({ actor: user, action: "live_session.resource_removed", entityType: "live_session", entityId: resource.session_id as string, summary: resource.title as string });
    refresh();
    return ok(null, "Resource removed");
  });
}

const recordingSchema = z.object({
  sessionId: z.uuid(),
  title: z.string().trim().min(1, "Give the recording a title").max(200),
  url: httpsUrl,
  passcode: z.string().trim().max(100).nullish(),
});

export async function addRecordingAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const parsed = recordingSchema.parse(input);
    const { session, user } = await loadStaffSession(parsed.sessionId);
    const { data, error } = await createAdminClient()
      .from("meeting_recordings")
      .insert({
        session_id: session.id,
        provider: "external",
        title: parsed.title,
        url: parsed.url,
        passcode: parsed.passcode || null,
        is_visible: true,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`recording insert failed: ${error?.message}`);
    await audit({ actor: user, action: "live_session.recording_added", entityType: "live_session", entityId: session.id, summary: parsed.title });
    refresh();
    return ok({ id: data.id as string }, "Recording added");
  });
}

async function loadRecording(recordingId: string) {
  const id = z.uuid().parse(recordingId);
  const { data } = await createAdminClient().from("meeting_recordings").select("id, session_id, title").eq("id", id).maybeSingle();
  if (!data) throw new UserFacingError("Recording not found.");
  const { session, user } = await loadStaffSession(data.session_id as string);
  return { recording: data as { id: string; session_id: string; title: string | null }, session, user };
}

export async function setRecordingVisibilityAction(input: { recordingId: string; isVisible: boolean }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { recording, user } = await loadRecording(input.recordingId);
    await createAdminClient().from("meeting_recordings").update({ is_visible: Boolean(input.isVisible) }).eq("id", recording.id);
    await audit({
      actor: user,
      action: input.isVisible ? "live_session.recording_shown" : "live_session.recording_hidden",
      entityType: "live_session",
      entityId: recording.session_id,
    });
    refresh();
    return ok(null, input.isVisible ? "Recording visible to students" : "Recording hidden from students");
  });
}

export async function deleteRecordingAction(input: { recordingId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { recording, user } = await loadRecording(input.recordingId);
    await createAdminClient().from("meeting_recordings").delete().eq("id", recording.id);
    await audit({ actor: user, action: "live_session.recording_deleted", entityType: "live_session", entityId: recording.session_id, summary: recording.title ?? undefined });
    refresh();
    return ok(null, "Recording removed");
  });
}

export async function markAttendanceAction(input: { sessionId: string; userId: string; present: boolean }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { session, user } = await loadStaffSession(input.sessionId);
    const studentId = z.uuid().parse(input.userId);
    const admin = createAdminClient();
    const { data: invited } = await admin
      .from("live_session_attendees")
      .select("user_id")
      .eq("session_id", session.id)
      .eq("user_id", studentId)
      .maybeSingle();
    if (!invited) throw new UserFacingError("Only invited students can be marked.");
    if (input.present) {
      const { data: existing } = await admin
        .from("live_session_attendance")
        .select("id")
        .eq("session_id", session.id)
        .eq("user_id", studentId)
        .in("source", ["manual", "join_click"])
        .maybeSingle();
      if (!existing) {
        const { error } = await admin
          .from("live_session_attendance")
          .insert({ session_id: session.id, user_id: studentId, source: "manual", recorded_by: user.id, joined_at: session.starts_at });
        if (error && error.code !== "23505") throw new Error(`attendance insert failed: ${error.message}`);
      }
    } else {
      await admin.from("live_session_attendance").delete().eq("session_id", session.id).eq("user_id", studentId).in("source", ["manual", "join_click"]);
    }
    await audit({
      actor: user,
      action: input.present ? "live_session.attendance_marked" : "live_session.attendance_cleared",
      entityType: "live_session",
      entityId: session.id,
      metadata: { student_id: studentId },
    });
    refresh();
    return ok(null, input.present ? "Marked as attended" : "Attendance removed");
  });
}

export async function saveAnnouncementAction(input: { sessionId: string; announcement: string; notifyStudents: boolean }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { session, user } = await loadStaffSession(input.sessionId);
    const text = z.string().trim().max(2000).parse(input.announcement ?? "");
    await createAdminClient().from("live_sessions").update({ announcement: text || null }).eq("id", session.id);
    if (text && input.notifyStudents && session.status !== "canceled") {
      const { data: attendees } = await createAdminClient().from("live_session_attendees").select("user_id").eq("session_id", session.id);
      await notify(
        ((attendees ?? []) as { user_id: string }[]).map((a) => a.user_id),
        {
          category: "live",
          type: "live_announcement",
          title: `Update for ${session.title}`,
          body: text.slice(0, 300),
          url: "/learn/live",
          data: { session_id: session.id },
        },
      );
    }
    await audit({ actor: user, action: "live_session.announcement_saved", entityType: "live_session", entityId: session.id });
    refresh();
    return ok(null, text ? "Announcement saved" : "Announcement cleared");
  });
}

export async function disconnectMeetingAccountAction(input: { provider: "zoom" | "google_meet" }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertTeacherOrAdmin();
    const provider = z.enum(["zoom", "google_meet"]).parse(input.provider);
    await disconnectProvider(user.id, provider);
    await audit({ actor: user, action: "meeting_account.disconnected", entityType: "meeting_provider_connection", summary: provider });
    refresh();
    return ok(null, provider === "zoom" ? "Zoom disconnected" : "Google Meet disconnected");
  });
}
