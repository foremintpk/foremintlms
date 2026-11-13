import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserFacingError } from "@/lib/actions";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { notify, notifyStaffEmail } from "@/lib/services/notifications";
import { getPublicSettings } from "@/lib/settings";
import { getCourseRole } from "@/lib/auth/guards";
import { appUrl } from "@/lib/env";
import { stripHtml } from "@/lib/sanitize";
import { escapeLike } from "@/lib/list-params";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session";
import type { TablesUpdate } from "@/types/database";
import { cardFor, getProfileCards, type CommsArea, type ProfileCard } from "@/lib/services/messaging";
import { normalizeBody, previewText } from "@/components/communication/lib/text";
import {
  canRequesterReopen,
  computeTicketMetrics,
  isClosedStatus,
  statusAfterReply,
  type MetricMessage,
  type MetricTicket,
  type TicketCategory,
  type TicketMetrics,
  type TicketPriority,
  type TicketStatus,
} from "@/components/communication/lib/tickets";

export const SUPPORT_BASE: Record<CommsArea, string> = {
  learn: "/learn/support",
  teach: "/teach/support",
  admin: "/admin/support",
};

const TICKET_COLUMNS =
  "id, ticket_number, requester_id, course_id, subject, description, category, priority, status, assigned_to, resolved_at, closed_at, last_activity_at, created_at, updated_at";

export interface TicketRow {
  id: string;
  ticket_number: string;
  requester_id: string;
  course_id: string | null;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assigned_to: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}

export interface TicketListItem {
  id: string;
  number: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  courseTitle: string | null;
  requester: ProfileCard;
  assignee: ProfileCard | null;
  lastActivityAt: string;
  createdAt: string;
}

async function courseTitles(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((v): v is string => Boolean(v)))];
  if (!unique.length) return new Map();
  const { data } = await createAdminClient().from("courses").select("id, title").in("id", unique);
  return new Map(((data ?? []) as { id: string; title: string }[]).map((c) => [c.id, c.title]));
}

async function toListItems(rows: TicketRow[]): Promise<TicketListItem[]> {
  const [cards, courses] = await Promise.all([
    getProfileCards(rows.flatMap((r) => [r.requester_id, r.assigned_to])),
    courseTitles(rows.map((r) => r.course_id)),
  ]);
  return rows.map((r) => ({
    id: r.id,
    number: r.ticket_number,
    subject: r.subject,
    category: r.category,
    priority: r.priority,
    status: r.status,
    courseTitle: r.course_id ? courses.get(r.course_id) ?? null : null,
    requester: cardFor(cards, r.requester_id),
    assignee: r.assigned_to ? cardFor(cards, r.assigned_to) : null,
    lastActivityAt: r.last_activity_at,
    createdAt: r.created_at,
  }));
}

const PRIORITY_RANK: Record<TicketPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export async function listMyTickets(
  user: SessionUser,
  opts: { status?: string; from: number; to: number },
): Promise<{ items: TicketListItem[]; total: number }> {
  const supabase = await createClient();
  let query = supabase.from("support_tickets").select(TICKET_COLUMNS, { count: "exact" }).eq("requester_id", user.id);
  if (opts.status === "active") query = query.in("status", ["open", "in_progress", "waiting_on_student"]);
  else if (opts.status === "closed") query = query.in("status", ["resolved", "closed"]);
  const { data, count, error } = await query.order("last_activity_at", { ascending: false }).range(opts.from, opts.to);
  if (error) throw new Error(`tickets query failed: ${error.message}`);
  return { items: await toListItems((data ?? []) as TicketRow[]), total: count ?? 0 };
}

/** Courses taught by a teacher (for responsibility scoping). */
export async function teacherCourseIds(userId: string): Promise<string[]> {
  const { data } = await createAdminClient().from("course_instructors").select("course_id").eq("user_id", userId);
  return ((data ?? []) as { course_id: string }[]).map((r) => r.course_id);
}

