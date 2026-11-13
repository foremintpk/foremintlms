import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSetting } from "@/lib/settings";
import { currentCourseAudience, getLiveSession, inviteCourseStudents, notifySessionAudience, syncSessionArtifacts } from "./sessions";
import { selectDueReminders, startsInLabel, type ReminderCandidate } from "./time";
import type { LiveSessionRow } from "./types";

/**
 * Cron (every 5 minutes):
 * 1. move sessions to "live" / "completed" based on their scheduled window;
 * 2. send the long (default 24h) and short (default 1h) reminders once each.
 * Idempotent: reminder columns are set after sending, and every email carries
 * a per-session, per-reminder idempotency key.
 */
export async function sendLiveSessionReminders(): Promise<number> {
  const admin = createAdminClient();
  const now = new Date();

  // 1) Status by time. Look back two days so a missed run still catches up.
  const { data: active } = await admin
    .from("live_sessions")
    .select("id, starts_at, duration_minutes, status")
    .in("status", ["scheduled", "live"])
    .gte("starts_at", new Date(now.getTime() - 2 * 86_400_000).toISOString())
    .lte("starts_at", now.toISOString());
  for (const s of (active ?? []) as Pick<LiveSessionRow, "id" | "starts_at" | "duration_minutes" | "status">[]) {
    const end = new Date(s.starts_at).getTime() + s.duration_minutes * 60_000;
    const next = now.getTime() >= end ? "completed" : "live";
    if (next !== s.status) await admin.from("live_sessions").update({ status: next }).eq("id", s.id).in("status", ["scheduled", "live"]);
  }
  // Anything older that never got closed.
  await admin
    .from("live_sessions")
    .update({ status: "completed" })
    .in("status", ["scheduled", "live"])
    .lt("starts_at", new Date(now.getTime() - 2 * 86_400_000).toISOString());

  // 2) Reminders.
  const offsets = await getSetting<number[]>("live.reminder_offsets_minutes", [1440, 60]);
  const sorted = [...offsets].filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => b - a);
  const longMinutes = sorted[0] ?? 1440;
  const shortMinutes = sorted[1] ?? Math.min(60, longMinutes);

  const { data: upcoming } = await admin
    .from("live_sessions")
    .select("id, starts_at, status, reminder_24h_sent_at, reminder_1h_sent_at")
    .eq("status", "scheduled")
    .gt("starts_at", now.toISOString())
    .lte("starts_at", new Date(now.getTime() + longMinutes * 60_000).toISOString());

  const due = selectDueReminders((upcoming ?? []) as ReminderCandidate[], now, { longMinutes, shortMinutes });
  let sent = 0;
  for (const item of due) {
    const session = await getLiveSession(item.id);
    if (!session || session.status !== "scheduled") continue;
    // New students since scheduling are invited too; only people with access are reminded.
    await inviteCourseStudents(session);
    const [{ data: attendees }, audience] = await Promise.all([
      admin.from("live_session_attendees").select("user_id, rsvp").eq("session_id", session.id),
      currentCourseAudience(session.course_id),
    ]);
    const allowed = new Set(audience);
    const recipients = ((attendees ?? []) as { user_id: string; rsvp: string | null }[])
      .filter((a) => a.rsvp !== "declined" && allowed.has(a.user_id))
      .map((a) => a.user_id);

    const minutes = Math.max(1, Math.round((new Date(session.starts_at).getTime() - now.getTime()) / 60_000));
    const startsIn = startsInLabel(minutes);
    await notifySessionAudience(session, recipients, {
      template: "learning.live_class_reminder",
      type: "live_reminder",
      title: `Starting ${startsIn}: ${session.title}`,
      idempotencyKey: `live-reminder:${item.kind}:${session.id}:${session.starts_at}`,
      extra: { starts_in: startsIn },
    });
    const sentAt = new Date().toISOString();
    await admin
      .from("live_sessions")
      .update(item.kind === "long" ? { reminder_24h_sent_at: sentAt } : { reminder_1h_sent_at: sentAt })
      .eq("id", session.id);
    sent++;
  }
  return sent;
}

/**
 * Cron (hourly): fetch recordings and attendance for provider-hosted sessions
 * that ended in the last 7 days. Plan limitations are recorded on the session
 * (provider_sync_error) instead of failing the job.
 */
export async function syncLiveSessionArtifacts(): Promise<number> {
  const admin = createAdminClient();
  const now = Date.now();
  const { data } = await admin
    .from("live_sessions")
    .select("*")
    .in("provider", ["zoom", "google_meet"])
    .in("status", ["completed", "live"])
    .gte("starts_at", new Date(now - 7 * 86_400_000).toISOString())
    .lte("starts_at", new Date(now).toISOString())
    .not("provider_connection_id", "is", null)
    .limit(100);
  let processed = 0;
  for (const session of (data ?? []) as LiveSessionRow[]) {
    // Provider artifacts appear after the meeting ends; give them 15 minutes.
    const end = new Date(session.starts_at).getTime() + session.duration_minutes * 60_000;
    if (now < end + 15 * 60_000) continue;
    try {
      await syncSessionArtifacts(session);
      processed++;
    } catch (err) {
      console.error(`[live] artifact sync failed for ${session.id}`, err);
    }
  }
  return processed;
}
