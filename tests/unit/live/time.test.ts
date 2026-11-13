import { describe, expect, it } from "vitest";
import {
  isValidTimeZone,
  selectDueReminders,
  sessionPhase,
  startsInLabel,
  toZoomStartTime,
  utcToZonedParts,
  zonedLocalToUtc,
  type ReminderCandidate,
} from "@/lib/services/live/time";

describe("time zone conversion", () => {
  it("converts wall-clock time in a zone to UTC", () => {
    expect(zonedLocalToUtc("2026-01-15", "10:00", "America/New_York").toISOString()).toBe("2026-01-15T15:00:00.000Z");
    expect(zonedLocalToUtc("2026-12-01", "18:30", "Asia/Kolkata").toISOString()).toBe("2026-12-01T13:00:00.000Z");
    expect(zonedLocalToUtc("2026-07-01", "09:00", "Europe/London").toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(zonedLocalToUtc("2026-07-01", "09:00", "UTC").toISOString()).toBe("2026-07-01T09:00:00.000Z");
  });

  it("handles daylight-saving transitions", () => {
    // US DST starts 8 March 2026: 10:00 that day is EDT (UTC-4).
    expect(zonedLocalToUtc("2026-03-08", "10:00", "America/New_York").toISOString()).toBe("2026-03-08T14:00:00.000Z");
    // The day before is still EST (UTC-5).
    expect(zonedLocalToUtc("2026-03-07", "10:00", "America/New_York").toISOString()).toBe("2026-03-07T15:00:00.000Z");
  });

  it("round-trips through utcToZonedParts", () => {
    const instant = zonedLocalToUtc("2026-11-20", "07:45", "Australia/Sydney");
    expect(utcToZonedParts(instant, "Australia/Sydney")).toEqual({ date: "2026-11-20", time: "07:45" });
  });

  it("rejects invalid input", () => {
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("Europe/Berlin")).toBe(true);
    expect(() => zonedLocalToUtc("2026-01-01", "10:00", "Mars/Olympus")).toThrow();
    expect(() => zonedLocalToUtc("01/01/2026", "10:00", "UTC")).toThrow();
  });

  it("formats Zoom start times without milliseconds", () => {
    expect(toZoomStartTime(new Date("2026-05-01T12:30:00.000Z"))).toBe("2026-05-01T12:30:00Z");
  });
});

describe("reminder selection", () => {
  const now = new Date("2026-11-14T12:00:00Z");
  const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000).toISOString();
  const session = (id: string, minutes: number, extra: Partial<ReminderCandidate> = {}): ReminderCandidate => ({
    id,
    starts_at: at(minutes),
    status: "scheduled",
    reminder_24h_sent_at: null,
    reminder_1h_sent_at: null,
    ...extra,
  });

  it("sends the long reminder inside 24h and the short one inside 1h", () => {
    const due = selectDueReminders([session("a", 20 * 60), session("b", 45), session("c", 30 * 60)], now);
    expect(due).toEqual([
      { id: "a", kind: "long" },
      { id: "b", kind: "short" },
    ]);
  });

  it("never repeats a reminder that was already sent", () => {
    const due = selectDueReminders(
      [session("a", 20 * 60, { reminder_24h_sent_at: at(-10) }), session("b", 30, { reminder_1h_sent_at: at(-5) })],
      now,
    );
    expect(due).toEqual([]);
  });

  it("sends only the short reminder for a class scheduled at short notice", () => {
    expect(selectDueReminders([session("a", 30)], now)).toEqual([{ id: "a", kind: "short" }]);
  });

  it("ignores cancelled, started and far-future sessions", () => {
    const due = selectDueReminders([session("a", 30, { status: "canceled" }), session("b", -5), session("c", 3 * 24 * 60)], now);
    expect(due).toEqual([]);
  });

  it("honours custom offsets", () => {
    expect(selectDueReminders([session("a", 100)], now, { longMinutes: 180, shortMinutes: 15 })).toEqual([{ id: "a", kind: "long" }]);
  });

  it("words the timing naturally", () => {
    expect(startsInLabel(55)).toBe("in 1 hour");
    expect(startsInLabel(80)).toBe("in about an hour");
    expect(startsInLabel(300)).toBe("in 5 hours");
    expect(startsInLabel(1380)).toBe("tomorrow");
  });
});

describe("session phase", () => {
  const start = new Date("2026-11-14T12:00:00Z");
  it("moves from upcoming to joinable to live to ended", () => {
    expect(sessionPhase(start, 60, new Date("2026-11-14T11:00:00Z"))).toBe("upcoming");
    expect(sessionPhase(start, 60, new Date("2026-11-14T11:50:00Z"))).toBe("joinable");
    expect(sessionPhase(start, 60, new Date("2026-11-14T12:30:00Z"))).toBe("live");
    expect(sessionPhase(start, 60, new Date("2026-11-14T13:00:00Z"))).toBe("ended");
  });
});