export interface StaffTicketQuery {
  status?: string;
  priority?: string;
  category?: string;
  assignee?: string;
  course?: string;
  q?: string;
  sort?: string | null;
  dir?: "asc" | "desc";
  from: number;
  to: number;
}

/**
 * Tickets a staff member works on. Admins see everything; teachers see
 * tickets assigned to them and course-content/certificate tickets for their
 * own courses (the same rule RLS enforces through can_staff_ticket).
 */
export async function listStaffTickets(
  user: SessionUser,
  area: "teach" | "admin",
  opts: StaffTicketQuery,
): Promise<{ items: TicketListItem[]; total: number }> {
  const supabase = await createClient();
  let query = supabase.from("support_tickets").select(TICKET_COLUMNS, { count: "exact" });
  if (area === "teach") {
    const ids = await teacherCourseIds(user.id);
    const scope = ids.length
      ? `assigned_to.eq.${user.id},and(course_id.in.(${ids.join(",")}),category.in.(course_content,certificate))`
      : `assigned_to.eq.${user.id}`;
    query = query.or(scope);
  }
  if (opts.status === "active") query = query.in("status", ["open", "in_progress", "waiting_on_student"]);
  else if (opts.status && opts.status !== "all") query = query.eq("status", opts.status);
  if (opts.priority) query = query.eq("priority", opts.priority);
  if (opts.category) query = query.eq("category", opts.category);
  if (opts.course) query = query.eq("course_id", opts.course);
  if (opts.assignee === "me") query = query.eq("assigned_to", user.id);
  else if (opts.assignee === "unassigned") query = query.is("assigned_to", null);
  else if (opts.assignee) query = query.eq("assigned_to", opts.assignee);
  if (opts.q) {
    const term = escapeLike(opts.q);
    query = query.or(`subject.ilike.%${term}%,ticket_number.ilike.%${term}%`);
  }
  const ascending = opts.dir === "asc";
  if (opts.sort === "created_at") query = query.order("created_at", { ascending });
  else if (opts.sort === "priority") query = query.order("priority", { ascending }).order("last_activity_at", { ascending: false });
  else query = query.order("last_activity_at", { ascending });
  const { data, count, error } = await query.range(opts.from, opts.to);
  if (error) throw new Error(`staff tickets query failed: ${error.message}`);
  let rows = (data ?? []) as TicketRow[];
  // Text priority sorts alphabetically in SQL; re-rank within the page.
  if (opts.sort === "priority") {
    rows = [...rows].sort((a, b) => (ascending ? -1 : 1) * (PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]));
  }
  return { items: await toListItems(rows), total: count ?? 0 };
}

export interface TicketAttachment {
  id: string;
  messageId: string | null;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface TicketMessage {
  id: string;
  author: ProfileCard;
  authorIsRequester: boolean;
  body: string;
  isInternal: boolean;
  createdAt: string;
  attachments: TicketAttachment[];
}

export interface TicketDetail {
  ticket: TicketRow;
  courseTitle: string | null;
  requester: ProfileCard;
  assignee: ProfileCard | null;
  messages: TicketMessage[];
  /** Attachments added when the ticket was opened. */
  openingAttachments: TicketAttachment[];
  isRequester: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  canReopen: boolean;
}

async function viewerIsTicketStaff(user: SessionUser, ticket: TicketRow): Promise<{ isStaff: boolean; isAdmin: boolean }> {
  if (user.roles.includes("admin")) {
    const role = await getCourseRole(user, ticket.course_id ?? "00000000-0000-0000-0000-000000000000");
    if (role.isAdmin) return { isStaff: true, isAdmin: true };
  }
  if (ticket.assigned_to === user.id) return { isStaff: true, isAdmin: false };
  if (ticket.course_id && (ticket.category === "course_content" || ticket.category === "certificate")) {
    const role = await getCourseRole(user, ticket.course_id);
    if (role.isInstructor) return { isStaff: true, isAdmin: false };
  }
  return { isStaff: false, isAdmin: false };
}

export async function getTicket(user: SessionUser, ticketId: string): Promise<TicketDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("support_tickets").select(TICKET_COLUMNS).eq("id", ticketId).maybeSingle();
  const ticket = data as TicketRow | null;
  if (!ticket) return null;

