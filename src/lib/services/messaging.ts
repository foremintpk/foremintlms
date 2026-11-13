import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserFacingError } from "@/lib/actions";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { notify } from "@/lib/services/notifications";
import { appUrl } from "@/lib/env";
import { stripHtml } from "@/lib/sanitize";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session";
import { messageEmailKey, shouldEmailRecipient } from "@/components/communication/lib/email-bucket";
import { normalizeBody, previewText } from "@/components/communication/lib/text";

export type CommsArea = "learn" | "teach" | "admin";
export type PersonRole = "admin" | "teacher" | "student";

export const MESSAGES_BASE: Record<CommsArea, string> = {
  learn: "/learn/messages",
  teach: "/teach/messages",
  admin: "/admin/messages",
};

export function areaForRole(role: PersonRole): CommsArea {
  return role === "admin" ? "admin" : role === "teacher" ? "teach" : "learn";
}

export interface ProfileCard {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: PersonRole;
}

const FORMER_MEMBER: Omit<ProfileCard, "id"> = { name: "Former member", avatarUrl: null, role: "student" };

/**
 * Display cards (name, avatar, role) for authors of content the caller has
 * already been allowed to read through RLS. Only display fields are exposed.
 */
export async function getProfileCards(ids: (string | null | undefined)[]): Promise<Map<string, ProfileCard>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const out = new Map<string, ProfileCard>();
  if (unique.length === 0) return out;
  const admin = createAdminClient();
  const [profiles, roles, teachers] = await Promise.all([
    admin.from("profiles").select("id, full_name, display_name, avatar_url").in("id", unique),
    admin.from("user_roles").select("user_id, role").in("user_id", unique).eq("role", "admin"),
    admin.from("teacher_profiles").select("user_id, public_name, avatar_url, status").in("user_id", unique).eq("status", "approved"),
  ]);
  const admins = new Set((roles.data ?? []).map((r: { user_id: string }) => r.user_id));
  const teacherRows = new Map(
    ((teachers.data ?? []) as { user_id: string; public_name: string; avatar_url: string | null }[]).map((t) => [t.user_id, t]),
  );
  for (const p of (profiles.data ?? []) as { id: string; full_name: string; display_name: string | null; avatar_url: string | null }[]) {
    const teacher = teacherRows.get(p.id);
    out.set(p.id, {
      id: p.id,
      name: p.full_name?.trim() || p.display_name?.trim() || teacher?.public_name || "Member",
      avatarUrl: p.avatar_url ?? teacher?.avatar_url ?? null,
      role: admins.has(p.id) ? "admin" : teacher ? "teacher" : "student",
    });
  }
  for (const id of unique) if (!out.has(id)) out.set(id, { id, ...FORMER_MEMBER });
  return out;
}

export function cardFor(cards: Map<string, ProfileCard>, id: string | null | undefined): ProfileCard {
  if (!id) return { id: "", ...FORMER_MEMBER };
  return cards.get(id) ?? { id, ...FORMER_MEMBER };
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export interface ConversationSummary {
  id: string;
  kind: "direct" | "support";
  courseId: string | null;
  courseTitle: string | null;
  subject: string | null;
  createdAt: string;
  lastMessageAt: string | null;
  lastMessageBody: string | null;
  lastMessageSenderId: string | null;
  unreadCount: number;
  lastReadAt: string | null;
  isMuted: boolean;
  other: ProfileCard | null;
}

interface ConversationRpcRow {
  conversation_id: string;
  kind: "direct" | "support";
  course_id: string | null;
  course_title: string | null;
  subject: string | null;
  created_at: string;
  last_message_at: string | null;
  last_message_body: string | null;
  last_message_sender_id: string | null;
  unread_count: number;
  last_read_at: string | null;
  is_muted: boolean;
  other_user_id: string | null;
  other_name: string | null;
  other_avatar_url: string | null;
  other_role: PersonRole | null;
}

export async function listConversations(search?: string): Promise<ConversationSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_conversations", { p_search: search?.trim() || undefined, p_limit: 100 });
  if (error) throw new Error(`list_my_conversations failed: ${error.message}`);
  return ((data ?? []) as ConversationRpcRow[]).map((r) => ({
    id: r.conversation_id,
    kind: r.kind,
    courseId: r.course_id,
    courseTitle: r.course_title,
    subject: r.subject,
    createdAt: r.created_at,
    lastMessageAt: r.last_message_at,
    lastMessageBody: r.last_message_body,
    lastMessageSenderId: r.last_message_sender_id,
    unreadCount: r.unread_count ?? 0,
    lastReadAt: r.last_read_at,
    isMuted: r.is_muted,
    other: r.other_user_id
      ? { id: r.other_user_id, name: r.other_name ?? "Member", avatarUrl: r.other_avatar_url, role: r.other_role ?? "student" }
      : null,
  }));
}

