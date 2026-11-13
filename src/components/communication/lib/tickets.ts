/** Support ticket rules and helpdesk metrics. Pure functions. */

export const TICKET_STATUSES = ["open", "in_progress", "waiting_on_student", "resolved", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_CATEGORIES = [
  "general",
  "billing",
  "technical",
  "course_content",
  "account",
  "certificate",
  "other",
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<TicketCategory, string> = {
  general: "General question",
  billing: "Billing & payments",
  technical: "Technical problem",
  course_content: "Course content",
  account: "Account & login",
  certificate: "Certificate",
  other: "Something else",
};

export const STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting_on_student: "Waiting for you",
  resolved: "Resolved",
  closed: "Closed",
};

/** Staff see "Waiting for student"; requesters see "Waiting for you". */
export function statusLabel(status: TicketStatus, viewer: "requester" | "staff"): string {
  if (status === "waiting_on_student" && viewer === "staff") return "Waiting for student";
  return STATUS_LABEL[status];
}

export function isClosedStatus(status: TicketStatus): boolean {
  return status === "resolved" || status === "closed";
}

/**
 * Status after a new message. Public staff replies hand the ticket back to
 * the student; a student reply re-opens it. Internal notes change nothing.
 */
export function statusAfterReply(current: TicketStatus, input: { authorIsRequester: boolean; isInternal: boolean }): TicketStatus {
  if (input.isInternal) return current;
  if (input.authorIsRequester) {
    return current === "waiting_on_student" || current === "resolved" || current === "closed" ? "open" : current;
  }
  return current === "closed" ? current : "waiting_on_student";
}

/** Requesters can reopen resolved/closed tickets for 30 days. */
export function canRequesterReopen(status: TicketStatus, closedOrResolvedAt: string | null, now: Date = new Date()): boolean {
  if (!isClosedStatus(status)) return false;
  if (!closedOrResolvedAt) return true;
  return now.getTime() - Date.parse(closedOrResolvedAt) <= 30 * 86_400_000;
}

export interface MetricTicket {
  id: string;
  requester_id: string;
  status: TicketStatus;
  priority: TicketPriority;
  created_at: string;
  resolved_at: string | null;
}

export interface MetricMessage {
  ticket_id: string;
  author_id: string | null;
  is_internal: boolean;
  created_at: string;
}

/** First public reply from anyone other than the requester. */
export function firstResponseAt(ticket: MetricTicket, messages: MetricMessage[]): string | null {
  let best: number | null = null;
  const opened = Date.parse(ticket.created_at);
  for (const m of messages) {
    if (m.ticket_id !== ticket.id || m.is_internal || !m.author_id || m.author_id === ticket.requester_id) continue;
    const t = Date.parse(m.created_at);
    if (Number.isNaN(t) || t < opened) continue;
    if (best === null || t < best) best = t;
  }
  return best === null ? null : new Date(best).toISOString();
}

export interface TicketMetrics {
  total: number;
  openCount: number;
  byStatus: Record<TicketStatus, number>;
  openByPriority: Record<TicketPriority, number>;
  avgFirstResponseHours: number | null;
  avgResolutionHours: number | null;
  respondedCount: number;
  resolvedCount: number;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function computeTicketMetrics(tickets: MetricTicket[], messages: MetricMessage[]): TicketMetrics {
  const byStatus = Object.fromEntries(TICKET_STATUSES.map((s) => [s, 0])) as Record<TicketStatus, number>;
  const openByPriority = Object.fromEntries(TICKET_PRIORITIES.map((p) => [p, 0])) as Record<TicketPriority, number>;
  const byTicket = new Map<string, MetricMessage[]>();
  for (const m of messages) {
    const list = byTicket.get(m.ticket_id);
    if (list) list.push(m);
    else byTicket.set(m.ticket_id, [m]);
  }

  let responseSum = 0;
  let responded = 0;
  let resolutionSum = 0;
  let resolved = 0;

  for (const t of tickets) {
    byStatus[t.status] += 1;
    if (!isClosedStatus(t.status)) openByPriority[t.priority] += 1;
    const first = firstResponseAt(t, byTicket.get(t.id) ?? []);
    if (first) {
      responseSum += Date.parse(first) - Date.parse(t.created_at);
      responded += 1;
    }
    if (t.resolved_at) {
      const d = Date.parse(t.resolved_at) - Date.parse(t.created_at);
      if (d >= 0) {
        resolutionSum += d;
        resolved += 1;
      }
    }
  }

  return {
    total: tickets.length,
    openCount: tickets.filter((t) => !isClosedStatus(t.status)).length,
    byStatus,
    openByPriority,
    avgFirstResponseHours: responded ? round1(responseSum / responded / 3_600_000) : null,
    avgResolutionHours: resolved ? round1(resolutionSum / resolved / 3_600_000) : null,
    respondedCount: responded,
    resolvedCount: resolved,
  };
}

export function formatHours(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) return `${round1(hours)}h`;
  return `${round1(hours / 24)}d`;
}
