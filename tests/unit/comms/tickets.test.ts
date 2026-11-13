import { describe, expect, it } from "vitest";
import {
  canRequesterReopen,
  computeTicketMetrics,
  firstResponseAt,
  formatHours,
  statusAfterReply,
  statusLabel,
  type MetricMessage,
  type MetricTicket,
} from "@/components/communication/lib/tickets";

const t1: MetricTicket = {
  id: "t1",
  requester_id: "student",
  status: "resolved",
  priority: "normal",
  created_at: "2026-11-01T10:00:00Z",
  resolved_at: "2026-11-02T10:00:00Z",
};
const t2: MetricTicket = {
  id: "t2",
  requester_id: "student2",
  status: "open",
  priority: "high",
  created_at: "2026-11-03T10:00:00Z",
  resolved_at: null,
};

const messages: MetricMessage[] = [
  { ticket_id: "t1", author_id: "student", is_internal: false, created_at: "2026-11-01T10:30:00Z" },
  { ticket_id: "t1", author_id: "agent", is_internal: true, created_at: "2026-11-01T11:00:00Z" },
  { ticket_id: "t1", author_id: "agent", is_internal: false, created_at: "2026-11-01T12:00:00Z" },
  { ticket_id: "t1", author_id: "agent", is_internal: false, created_at: "2026-11-01T13:00:00Z" },
];

describe("first response", () => {
  it("ignores the requester's own messages and internal notes", () => {
    expect(firstResponseAt(t1, messages)).toBe("2026-11-01T12:00:00.000Z");
  });
  it("is null when nobody has replied", () => {
    expect(firstResponseAt(t2, messages)).toBeNull();
  });
});

describe("computeTicketMetrics", () => {
  it("aggregates status, open priority and averages", () => {
    const m = computeTicketMetrics([t1, t2], messages);
    expect(m.total).toBe(2);
    expect(m.openCount).toBe(1);
    expect(m.byStatus.resolved).toBe(1);
    expect(m.openByPriority.high).toBe(1);
    expect(m.openByPriority.normal).toBe(0);
    expect(m.avgFirstResponseHours).toBe(2);
    expect(m.avgResolutionHours).toBe(24);
    expect(m.respondedCount).toBe(1);
  });
  it("returns null averages for an empty set", () => {
    const m = computeTicketMetrics([], []);
    expect(m.avgFirstResponseHours).toBeNull();
    expect(m.avgResolutionHours).toBeNull();
  });
});

describe("status transitions", () => {
  it("hands the ticket to the student after a public staff reply", () => {
    expect(statusAfterReply("open", { authorIsRequester: false, isInternal: false })).toBe("waiting_on_student");
    expect(statusAfterReply("in_progress", { authorIsRequester: false, isInternal: false })).toBe("waiting_on_student");
  });
  it("re-opens when the student replies", () => {
    expect(statusAfterReply("waiting_on_student", { authorIsRequester: true, isInternal: false })).toBe("open");
    expect(statusAfterReply("resolved", { authorIsRequester: true, isInternal: false })).toBe("open");
    expect(statusAfterReply("in_progress", { authorIsRequester: true, isInternal: false })).toBe("in_progress");
  });
  it("leaves the status alone for internal notes", () => {
    expect(statusAfterReply("open", { authorIsRequester: false, isInternal: true })).toBe("open");
  });
  it("limits re-opening to 30 days", () => {
    const now = new Date("2026-11-30T00:00:00Z");
    expect(canRequesterReopen("resolved", "2026-11-20T00:00:00Z", now)).toBe(true);
    expect(canRequesterReopen("closed", "2026-10-01T00:00:00Z", now)).toBe(false);
    expect(canRequesterReopen("open", null, now)).toBe(false);
  });
  it("labels waiting status by viewer", () => {
    expect(statusLabel("waiting_on_student", "requester")).toBe("Waiting for you");
    expect(statusLabel("waiting_on_student", "staff")).toBe("Waiting for student");
  });
  it("formats durations", () => {
    expect(formatHours(null)).toBe("—");
    expect(formatHours(0.25)).toBe("15m");
    expect(formatHours(5.25)).toBe("5.3h");
    expect(formatHours(72)).toBe("3d");
  });
});