export interface MessageAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface ThreadMessage {
  id: string;
  conversationId: string;
  senderId: string | null;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  attachments: MessageAttachment[];
}

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  body: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
}

const MESSAGE_COLUMNS = "id, conversation_id, sender_id, body, created_at, edited_at, deleted_at";
export const PAGE_SIZE = 50;

async function attachMedia(messages: MessageRow[]): Promise<ThreadMessage[]> {
  const supabase = await createClient();
  const ids = messages.map((m) => m.id);
  const byMessage = new Map<string, MessageAttachment[]>();
  if (ids.length) {
    // RLS on message_attachments limits rows to conversations the caller may read.
    const { data: links } = await supabase.from("message_attachments").select("message_id, media_file_id").in("message_id", ids);
    const linkRows = (links ?? []) as { message_id: string; media_file_id: string }[];
    if (linkRows.length) {
      const { data: files } = await createAdminClient()
        .from("media_files")
        .select("id, file_name, mime_type, size_bytes, status")
        .in("id", linkRows.map((l) => l.media_file_id));
      const fileMap = new Map(
        ((files ?? []) as { id: string; file_name: string; mime_type: string; size_bytes: number; status: string }[])
          .filter((f) => f.status === "ready")
          .map((f) => [f.id, f]),
      );
      for (const l of linkRows) {
        const f = fileMap.get(l.media_file_id);
        if (!f) continue;
        const list = byMessage.get(l.message_id) ?? [];
        list.push({ id: f.id, fileName: f.file_name, mimeType: f.mime_type, size: Number(f.size_bytes) });
        byMessage.set(l.message_id, list);
      }
    }
  }
  return messages.map((m) => ({
    id: m.id,
    conversationId: m.conversation_id,
    senderId: m.sender_id,
    body: m.deleted_at ? "" : m.body,
    createdAt: m.created_at,
    editedAt: m.edited_at,
    deletedAt: m.deleted_at,
    attachments: m.deleted_at ? [] : byMessage.get(m.id) ?? [],
  }));
}

export interface ConversationDetail {
  id: string;
  subject: string | null;
  courseTitle: string | null;
  participants: ProfileCard[];
  isParticipant: boolean;
  lastReadAt: string | null;
  isMuted: boolean;
  messages: ThreadMessage[];
  hasMore: boolean;
}

/** Loads a conversation the caller may read (participant, or admin moderator). */
export async function loadConversation(user: SessionUser, conversationId: string): Promise<ConversationDetail | null> {
  const supabase = await createClient();
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, subject, course_id, courses(title)")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) return null;
  const convRow = conv as unknown as { id: string; subject: string | null; courses: { title: string } | null };

  const [{ data: parts }, { data: rows }] = await Promise.all([
    supabase.from("conversation_participants").select("user_id, last_read_at, is_muted").eq("conversation_id", conversationId),
    supabase
      .from("messages")
      .select(MESSAGE_COLUMNS)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE + 1),
  ]);
  const participantRows = (parts ?? []) as { user_id: string; last_read_at: string | null; is_muted: boolean }[];
  const mine = participantRows.find((p) => p.user_id === user.id) ?? null;
  const cards = await getProfileCards(participantRows.map((p) => p.user_id));
  const messageRows = (rows ?? []) as MessageRow[];
  const hasMore = messageRows.length > PAGE_SIZE;

  return {
    id: convRow.id,
    subject: convRow.subject,
    courseTitle: convRow.courses?.title ?? null,
    participants: participantRows.map((p) => cardFor(cards, p.user_id)),
    isParticipant: Boolean(mine),
    lastReadAt: mine?.last_read_at ?? null,
    isMuted: mine?.is_muted ?? false,
    messages: await attachMedia(messageRows.slice(0, PAGE_SIZE).reverse()),
    hasMore,
  };
}

