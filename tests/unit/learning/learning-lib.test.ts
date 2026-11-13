import { describe, expect, it } from "vitest";
import {
  buildIcs,
  embedSource,
  icsEscape,
  isSafeExternalUrl,
  liveJoinState,
  resumePosition,
  shouldAutoComplete,
  videoPercent,
} from "@/components/learning/lib";
import {
  applyLatePenalty,
  assignmentDueDate,
  canSubmitNew,
  isAssignmentSatisfied,
  isLate,
  learnerAssignmentStatus,
} from "@/lib/services/assignments/due";

describe("video progress", () => {
  it("computes percent safely", () => {
    expect(videoPercent(30, 60)).toBe(50);
    expect(videoPercent(90, 60)).toBe(100);
    expect(videoPercent(10, 0)).toBe(0);
    expect(videoPercent(10, null)).toBe(0);
    expect(videoPercent(-5, 60)).toBe(0);
  });
  it("auto-completes only video_watched lessons at 90%", () => {
    expect(shouldAutoComplete("video_watched", 90)).toBe(true);
    expect(shouldAutoComplete("video_watched", 89.9)).toBe(false);
    expect(shouldAutoComplete("manual", 100)).toBe(false);
  });
  it("resumes slightly before the saved point", () => {
    expect(resumePosition(0, 100)).toBe(0);
    expect(resumePosition(50, 100)).toBe(47);
    expect(resumePosition(95, 100)).toBe(0);
  });
});