  const [{ data: msgData }, { data: attData }, staff] = await Promise.all([
    // RLS hides internal notes from requesters.
    supabase.from("support_ticket_messages").select("id, author_id, body, is_internal, created_at").eq("ticket_id", ticketId).order("created_at"),
    supabase.from("support_ticket_attachments").select("id, message_id, media_file_id").eq("ticket_id", ticketId),
    viewerIsTicketStaff(user, ticket),
  ]);
  const messages = (msgData ?? []) as { id: string; author_id: string | null; body: string; is_internal: boolean; created_at: string }[];
  const links = (attData ?? []) as { id: string; message_id: string | null; media_file_id: string }[];

  const fileMap = new Map<string, { file_name: string; mime_type: string; size_bytes: number; status: string }>();
  if (links.length) {
    const { data: files } = await createAdminClient()
      .from("media_files")
      .select("id, file_name, mime_type, size_bytes, status")
      .in("id", links.map((l) => l.media_file_id));
    for (const f of (files ?? []) as { id: string; file_name: string; mime_type: string; size_bytes: number; status: string }[]) {
      if (f.status === "ready") fileMap.set(f.id, f);
    }
  }
  const toAttachment = (l: (typeof links)[number]): TicketAttachment | null => {
    const f = fileMap.get(l.media_file_id);
    return f ? { id: l.media_file_id, messageId: l.message_id, fileName: f.file_name, mimeType: f.mime_type, size: Number(f.size_bytes) } : null;
  };
  const attachments = links.map(toAttachment).filter((a): a is TicketAttachment => Boolean(a));

  const [cards, courses] = await Promise.all([
    getProfileCards([ticket.requester_id, ticket.assigned_to, ...messages.map((m) => m.author_id)]),
    courseTitles([ticket.course_id]),
  ]);
  const isRequester = ticket.requester_id === user.id;

  return {
    ticket,
    courseTitle: ticket.course_id ? courses.get(ticket.course_id) ?? null : null,
    requester: cardFor(cards, ticket.requester_id),
    assignee: ticket.assigned_to ? cardFor(cards, ticket.assigned_to) : null,
    messages: messages.map((m) => ({
      id: m.id,
      author: cardFor(cards, m.author_id),
      authorIsRequester: m.author_id === ticket.requester_id,
      body: m.body,
      isInternal: m.is_internal,
      createdAt: m.created_at,
      attachments: attachments.filter((a) => a.messageId === m.id),
    })),
    openingAttachments: attachments.filter((a) => !a.messageId),
    isRequester,
    isStaff: staff.isStaff,
    isAdmin: staff.isAdmin,
    canReopen: isRequester && canRequesterReopen(ticket.status, ticket.closed_at ?? ticket.resolved_at),
  };
}

async function linkTicketAttachments(user: SessionUser, ticketId: string, messageId: string | null, attachmentIds: string[]) {
  if (!attachmentIds.length) return;
  const admin = createAdminClient();
  const { data } = await admin.from("media_files").select("id, uploaded_by, purpose, status").in("id", attachmentIds);
  const valid = ((data ?? []) as { id: string; uploaded_by: string; purpose: string; status: string }[]).filter(
    (f) => f.uploaded_by === user.id && f.purpose === "ticket_attachment" && f.status === "ready",
  );
  if (valid.length !== attachmentIds.length) throw new UserFacingError("One of the attachments couldn't be verified. Upload it again.");
  const { error } = await admin
    .from("support_ticket_attachments")
    .insert(valid.map((f) => ({ ticket_id: ticketId, message_id: messageId, media_file_id: f.id })));
  if (error) throw new Error(`ticket attachment insert failed: ${error.message}`);
}