export async function loadEarlierMessages(conversationId: string, before: string): Promise<{ messages: ThreadMessage[]; hasMore: boolean }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("conversation_id", conversationId)
    .lt("created_at", before)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE + 1);
  const rows = (data ?? []) as MessageRow[];
  return { messages: await attachMedia(rows.slice(0, PAGE_SIZE).reverse()), hasMore: rows.length > PAGE_SIZE };
}

/** Load a single message the caller can read (used for realtime inserts with attachments). */
export async function loadMessage(messageId: string): Promise<ThreadMessage | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("messages").select(MESSAGE_COLUMNS).eq("id", messageId).maybeSingle();
  if (!data) return null;
  const [m] = await attachMedia([data as MessageRow]);
  return m ?? null;
}

async function linkAttachments(user: SessionUser, conversationId: string, messageId: string, attachmentIds: string[]) {
  if (attachmentIds.length === 0) return;
  const admin = createAdminClient();
  const { data: files } = await admin
    .from("media_files")
    .select("id, uploaded_by, purpose, status, storage_path")
    .in("id", attachmentIds);
  const valid = ((files ?? []) as { id: string; uploaded_by: string; purpose: string; status: string; storage_path: string }[]).filter(
    (f) =>
      f.uploaded_by === user.id &&
      f.purpose === "message_attachment" &&
      f.status === "ready" &&
      f.storage_path.startsWith(`messages/${conversationId}/`),
  );
  if (valid.length !== attachmentIds.length) throw new UserFacingError("One of the attachments couldn't be verified. Upload it again.");
  const { error } = await admin.from("message_attachments").insert(valid.map((f) => ({ message_id: messageId, media_file_id: f.id })));
  if (error) throw new Error(`message_attachments insert failed: ${error.message}`);
}

async function notifyRecipients(user: SessionUser, conversationId: string, body: string, at: Date) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("conversation_participants")
    .select("user_id, last_read_at, is_muted")
    .eq("conversation_id", conversationId)
    .neq("user_id", user.id);
  const recipients = (data ?? []) as { user_id: string; last_read_at: string | null; is_muted: boolean }[];
  if (recipients.length === 0) return;
  const cards = await getProfileCards(recipients.map((r) => r.user_id));
  const sender = user.fullName || user.displayName;
  await Promise.all(
    recipients
      .filter((r) => shouldEmailRecipient({ lastReadAt: r.last_read_at, isMuted: r.is_muted, now: at }))
      .map((r) => {
        const base = MESSAGES_BASE[areaForRole(cardFor(cards, r.user_id).role)];
        return notify(r.user_id, {
          category: "messages",
          type: "new_message",
          title: `New message from ${sender}`,
          emailOnly: true,
          email: {
            templateKey: "communication.new_message",
            idempotencyKey: messageEmailKey(conversationId, at),
            payload: { sender_name: sender, preview: previewText(body, 180), cta_url: appUrl(`${base}/${conversationId}`) },
          },
        });
      }),
  );
}

export async function sendMessage(
  user: SessionUser,
  input: { conversationId: string; body: string; attachmentIds: string[] },
): Promise<ThreadMessage> {
  await enforceRateLimit("message-send", 40, 60, user.id);
  const body = normalizeBody(stripHtml(input.body));
  const finalBody = body || (input.attachmentIds.length ? "Shared an attachment" : "");
  if (!finalBody) throw new UserFacingError("Write a message first.");
  if (finalBody.length > 10_000) throw new UserFacingError("Messages can be up to 10,000 characters.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: input.conversationId, sender_id: user.id, body: finalBody })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error || !data) {
    if (error?.code === "42501") throw new UserFacingError("You can't send messages in this conversation.");
    throw new Error(`message insert failed: ${error?.message}`);
  }
  const row = data as MessageRow;
  await linkAttachments(user, input.conversationId, row.id, input.attachmentIds);
  await notifyRecipients(user, input.conversationId, finalBody, new Date(row.created_at));
  const [message] = await attachMedia([row]);
  return message;
}

export async function markConversationRead(user: SessionUser, conversationId: string) {
  const supabase = await createClient();
  await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);
}

export async function setConversationMuted(user: SessionUser, conversationId: string, muted: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("conversation_participants")
    .update({ is_muted: muted })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);
  if (error) throw new Error(`mute update failed: ${error.message}`);
}

const EDIT_WINDOW_MS = 15 * 60_000;

