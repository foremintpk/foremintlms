/** Read/unread rules shared by the conversation list and the thread view. */

export interface UnreadMessage {
  created_at: string;
  sender_id: string | null;
  deleted_at?: string | null;
}

export function toTime(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const t = typeof value === "string" ? Date.parse(value) : value.getTime();
  return Number.isNaN(t) ? null : t;
}

/** Messages from other people, not deleted, newer than my last read time. */
export function countUnread(messages: UnreadMessage[], lastReadAt: string | null | undefined, me: string): number {
  const read = toTime(lastReadAt);
  return messages.filter((m) => {
    if (m.deleted_at || m.sender_id === me) return false;
    const t = toTime(m.created_at);
    return t !== null && (read === null || t > read);
  }).length;
}

/** A conversation is unread when someone else spoke after my last read. */
export function isConversationUnread(input: {
  lastMessageAt: string | null;
  lastMessageSenderId: string | null;
  lastReadAt: string | null;
  me: string;
}): boolean {
  if (!input.lastMessageAt || input.lastMessageSenderId === input.me) return false;
  const last = toTime(input.lastMessageAt);
  const read = toTime(input.lastReadAt);
  return last !== null && (read === null || last > read);
}

/** Index of the first unread message (for the "New" divider), or -1. */
export function firstUnreadIndex(messages: UnreadMessage[], lastReadAt: string | null | undefined, me: string): number {
  const read = toTime(lastReadAt);
  return messages.findIndex((m) => {
    if (m.sender_id === me || m.deleted_at) return false;
    const t = toTime(m.created_at);
    return t !== null && (read === null || t > read);
  });
}