function cleanText(value: string, max: number, label: string): string {
  const clean = normalizeBody(stripHtml(value));
  if (!clean) throw new UserFacingError(`${label} can't be empty.`);
  if (clean.length > max) throw new UserFacingError(`${label} can be up to ${max.toLocaleString("en-US")} characters.`);
  return clean;
}

function ticketUrlFor(area: CommsArea, ticketId: string) {
  return `${SUPPORT_BASE[area]}/${ticketId}`;
}

async function staffUrl(userId: string, ticketId: string): Promise<string> {
  const { data } = await createAdminClient().from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  return ticketUrlFor(data ? "admin" : "teach", ticketId);
}

export interface CreateTicketInput {
  subject: string;
  description: string;
  category: TicketCategory;
  priority: Exclude<TicketPriority, "urgent">;
  courseId?: string | null;
  attachmentIds: string[];
}

export async function createTicket(user: SessionUser, input: CreateTicketInput): Promise<{ id: string; number: string }> {
  await enforceRateLimit("ticket-create", 8, 3600, user.id);
  const subject = input.subject.replace(/\s+/g, " ").trim();
  if (subject.length < 3) throw new UserFacingError("Add a short subject.");
  const description = cleanText(input.description, 20_000, "The description");

  // Only attach a course the requester is (or was) enrolled in.
  let courseId: string | null = null;
  if (input.courseId) {
    const { data } = await createAdminClient()
      .from("enrollments")
      .select("course_id")
      .eq("user_id", user.id)
      .eq("course_id", input.courseId)
      .maybeSingle();
    courseId = data ? input.courseId : null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("support_tickets")
    .insert({
      requester_id: user.id,
      subject: subject.slice(0, 200),
      description,
      category: input.category,
      priority: input.priority,
      course_id: courseId,
    })
    .select("id, ticket_number")
    .single();
  if (error || !data) throw new Error(`ticket insert failed: ${error?.message}`);
  const ticket = data as { id: string; ticket_number: string };
  await linkTicketAttachments(user, ticket.id, null, input.attachmentIds);

  const url = ticketUrlFor("learn", ticket.id);
  await notify(user.id, {
    category: "support",
    type: "ticket_created",
    title: `We received ticket ${ticket.ticket_number}`,
    body: subject,
    url,
    email: {
      templateKey: "communication.ticket_created",
      idempotencyKey: `ticket-created:${ticket.id}`,
      required: true,
      payload: { ticket_number: ticket.ticket_number, ticket_subject: subject, cta_url: appUrl(url) },
    },
  });

  const settings = await getPublicSettings();
  await notifyStaffEmail(settings.supportEmail, "communication.staff_ticket_alert", `ticket-staff-alert:${ticket.id}`, {
    requester_name: user.fullName || user.email,
    ticket_number: ticket.ticket_number,
    ticket_priority: input.priority,
    ticket_subject: subject,
    cta_url: appUrl(ticketUrlFor("admin", ticket.id)),
  });

  if (courseId && (input.category === "course_content" || input.category === "certificate")) {
    const ids = await createAdminClient().from("course_instructors").select("user_id").eq("course_id", courseId);
    const instructors = ((ids.data ?? []) as { user_id: string }[]).map((r) => r.user_id).filter((id) => id !== user.id);
    if (instructors.length) {
      await notify(instructors, {
        category: "support",
        type: "ticket_for_course",
        title: `New ${input.category === "certificate" ? "certificate" : "course"} ticket ${ticket.ticket_number}`,
        body: subject,
        url: ticketUrlFor("teach", ticket.id),
      });
    }
  }
  return { id: ticket.id, number: ticket.ticket_number };
}

async function loadTicketForWrite(ticketId: string): Promise<TicketRow> {
  const { data } = await createAdminClient().from("support_tickets").select(TICKET_COLUMNS).eq("id", ticketId).maybeSingle();
  if (!data) throw new UserFacingError("Ticket not found.");
  return data as TicketRow;
}

function statusTimestamps(next: TicketStatus, current: TicketRow): Record<string, string | null> {
  const now = new Date().toISOString();
  return {
    resolved_at: next === "resolved" ? current.resolved_at ?? now : next === "closed" ? current.resolved_at : null,
    closed_at: next === "closed" ? now : null,
  };
}

async function notifyResolved(ticket: TicketRow) {
  const url = ticketUrlFor("learn", ticket.id);
  await notify(ticket.requester_id, {
    category: "support",
    type: "ticket_resolved",
    title: `Ticket ${ticket.ticket_number} was resolved`,
    body: ticket.subject,
    url,
    email: {
      templateKey: "communication.ticket_resolved",
      idempotencyKey: `ticket-resolved:${ticket.id}:${Date.now()}`,
      payload: { ticket_number: ticket.ticket_number, ticket_subject: ticket.subject, cta_url: appUrl(url) },
    },
  });
}

export async function replyToTicket(
  user: SessionUser,
  input: { ticketId: string; body: string; isInternal: boolean; attachmentIds: string[]; setStatus?: TicketStatus | null },
) {
  await enforceRateLimit("ticket-reply", 30, 600, user.id);
  const body = cleanText(input.body, 20_000, "Your reply");
  const ticket = await loadTicketForWrite(input.ticketId);
  const staff = await viewerIsTicketStaff(user, ticket);
  const isRequester = ticket.requester_id === user.id;
  if (!staff.isStaff && !isRequester) throw new UserFacingError("You don't have access to this ticket.");
  if (input.isInternal && !staff.isStaff) throw new UserFacingError("Only support staff can add internal notes.");
  if (isRequester && !staff.isStaff && ticket.status === "closed" && !canRequesterReopen(ticket.status, ticket.closed_at)) {
    throw new UserFacingError("This ticket is closed. Open a new ticket and reference " + ticket.ticket_number + ".");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("support_ticket_messages")
    .insert({ ticket_id: ticket.id, author_id: user.id, body, is_internal: input.isInternal })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "42501") throw new UserFacingError("You can't reply to this ticket.");
    throw new Error(`ticket message insert failed: ${error?.message}`);
  }
  const messageId = (data as { id: string }).id;
  await linkTicketAttachments(user, ticket.id, messageId, input.attachmentIds);

  const authorIsRequester = isRequester && !staff.isStaff;
  let next = statusAfterReply(ticket.status, { authorIsRequester, isInternal: input.isInternal });
  if (staff.isStaff && input.setStatus) next = input.setStatus;
  if (next !== ticket.status) {
    // Requesters cannot update tickets through RLS; status follows from the
    // reply rules above, applied with the service role.
    await createAdminClient()
      .from("support_tickets")
      .update({ status: next, ...statusTimestamps(next, ticket) })
      .eq("id", ticket.id);
  }

  if (!input.isInternal && staff.isStaff && !isRequester) {
    const url = ticketUrlFor("learn", ticket.id);
    if (next === "resolved") {
      await notifyResolved(ticket);
    } else {
      await notify(ticket.requester_id, {
        category: "support",
        type: "ticket_replied",
        title: `New reply on ticket ${ticket.ticket_number}`,
        body: previewText(body, 160),
        url,
        email: {
          templateKey: "communication.ticket_replied",
          idempotencyKey: `ticket-reply:${messageId}`,
          payload: { ticket_number: ticket.ticket_number, ticket_subject: ticket.subject, preview: previewText(body, 180), cta_url: appUrl(url) },
        },
      });
    }
  } else if (authorIsRequester && ticket.assigned_to) {
    await notify(ticket.assigned_to, {
      category: "support",
      type: "ticket_student_reply",
      title: `${user.fullName || "The student"} replied on ${ticket.ticket_number}`,
      body: previewText(body, 160),
      url: await staffUrl(ticket.assigned_to, ticket.id),
    });
  }
}

