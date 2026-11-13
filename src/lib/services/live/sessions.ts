import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/services/notifications";
import { UserFacingError } from "@/lib/actions";
import { appUrl } from "@/lib/env";
import type { SessionUser } from "@/lib/auth/session";
import type { TablesUpdate } from "@/types/database";
import {
  cancelProviderMeeting,
  createProviderMeeting,
  fetchProviderArtifacts,
  getConnection,
  getConnectionById,
  isMeetingProviderConfigured,
  updateProviderMeeting,
} from "./providers";
import { formatInZone } from "./time";
import {
  PROVIDER_LABEL,
  ProviderApiError,
  ProviderAuthError,
  type LiveProvider,
  type LiveSessionRow,
  type MeetingInput,
  type MeetingProviderId,
} from "./types";

const CHUNK = 150;

function chunks<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function getLiveSession(id: string): Promise<LiveSessionRow | null> {
  const { data } = await createAdminClient().from("live_sessions").select("*").eq("id", id).maybeSingle();
  return (data as LiveSessionRow | null) ?? null;
}

/** Students who can currently open the course (active/completed enrollment + live entitlement). */
export async function currentCourseAudience(courseId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data: enrolled } = await admin
    .from("enrollments")
    .select("user_id")
    .eq("course_id", courseId)
    .in("status", ["active", "completed"]);
  const ids = [...new Set((enrolled ?? []).map((e: { user_id: string }) => e.user_id))];
  if (ids.length === 0) return [];
  const now = new Date().toISOString();
  const withAccess = new Set<string>();
  for (const group of chunks(ids)) {
    const { data } = await admin
      .from("course_entitlements")
      .select("user_id")
      .in("user_id", group)
      .eq("status", "active")
      .lte("starts_at", now)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .or(`course_id.eq.${courseId},scope.eq.all_access`);
    for (const row of data ?? []) withAccess.add((row as { user_id: string }).user_id);
  }
  return ids.filter((id) => withAccess.has(id));
}

/** Add every student with current access to the invite list. Returns newly invited user ids. */
export async function inviteCourseStudents(session: Pick<LiveSessionRow, "id" | "course_id">): Promise<string[]> {
  const admin = createAdminClient();
  const audience = await currentCourseAudience(session.course_id);
  if (audience.length === 0) return [];
  const { data: existing } = await admin.from("live_session_attendees").select("user_id").eq("session_id", session.id);
  const already = new Set((existing ?? []).map((r: { user_id: string }) => r.user_id));
  const fresh = audience.filter((id) => !already.has(id));
  for (const group of chunks(fresh)) {
    const { error } = await admin
      .from("live_session_attendees")
      .upsert(group.map((user_id) => ({ session_id: session.id, user_id })), { onConflict: "session_id,user_id", ignoreDuplicates: true });
    if (error) throw new Error(`Inviting students failed: ${error.message}`);
  }
  return fresh;
}

async function courseTitle(courseId: string): Promise<string> {
  const { data } = await createAdminClient().from("courses").select("title").eq("id", courseId).maybeSingle();
  return (data as { title: string } | null)?.title ?? "your course";
}

type SessionEmail = "learning.live_class_scheduled" | "learning.live_class_updated" | "learning.live_class_canceled" | "learning.live_class_reminder";

/**
 * Notify users about a session, formatting the time in each recipient's own
 * time zone (from their profile).
 */
export async function notifySessionAudience(
  session: LiveSessionRow,
  userIds: string[],
  opts: {
    template: SessionEmail;
    type: string;
    title: string;
    body?: string;
    idempotencyKey: string;
    extra?: Record<string, string>;
  },
): Promise<void> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return;
  const admin = createAdminClient();
  const course = await courseTitle(session.course_id);
  const zoneOf = new Map<string, string>();
  for (const group of chunks(ids)) {
    const { data } = await admin.from("profiles").select("id, timezone").in("id", group);
    for (const p of data ?? []) zoneOf.set((p as { id: string }).id, (p as { timezone: string }).timezone || "UTC");
  }
  const byZone = new Map<string, string[]>();
  for (const id of ids) {
    const zone = zoneOf.get(id) ?? "UTC";
    byZone.set(zone, [...(byZone.get(zone) ?? []), id]);
  }
  for (const [zone, members] of byZone) {
    let sessionTime: string;
    try {
      sessionTime = formatInZone(session.starts_at, zone);
    } catch {
      sessionTime = formatInZone(session.starts_at, "UTC");
    }
    await notify(members, {
      category: "live",
      type: opts.type,
      title: opts.title,
      body: opts.body ?? `${course} · ${sessionTime}`,
      url: "/learn/live",
      data: { session_id: session.id, course_id: session.course_id },
      email: {
        templateKey: opts.template,
        idempotencyKey: opts.idempotencyKey,
        payload: {
          session_title: session.title,
          course_title: course,
          session_time: sessionTime,
          provider_name: PROVIDER_LABEL[session.provider],
          session_description: session.description ?? "",
          cta_url: appUrl("/learn/live"),
          ...opts.extra,
        },
      },
    });
  }
}

