import { describe, expect, it } from "vitest";
import { countUnread, firstUnreadIndex, isConversationUnread } from "@/components/communication/lib/unread";
import { debounceBucket, discussionReplyEmailKey, messageEmailKey, shouldEmailRecipient } from "@/components/communication/lib/email-bucket";

const me = "me";
const other = "other";

describe("unread", () => {
  const messages = [
    { created_at: "2026-11-14T10:00:00Z", sender_id: other },
    { created_at: "2026-11-14T10:05:00Z", sender_id: me },
    { created_at: "2026-11-14T10:10:00Z", sender_id: other },
    { created_at: "2026-11-14T10:12:00Z", sender_id: other, deleted_at: "2026-11-14T10:13:00Z" },
  ];

  it("counts other people's messages after last read, ignoring deleted ones", () => {
    expect(countUnread(messages, "2026-11-14T10:01:00Z", me)).toBe(1);
    expect(countUnread(messages, null, me)).toBe(2);
    expect(countUnread(messages, "2026-11-14T11:00:00Z", me)).toBe(0);
  });

  it("finds the first unread message", () => {
    expect(firstUnreadIndex(messages, "2026-11-14T10:01:00Z", me)).toBe(2);
    expect(firstUnreadIndex(messages, "2026-11-14T11:00:00Z", me)).toBe(-1);
  });

  it("treats a conversation as unread only when someone else spoke last", () => {
    expect(isConversationUnread({ lastMessageAt: "2026-11-14T10:10:00Z", lastMessageSenderId: other, lastReadAt: "2026-11-14T10:00:00Z", me })).toBe(true);
    expect(isConversationUnread({ lastMessageAt: "2026-11-14T10:10:00Z", lastMessageSenderId: me, lastReadAt: null, me })).toBe(false);
    expect(isConversationUnread({ lastMessageAt: null, lastMessageSenderId: null, lastReadAt: null, me })).toBe(false);
  });
});

describe("email debounce", () => {
  it("puts times within the same 15-minute window in one bucket", () => {
    const a = new Date("2026-11-14T10:00:00Z");
    const b = new Date("2026-11-14T10:14:59Z");
    const c = new Date("2026-11-14T10:15:00Z");
    expect(debounceBucket(a)).toBe(debounceBucket(b));
    expect(debounceBucket(c)).toBe(debounceBucket(a) + 1);
    expect(messageEmailKey("conv", a)).toBe(messageEmailKey("conv", b));
    expect(messageEmailKey("conv", a)).not.toBe(messageEmailKey("conv", c));
    expect(discussionReplyEmailKey("d1", a)).toMatch(/^disc-reply:d1:\d+$/);
  });

  it("skips muted threads and recipients reading right now", () => {
    const now = new Date("2026-11-14T10:10:00Z");
    expect(shouldEmailRecipient({ lastReadAt: null, isMuted: false, now })).toBe(true);
    expect(shouldEmailRecipient({ lastReadAt: "2026-11-14T10:09:00Z", isMuted: false, now })).toBe(false);
    expect(shouldEmailRecipient({ lastReadAt: "2026-11-14T09:00:00Z", isMuted: false, now })).toBe(true);
    expect(shouldEmailRecipient({ lastReadAt: null, isMuted: true, now })).toBe(false);
  });
});