/** Staff status change (RLS: can_staff_ticket). */
export async function setTicketStatus(user: SessionUser, ticketId: string, status: TicketStatus) {
  const ticket = await loadTicketForWrite(ticketId);
  const staff = await viewerIsTicketStaff(user, ticket);
  if (!staff.isStaff) throw new UserFacingError("Only support staff can change the status.");
  if (status === ticket.status) return;
  const supabase = await createClient();
  const { error, data } = await supabase
    .from("support_tickets")
    .update({ status, ...statusTimestamps(status, ticket) })
    .eq("id", ticketId)
    .select("id");
  if (error) throw new Error(`ticket status update failed: ${error.message}`);
  if (!data?.length) throw new UserFacingError("You can't update this ticket.");
  if (status === "resolved") await notifyResolved(ticket);
}

export async function setTicketPriority(user: SessionUser, ticketId: string, priority: TicketPriority) {
  const ticket = await loadTicketForWrite(ticketId);
  const staff = await viewerIsTicketStaff(user, ticket);
  if (!staff.isStaff) throw new UserFacingError("Only support staff can change the priority.");
  const supabase = await createClient();
  const { error } = await supabase.from("support_tickets").update({ priority }).eq("id", ticketId);
  if (error) throw new Error(`ticket priority update failed: ${error.message}`);
}

