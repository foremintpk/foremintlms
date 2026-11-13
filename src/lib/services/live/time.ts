import { TZDate } from "@date-fns/tz";

/**
 * Time helpers for live classes. Pure — unit tested.
 * Sessions are stored as a UTC instant (starts_at) plus the IANA time zone the
 * host scheduled in (for display and editing).
 */

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** "2026-12-01" + "18:30" in "Europe/London" → the UTC instant. */
export function zonedLocalToUtc(date: string, time: string, timeZone: string): Date {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t) throw new Error("Invalid date or time");
  if (!isValidTimeZone(timeZone)) throw new Error("Invalid time zone");
  const zoned = new TZDate(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]), 0, timeZone);
  return new Date(zoned.getTime());
}

/** UTC instant → wall-clock date/time strings in a zone (for edit forms). */
export function utcToZonedParts(instant: Date | string, timeZone: string): { date: string; time: string } {
  const value = typeof instant === "string" ? new Date(instant) : instant;
  const z = new TZDate(value.getTime(), timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${z.getFullYear()}-${pad(z.getMonth() + 1)}-${pad(z.getDate())}`,
    time: `${pad(z.getHours())}:${pad(z.getMinutes())}`,
  };
}

/** Human time in a zone, e.g. "Tue 1 Dec 2026, 18:30 GMT". */
export function formatInZone(instant: Date | string, timeZone: string): string {
  const value = typeof instant === "string" ? new Date(instant) : instant;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(value);
}

/** Zoom expects "yyyy-MM-ddTHH:mm:ssZ" for UTC start times. */
export function toZoomStartTime(instant: Date): string {
  return instant.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export type SessionPhase = "upcoming" | "joinable" | "live" | "ended";

/** Students may join from 15 minutes before the start until the scheduled end. */
export const JOIN_WINDOW_MINUTES = 15;

export function sessionPhase(startsAt: Date | string, durationMinutes: number, now: Date = new Date()): SessionPhase {
  const start = (typeof startsAt === "string" ? new Date(startsAt) : startsAt).getTime();
  const end = start + durationMinutes * 60_000;
  const t = now.getTime();
  if (t >= end) return "ended";
  if (t >= start) return "live";
  if (t >= start - JOIN_WINDOW_MINUTES * 60_000) return "joinable";
  return "upcoming";
}

export interface ReminderCandidate {
  id: string;
  starts_at: string;
  status: string;
  reminder_24h_sent_at: string | null;
  reminder_1h_sent_at: string | null;
}

export type ReminderKind = "long" | "short";

/**
 * Which reminders are due now. "long" (default 24h) is skipped when the
 * session is already inside the "short" window (default 1h), so a class
 * scheduled at short notice gets one reminder, not two.
 */
export function selectDueReminders(
  sessions: ReminderCandidate[],
  now: Date,
  offsets: { longMinutes: number; shortMinutes: number } = { longMinutes: 1440, shortMinutes: 60 },
): { id: string; kind: ReminderKind }[] {
  const due: { id: string; kind: ReminderKind }[] = [];
  for (const s of sessions) {
    if (s.status !== "scheduled") continue;
    const minutesUntil = (new Date(s.starts_at).getTime() - now.getTime()) / 60_000;
    if (minutesUntil <= 0) continue;
    if (minutesUntil <= offsets.shortMinutes) {
      if (!s.reminder_1h_sent_at) due.push({ id: s.id, kind: "short" });
    } else if (minutesUntil <= offsets.longMinutes) {
      if (!s.reminder_24h_sent_at) due.push({ id: s.id, kind: "long" });
    }
  }
  return due;
}

/** "in 1 hour", "tomorrow", "in 3 hours" — wording for reminder emails. */
export function startsInLabel(minutes: number): string {
  if (minutes <= 90) return minutes <= 60 ? "in 1 hour" : "in about an hour";
  const hours = Math.round(minutes / 60);
  if (hours >= 20) return "tomorrow";
  return `in ${hours} hours`;
}