describe("embedSource", () => {
  it("normalises YouTube links to the privacy-enhanced host", () => {
    expect(embedSource("https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.src).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(embedSource("https://youtu.be/dQw4w9WgXcQ")?.provider).toBe("youtube");
  });
  it("supports Vimeo, Loom, Google, Figma, CodePen and Miro", () => {
    expect(embedSource("https://vimeo.com/123456789")?.src).toBe("https://player.vimeo.com/video/123456789?dnt=1");
    expect(embedSource("https://www.loom.com/share/0123456789abcdef0123456789abcdef")?.provider).toBe("loom");
    expect(embedSource("https://docs.google.com/presentation/d/1AbCdEfGhIjKlMnOp/edit")?.src).toMatch(/\/embed$/);
    expect(embedSource("https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/edit")?.src).toMatch(/\/preview$/);
    expect(embedSource("https://www.figma.com/design/abc/Thing")?.src).toContain("figma.com/embed");
    expect(embedSource("https://codepen.io/someone/pen/abcDEF")?.src).toBe("https://codepen.io/someone/embed/abcDEF?default-tab=result");
    expect(embedSource("https://miro.com/app/board/uXjVO=/")?.src).toBe("https://miro.com/app/live-embed/uXjVO=/");
  });
  it("rejects everything else", () => {
    expect(embedSource("https://evil.example.com/embed")).toBeNull();
    expect(embedSource("http://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(embedSource("javascript:alert(1)")).toBeNull();
    expect(embedSource("not a url")).toBeNull();
    expect(embedSource("https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ")).toBeNull();
  });
});

describe("external urls and live classes", () => {
  it("only allows https", () => {
    expect(isSafeExternalUrl("https://zoom.us/j/1")).toBe(true);
    expect(isSafeExternalUrl("http://zoom.us/j/1")).toBe(false);
    expect(isSafeExternalUrl("javascript:alert(1)")).toBe(false);
  });
  it("opens the join window 15 minutes before start", () => {
    const start = "2026-06-01T12:00:00Z";
    expect(liveJoinState(start, 60, "scheduled", new Date("2026-06-01T11:40:00Z"))).toBe("upcoming");
    expect(liveJoinState(start, 60, "scheduled", new Date("2026-06-01T11:46:00Z"))).toBe("joinable");
    expect(liveJoinState(start, 60, "live", new Date("2026-06-01T12:30:00Z"))).toBe("joinable");
    expect(liveJoinState(start, 60, "scheduled", new Date("2026-06-01T13:01:00Z"))).toBe("ended");
    expect(liveJoinState(start, 60, "canceled", new Date("2026-06-01T12:00:00Z"))).toBe("canceled");
  });
  it("builds a valid calendar file", () => {
    const ics = buildIcs({
      uid: "abc@foremint",
      title: "Shopify, live; Q&A",
      description: "Line one\nLine two",
      start: new Date("2026-06-01T12:00:00Z"),
      durationMinutes: 90,
      stamp: new Date("2026-05-01T00:00:00Z"),
    });
    expect(ics).toContain("DTSTART:20260601T120000Z");
    expect(ics).toContain("DTEND:20260601T133000Z");
    expect(ics).toContain("SUMMARY:Shopify\\, live\\; Q&A");
    expect(ics).toContain("DESCRIPTION:Line one\\nLine two");
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(icsEscape("a\\b")).toBe("a\\\\b");
  });
});

describe("assignment rules", () => {
  it("resolves absolute and relative due dates", () => {
    expect(assignmentDueDate({ due_at: "2026-06-10T00:00:00Z", due_days_after_enrollment: 3 }, "2026-01-01T00:00:00Z")?.toISOString()).toBe(
      "2026-06-10T00:00:00.000Z",
    );
    expect(assignmentDueDate({ due_at: null, due_days_after_enrollment: 7 }, "2026-01-01T00:00:00Z")?.toISOString()).toBe("2026-01-08T00:00:00.000Z");
    expect(assignmentDueDate({ due_at: null, due_days_after_enrollment: 7 }, null)).toBeNull();
    expect(assignmentDueDate({ due_at: null, due_days_after_enrollment: null }, "2026-01-01T00:00:00Z")).toBeNull();
  });
  it("detects late submissions", () => {
    expect(isLate(new Date("2026-01-01T00:00:00Z"), new Date("2026-01-02T00:00:00Z"))).toBe(true);
    expect(isLate(null, new Date())).toBe(false);
  });
  it("treats approved or passing grades as satisfied", () => {
    expect(isAssignmentSatisfied({ status: "approved", grade_points: null }, { passing_points: 50 })).toBe(true);
    expect(isAssignmentSatisfied({ status: "graded", grade_points: 40 }, { passing_points: 50 })).toBe(false);
    expect(isAssignmentSatisfied({ status: "graded", grade_points: 50 }, { passing_points: 50 })).toBe(true);
    expect(isAssignmentSatisfied({ status: "graded", grade_points: 0 }, { passing_points: null })).toBe(true);
    expect(isAssignmentSatisfied({ status: "submitted", grade_points: null }, { passing_points: null })).toBe(false);
    expect(isAssignmentSatisfied(null, { passing_points: null })).toBe(false);
  });
  it("allows resubmission only when requested", () => {
    expect(canSubmitNew(null).allowed).toBe(true);
    expect(canSubmitNew({ status: "resubmission_requested" }).allowed).toBe(true);
    expect(canSubmitNew({ status: "submitted" }).allowed).toBe(false);
    expect(canSubmitNew({ status: "approved" }).allowed).toBe(false);
  });
  it("reports overall status", () => {
    const due = new Date("2026-01-01T00:00:00Z");
    expect(learnerAssignmentStatus(null, due, new Date("2026-02-01T00:00:00Z"))).toBe("overdue");
    expect(learnerAssignmentStatus(null, due, new Date("2025-12-01T00:00:00Z"))).toBe("not_started");
    expect(learnerAssignmentStatus({ status: "graded", grade_points: 1 }, due)).toBe("graded");
  });
  it("applies late penalties", () => {
    expect(applyLatePenalty(80, 100, 10, true)).toBe(70);
    expect(applyLatePenalty(80, 100, 10, false)).toBe(80);
    expect(applyLatePenalty(5, 100, 10, true)).toBe(0);
  });
});