/** Requester closes or reopens their own ticket. */
export async function requesterSetStatus(user: SessionUser, ticketId: string, action: "close" | "reopen") {
  const ticket = await loadTicketForWrite(ticketId);
  if (ticket.requester_id !== user.id) throw new UserFacingError("You can only change your own tickets.");
  let next: TicketStatus;
  if (action === "close") {
    if (ticket.status === "closed") return;
    next = "closed";
  } else {
    if (!canRequesterReopen(ticket.status, ticket.closed_at ?? ticket.resolved_at)) {
      throw new UserFacingError("This ticket can no longer be reopened. Open a new ticket instead.");
    }
    next = "open";
  }
  const { error } = await createAdminClient()
    .from("support_tickets")
    .update({ status: next, ...statusTimestamps(next, ticket) })
    .eq("id", ticketId);
  if (error) throw new Error(`ticket status update failed: ${error.message}`);
}

export async function assignTicket(user: SessionUser, ticketId: string, assigneeId: string | null) {
  const ticket = await loadTicketForWrite(ticketId);
  const staff = await viewerIsTicketStaff(user, ticket);
  if (!staff.isStaff) throw new UserFacingError("Only support staff can assign tickets.");
  if (!staff.isAdmin && assigneeId !== user.id) throw new UserFacingError("You can only assign tickets to yourself.");
  if (assigneeId) {
    const assignable = await listAssignableStaff();
    if (!assignable.some((s) => s.id === assigneeId)) throw new UserFacingError("Choose an administrator or approved instructor.");
  }
  const supabase = await createClient();
  const patch: TablesUpdate<"support_tickets"> = { assigned_to: assigneeId };
  if (assigneeId && ticket.status === "open") patch.status = "in_progress";
  const { error, data } = await supabase.from("support_tickets").update(patch).eq("id", ticketId).select("id");
  if (error) throw new Error(`ticket assignment failed: ${error.message}`);
  if (!data?.length) throw new UserFacingError("You can't update this ticket.");
  await audit({ actor: user, action: "ticket.assigned", entityType: "support_ticket", entityId: ticketId, metadata: { assigned_to: assigneeId } });
  if (assigneeId && assigneeId !== user.id) {
    await notify(assigneeId, {
      category: "support",
      type: "ticket_assigned",
      title: `Ticket ${ticket.ticket_number} was assigned to you`,
      body: ticket.subject,
      url: await staffUrl(assigneeId, ticketId),
    });
  }
}