export interface SessionInput {
  courseId: string;
  title: string;
  description: string | null;
  provider: LiveProvider;
  externalUrl: string | null;
  startsAt: Date;
  durationMinutes: number;
  timezone: string;
  announcement: string | null;
}

function meetingInput(input: SessionInput): MeetingInput {
  return {
    title: input.title,
    description: input.description,
    startsAt: input.startsAt,
    durationMinutes: input.durationMinutes,
    timezone: input.timezone,
  };
}

function providerFailure(provider: MeetingProviderId, err: unknown): UserFacingError {
  if (err instanceof ProviderAuthError) return new UserFacingError(err.message);
  if (err instanceof ProviderApiError) {
    return new UserFacingError(`${PROVIDER_LABEL[provider]} couldn't create the meeting (${err.message}). Try again, or use an external meeting link.`);
  }
  return new UserFacingError(`${PROVIDER_LABEL[provider]} couldn't create the meeting. Try again, or use an external meeting link.`);
}

async function requireHostConnection(actor: SessionUser, provider: MeetingProviderId) {
  if (!(await isMeetingProviderConfigured(provider))) {
    throw new UserFacingError(`${PROVIDER_LABEL[provider]} isn't set up on this platform yet. Use an external meeting link instead.`);
  }
  const connection = await getConnection(actor.id, provider);
  if (!connection || connection.status === "revoked") {
    throw new UserFacingError(`Connect your ${PROVIDER_LABEL[provider]} account in Settings → Meeting accounts, or use an external meeting link.`);
  }
  return connection;
}

/** Create the provider meeting (or accept the external link), store the session, invite and notify. */
export async function createLiveSession(actor: SessionUser, input: SessionInput, opts: { notifyStudents: boolean }): Promise<LiveSessionRow> {
  let meeting: { externalMeetingId: string | null; joinUrl: string; passcode: string | null; connectionId: string | null };
  if (input.provider === "external") {
    if (!input.externalUrl) throw new UserFacingError("Add the meeting link students should use.");
    meeting = { externalMeetingId: null, joinUrl: input.externalUrl, passcode: null, connectionId: null };
  } else {
    const connection = await requireHostConnection(actor, input.provider);
    try {
      const created = await createProviderMeeting(connection, meetingInput(input));
      meeting = { ...created, connectionId: connection.id };
    } catch (err) {
      throw providerFailure(input.provider, err);
    }
  }

  const { data, error } = await createAdminClient()
    .from("live_sessions")
    .insert({
      course_id: input.courseId,
      host_id: actor.id,
      title: input.title,
      description: input.description,
      provider: input.provider,
      provider_connection_id: meeting.connectionId,
      external_meeting_id: meeting.externalMeetingId,
      join_url: meeting.joinUrl,
      meeting_passcode: meeting.passcode,
      starts_at: input.startsAt.toISOString(),
      duration_minutes: input.durationMinutes,
      timezone: input.timezone,
      announcement: input.announcement,
      status: "scheduled",
      created_by: actor.id,
    })
    .select("*")
    .single();
  if (error || !data) {
    // Don't leave an orphan meeting on the provider side.
    if (meeting.connectionId && meeting.externalMeetingId) {
      const connection = await getConnectionById(meeting.connectionId);
      if (connection) await cancelProviderMeeting(connection, meeting.externalMeetingId).catch(() => undefined);
    }
    throw new Error(`live_sessions insert failed: ${error?.message}`);
  }
  const session = data as LiveSessionRow;
  const invited = await inviteCourseStudents(session);
  if (opts.notifyStudents) {
    await notifySessionAudience(session, invited, {
      template: "learning.live_class_scheduled",
      type: "live_scheduled",
      title: `Live class scheduled: ${session.title}`,
      idempotencyKey: `live-scheduled:${session.id}`,
    });
  }
  return session;
}

/**
 * Update a session. Schedule changes are pushed to the provider; if the
 * provider call fails the local change is kept and the error is recorded in
 * provider_sync_error so staff can see what didn't sync.
 */