export async function editMessage(user: SessionUser, messageId: string, body: string) {
  const clean = normalizeBody(stripHtml(body));
  if (!clean) throw new UserFacingError("A message can't be empty.");
  if (clean.length > 10_000) throw new UserFacingError("Messages can be up to 10,000 characters.");
  const supabase = await createClient();
  const { data: existing } = await supabase.from("messages").select("sender_id, created_at, deleted_at").eq("id", messageId).maybeSingle();
  const row = existing as { sender_id: string; created_at: string; deleted_at: string | null } | null;
  if (!row || row.sender_id !== user.id || row.deleted_at) throw new UserFacingError("You can only edit your own messages.");
  if (Date.now() - Date.parse(row.created_at) > EDIT_WINDOW_MS) throw new UserFacingError("Messages can be edited for 15 minutes after sending.");
  const { error } = await supabase.from("messages").update({ body: clean }).eq("id", messageId).eq("sender_id", user.id);
  if (error) throw new Error(`message edit failed: ${error.message}`);
}

export async function deleteOwnMessage(user: SessionUser, messageId: string) {
  const supabase = await createClient();
  const { error, data } = await supabase
    .from("messages")
    .update({ deleted_at: new Date().toISOString(), body: "Message deleted" })
    .eq("id", messageId)
    .eq("sender_id", user.id)
    .is("deleted_at", null)
    .select("id");
  if (error) throw new Error(`message delete failed: ${error.message}`);
  if (!data?.length) throw new UserFacingError("You can only delete your own messages.");
}

/** Moderator removal (admins). Keeps an audit trail of the original text. */
export async function removeMessageAsModerator(actor: SessionUser, messageId: string, reason: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("messages").select("id, conversation_id, sender_id, body, deleted_at").eq("id", messageId).maybeSingle();
  const row = data as { id: string; conversation_id: string; sender_id: string | null; body: string; deleted_at: string | null } | null;
  if (!row) throw new UserFacingError("Message not found.");
  if (row.deleted_at) return;
  const { error } = await admin
    .from("messages")
    .update({ deleted_at: new Date().toISOString(), body: "Removed by a moderator" })
    .eq("id", messageId);
  if (error) throw new Error(`message removal failed: ${error.message}`);
  await audit({
    actor,
    action: "message.removed",
    entityType: "message",
    entityId: messageId,
    summary: reason,
    metadata: { conversation_id: row.conversation_id, sender_id: row.sender_id, original_preview: previewText(row.body, 200) },
  });
}

export async function startConversation(otherUserId: string, courseId?: string | null): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_direct_conversation", {
    p_other: otherUserId,
    ...(courseId ? { p_course: courseId } : {}),
  });
  if (error || !data) {
    if (error?.code === "42501" || /cannot message/i.test(error?.message ?? "")) {
      throw new UserFacingError("You can't message this person. Students can message the instructors of their courses.");
    }
    throw new Error(`start_direct_conversation failed: ${error?.message}`);
  }
  return data as string;
}

export interface Contact {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: PersonRole;
  context: string | null;
}

export async function listContacts(search: string): Promise<Contact[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_message_contacts", { p_search: search.trim() || undefined, p_limit: 30 });
  if (error) throw new Error(`list_message_contacts failed: ${error.message}`);
  return ((data ?? []) as { user_id: string; full_name: string; avatar_url: string | null; role: PersonRole; context: string | null }[]).map(
    (r) => ({ id: r.user_id, name: r.full_name, avatarUrl: r.avatar_url, role: r.role, context: r.context }),
  );
}

export interface MessageSearchHit {
  messageId: string;
  conversationId: string;
  senderId: string | null;
  senderName: string;
  body: string;
  createdAt: string;
  otherName: string | null;
}

export async function searchMessages(query: string): Promise<MessageSearchHit[]> {
  const q = query.trim().slice(0, 120);
  if (q.length < 2) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_my_messages", { p_query: q, p_limit: 30 });
  if (error) throw new Error(`search_my_messages failed: ${error.message}`);
  return (
    (data ?? []) as {
      message_id: string;
      conversation_id: string;
      sender_id: string | null;
      sender_name: string;
      body: string;
      created_at: string;
      other_name: string | null;
    }[]
  ).map((r) => ({
    messageId: r.message_id,
    conversationId: r.conversation_id,
    senderId: r.sender_id,
    senderName: r.sender_name,
    body: r.body,
    createdAt: r.created_at,
    otherName: r.other_name,
  }));
}