export async function bulkSetStatus(user: SessionUser, ticketIds: string[], status: TicketStatus): Promise<number> {
  if (!user.roles.includes("admin")) throw new UserFacingError("Only administrators can update tickets in bulk.");
  const ids = [...new Set(ticketIds)].slice(0, 100);
  if (!ids.length) return 0;
  const admin = createAdminClient();
  const { data } = await admin.from("support_tickets").select(TICKET_COLUMNS).in("id", ids);
  const tickets = (data ?? []) as TicketRow[];
  const supabase = await createClient();
  let updated = 0;
  for (const t of tickets) {
    if (t.status === status) continue;
    const { error, data: rows } = await supabase
      .from("support_tickets")
      .update({ status, ...statusTimestamps(status, t) })
      .eq("id", t.id)
      .select("id");
    if (!error && rows?.length) {
      updated++;
      if (status === "resolved") await notifyResolved(t);
    }
  }
  await audit({ actor: user, action: "ticket.bulk_status", entityType: "support_ticket", summary: `${updated} tickets → ${status}`, metadata: { ids } });
  return updated;
}

export interface StaffOption {
  id: string;
  name: string;
  role: "admin" | "teacher";
}

export async function listAssignableStaff(): Promise<StaffOption[]> {
  const admin = createAdminClient();
  const [admins, teachers] = await Promise.all([
    admin.from("user_roles").select("user_id").eq("role", "admin"),
    admin.from("teacher_profiles").select("user_id").eq("status", "approved"),
  ]);
  const adminIds = new Set(((admins.data ?? []) as { user_id: string }[]).map((r) => r.user_id));
  const ids = [...adminIds, ...((teachers.data ?? []) as { user_id: string }[]).map((r) => r.user_id)];
  const { data: active } = await admin.from("profile_private").select("user_id").in("user_id", ids).eq("status", "active");
  const activeIds = new Set(((active ?? []) as { user_id: string }[]).map((r) => r.user_id));
  const cards = await getProfileCards([...activeIds]);
  return [...activeIds]
    .map((id) => ({ id, name: cardFor(cards, id).name, role: adminIds.has(id) ? ("admin" as const) : ("teacher" as const) }))
    .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "admin" ? -1 : 1));
}

/** Helpdesk metrics for admins: all open tickets plus everything opened in the window. */
export async function getTicketMetrics(days = 90): Promise<TicketMetrics> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data } = await admin
    .from("support_tickets")
    .select("id, requester_id, status, priority, created_at, resolved_at")
    .or(`created_at.gte.${since},status.in.(open,in_progress,waiting_on_student)`)
    .limit(5000);
  const tickets = (data ?? []) as MetricTicket[];
  let messages: MetricMessage[] = [];
  for (let i = 0; i < tickets.length; i += 500) {
    const chunk = tickets.slice(i, i + 500).map((t) => t.id);
    const { data: m } = await admin
      .from("support_ticket_messages")
      .select("ticket_id, author_id, is_internal, created_at")
      .in("ticket_id", chunk);
    messages = messages.concat((m ?? []) as MetricMessage[]);
  }
  return computeTicketMetrics(tickets, messages);
}

export async function myTicketCourses(user: SessionUser): Promise<{ id: string; title: string }[]> {
  const { data } = await createAdminClient()
    .from("enrollments")
    .select("course_id, courses(id, title)")
    .eq("user_id", user.id)
    .order("enrolled_at", { ascending: false });
  return ((data ?? []) as unknown as { courses: { id: string; title: string } | null }[])
    .map((r) => r.courses)
    .filter((c): c is { id: string; title: string } => Boolean(c));
}

export { isClosedStatus };