export async function updateLiveSession(
  actor: SessionUser,
  session: LiveSessionRow,
  input: SessionInput,
  opts: { notifyStudents: boolean },
): Promise<{ session: LiveSessionRow; syncWarning: string | null }> {
  if (session.status === "canceled") throw new UserFacingError("This class was cancelled. Schedule a new one instead.");
  const admin = createAdminClient();
  const patch: TablesUpdate<"live_sessions"> = {
    title: input.title,
    description: input.description,
    starts_at: input.startsAt.toISOString(),
    duration_minutes: input.durationMinutes,
    timezone: input.timezone,
    announcement: input.announcement,
    provider_sync_error: null,
  };
  let syncWarning: string | null = null;

  if (input.provider !== session.provider) {
    // Switching provider: create the new meeting first, then retire the old one.
    if (input.provider === "external") {
      if (!input.externalUrl) throw new UserFacingError("Add the meeting link students should use.");
      Object.assign(patch, { provider: "external", provider_connection_id: null, external_meeting_id: null, join_url: input.externalUrl, meeting_passcode: null });
    } else {
      const connection = await requireHostConnection(actor, input.provider);
      try {
        const created = await createProviderMeeting(connection, meetingInput(input));
        Object.assign(patch, {
          provider: input.provider,
          provider_connection_id: connection.id,
          external_meeting_id: created.externalMeetingId,
          join_url: created.joinUrl,
          meeting_passcode: created.passcode,
        });
      } catch (err) {
        throw providerFailure(input.provider, err);
      }
    }
    if (session.provider !== "external" && session.provider_connection_id && session.external_meeting_id) {
      const old = await getConnectionById(session.provider_connection_id);
      if (old) {
        try {
          await cancelProviderMeeting(old, session.external_meeting_id);
        } catch (err) {
          syncWarning = `The previous ${PROVIDER_LABEL[session.provider]} meeting couldn't be removed: ${err instanceof Error ? err.message : "unknown error"}`;
        }
      }
    }
  } else if (session.provider === "external") {
    if (!input.externalUrl) throw new UserFacingError("Add the meeting link students should use.");
    patch.join_url = input.externalUrl;
  } else if (session.provider_connection_id && session.external_meeting_id) {
    const connection = await getConnectionById(session.provider_connection_id);
    if (!connection) {
      syncWarning = `The host's ${PROVIDER_LABEL[session.provider]} account is no longer connected, so the meeting itself wasn't updated.`;
    } else {
      try {
        await updateProviderMeeting(connection, session.external_meeting_id, meetingInput(input));
      } catch (err) {
        syncWarning = `${PROVIDER_LABEL[session.provider]} wasn't updated: ${err instanceof Error ? err.message : "unknown error"}`;
      }
    }
  }
  if (syncWarning) patch.provider_sync_error = syncWarning.slice(0, 500);

  // A moved session gets fresh reminders.
  const timeChanged = new Date(session.starts_at).getTime() !== input.startsAt.getTime();
  if (timeChanged) {
    patch.reminder_24h_sent_at = null;
    patch.reminder_1h_sent_at = null;
    if (session.status === "completed" && input.startsAt.getTime() > Date.now()) patch.status = "scheduled";
  }

  const { data, error } = await admin.from("live_sessions").update(patch).eq("id", session.id).select("*").single();
  if (error || !data) throw new Error(`live_sessions update failed: ${error?.message}`);
  const updated = data as LiveSessionRow;

  const scheduleChanged = timeChanged || session.duration_minutes !== input.durationMinutes || session.provider !== input.provider || session.join_url !== updated.join_url;
  if (opts.notifyStudents && scheduleChanged) {
    const { data: attendees } = await admin.from("live_session_attendees").select("user_id").eq("session_id", session.id);
    await notifySessionAudience(
      updated,
      (attendees ?? []).map((a: { user_id: string }) => a.user_id),
      {
        template: "learning.live_class_updated",
        type: "live_updated",
        title: `Updated: ${updated.title}`,
        idempotencyKey: `live-updated:${updated.id}:${updated.starts_at}:${updated.provider}:${updated.duration_minutes}`,
      },
    );
  }
  return { session: updated, syncWarning };
}

export async function cancelLiveSession(
  session: LiveSessionRow,
  reason: string | null,
  opts: { notifyStudents: boolean },
): Promise<{ syncWarning: string | null }> {
  if (session.status === "canceled") return { syncWarning: null };
  let syncWarning: string | null = null;
  if (session.provider !== "external" && session.provider_connection_id && session.external_meeting_id) {
    const connection = await getConnectionById(session.provider_connection_id);
    if (connection) {
      try {
        await cancelProviderMeeting(connection, session.external_meeting_id);
      } catch (err) {
        syncWarning = `${PROVIDER_LABEL[session.provider]} meeting couldn't be cancelled there: ${err instanceof Error ? err.message : "unknown error"}`;
      }
    } else {
      syncWarning = `The host's ${PROVIDER_LABEL[session.provider]} account is disconnected; delete the meeting there manually if needed.`;
    }
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("live_sessions")
    .update({ status: "canceled", canceled_reason: reason, provider_sync_error: syncWarning })
    .eq("id", session.id);
  if (error) throw new Error(`live_sessions cancel failed: ${error.message}`);

  if (opts.notifyStudents) {
    const { data: attendees } = await admin.from("live_session_attendees").select("user_id").eq("session_id", session.id);
    await notifySessionAudience(
      { ...session, status: "canceled" },
      (attendees ?? []).map((a: { user_id: string }) => a.user_id),
      {
        template: "learning.live_class_canceled",
        type: "live_canceled",
        title: `Cancelled: ${session.title}`,
        idempotencyKey: `live-canceled:${session.id}`,
        extra: { reason: reason ?? "" },
      },
    );
  }
  return { syncWarning };
}

export interface SyncResult {
  recordingsAdded: number;
  attendanceRows: number;
  matchedStudents: number;
  notes: string[];
}

/**
 * Pull recordings and participants from the provider. Provider attendance
 * rows are replaced on each sync; manual and join-click rows are untouched.
 */
export async function syncSessionArtifacts(session: LiveSessionRow): Promise<SyncResult> {
  const empty: SyncResult = { recordingsAdded: 0, attendanceRows: 0, matchedStudents: 0, notes: [] };
  if (session.provider === "external") {
    return { ...empty, notes: ["External meetings can't be synced. Add recordings and attendance manually."] };
  }
  if (!session.provider_connection_id || !session.external_meeting_id) {
    return { ...empty, notes: ["This class has no provider meeting attached."] };
  }
  const connection = await getConnectionById(session.provider_connection_id);
  if (!connection) return { ...empty, notes: [`The host's ${PROVIDER_LABEL[session.provider]} account is no longer connected.`] };

  const admin = createAdminClient();
  let artifacts;
  try {
    artifacts = await fetchProviderArtifacts(connection, session.external_meeting_id);
  } catch (err) {
    const note = err instanceof Error ? err.message : "Sync failed";
    await admin.from("live_sessions").update({ provider_sync_error: note.slice(0, 500) }).eq("id", session.id);
    return { ...empty, notes: [note] };
  }

  // Recordings: insert ones we don't have yet.
  let recordingsAdded = 0;
  if (artifacts.recordings.length) {
    const { data: existing } = await admin
      .from("meeting_recordings")
      .select("external_id")
      .eq("session_id", session.id)
      .not("external_id", "is", null);
    const known = new Set((existing ?? []).map((r: { external_id: string }) => r.external_id));
    const rows = artifacts.recordings
      .filter((r) => !known.has(r.externalId))
      .map((r) => ({
        session_id: session.id,
        provider: session.provider as MeetingProviderId,
        external_id: r.externalId,
        title: r.title ?? `${session.title} recording`,
        url: r.url,
        passcode: r.passcode,
        duration_seconds: r.durationSeconds,
        recorded_at: r.recordedAt,
        is_visible: true,
      }));
    if (rows.length) {
      const { error } = await admin.from("meeting_recordings").insert(rows);
      if (error) artifacts.notes.push(`Saving recordings failed: ${error.message}`);
      else recordingsAdded = rows.length;
    }
  }

  // Attendance: match participant emails to accounts.
  let matched = 0;
  if (artifacts.participants.length) {
    const emails = [...new Set(artifacts.participants.map((p) => p.email?.toLowerCase()).filter((e): e is string => Boolean(e)))];
    const userByEmail = new Map<string, string>();
    for (const group of chunks(emails)) {
      const { data } = await admin.from("profile_private").select("user_id, email").in("email", group);
      for (const row of data ?? []) userByEmail.set(String((row as { email: string }).email).toLowerCase(), (row as { user_id: string }).user_id);
    }
    await admin.from("live_session_attendance").delete().eq("session_id", session.id).eq("source", "provider");
    const rows = artifacts.participants.map((p) => {
      const userId = p.email ? userByEmail.get(p.email.toLowerCase()) ?? null : null;
      if (userId) matched++;
      return {
        session_id: session.id,
        user_id: userId,
        participant_name: p.name,
        participant_email: p.email,
        joined_at: p.joinedAt,
        left_at: p.leftAt,
        duration_seconds: p.durationSeconds,
        source: "provider",
      };
    });
    for (const group of chunks(rows, 200)) {
      const { error } = await admin.from("live_session_attendance").insert(group);
      if (error) artifacts.notes.push(`Saving attendance failed: ${error.message}`);
    }
  }

  await admin
    .from("live_sessions")
    .update({ provider_sync_error: artifacts.notes.length ? artifacts.notes.join(" ").slice(0, 500) : null })
    .eq("id", session.id);

  return {
    recordingsAdded,
    attendanceRows: artifacts.participants.length,
    matchedStudents: matched,
    notes: artifacts.notes,
  };
}
