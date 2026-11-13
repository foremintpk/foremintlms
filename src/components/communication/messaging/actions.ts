"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { assertAdmin, assertUser } from "@/lib/auth/guards";
import { ok, runAction, type ActionResult } from "@/lib/actions";
import {
  deleteOwnMessage,
  editMessage,
  listContacts,
  loadEarlierMessages,
  loadMessage,
  markConversationRead,
  MESSAGES_BASE,
  removeMessageAsModerator,
  sendMessage,
  setConversationMuted,
  startConversation,
  type Contact,
  type ThreadMessage,
} from "@/lib/services/messaging";
import { reportContent } from "@/lib/services/discussions";

const area = z.enum(["learn", "teach", "admin"]);

export async function sendMessageAction(input: {
  conversationId: string;
  body: string;
  attachmentIds?: string[];
}): Promise<ActionResult<ThreadMessage>> {
  return runAction(async () => {
    const user = await assertUser();
    const data = z
      .object({
        conversationId: z.uuid(),
        body: z.string().max(12_000),
        attachmentIds: z.array(z.uuid()).max(5).default([]),
      })
      .parse(input);
    return ok(await sendMessage(user, data));
  });
}

export async function markReadAction(input: { conversationId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const { conversationId } = z.object({ conversationId: z.uuid() }).parse(input);
    await markConversationRead(user, conversationId);
    return ok(null);
  });
}

export async function setMutedAction(input: { conversationId: string; muted: boolean }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const data = z.object({ conversationId: z.uuid(), muted: z.boolean() }).parse(input);
    await setConversationMuted(user, data.conversationId, data.muted);
    refresh();
    return ok(null, data.muted ? "Email alerts muted for this conversation" : "Email alerts turned on");
  });
}

export async function editMessageAction(input: { messageId: string; body: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const data = z.object({ messageId: z.uuid(), body: z.string().max(12_000) }).parse(input);
    await editMessage(user, data.messageId, data.body);
    return ok(null, "Message updated");
  });
}

export async function deleteMessageAction(input: { messageId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const { messageId } = z.object({ messageId: z.uuid() }).parse(input);
    await deleteOwnMessage(user, messageId);
    return ok(null, "Message deleted");
  });
}

export async function loadEarlierAction(input: {
  conversationId: string;
  before: string;
}): Promise<ActionResult<{ messages: ThreadMessage[]; hasMore: boolean }>> {
  return runAction(async () => {
    await assertUser();
    const data = z.object({ conversationId: z.uuid(), before: z.iso.datetime({ offset: true }) }).parse(input);
    return ok(await loadEarlierMessages(data.conversationId, data.before));
  });
}

export async function loadMessageAction(input: { messageId: string }): Promise<ActionResult<ThreadMessage | null>> {
  return runAction(async () => {
    await assertUser();
    const { messageId } = z.object({ messageId: z.uuid() }).parse(input);
    return ok(await loadMessage(messageId));
  });
}

export async function searchContactsAction(input: { q: string }): Promise<ActionResult<Contact[]>> {
  return runAction(async () => {
    await assertUser();
    const { q } = z.object({ q: z.string().max(80) }).parse(input);
    return ok(await listContacts(q));
  });
}

export async function startConversationAction(input: {
  otherUserId: string;
  area: "learn" | "teach" | "admin";
}): Promise<ActionResult<{ href: string }>> {
  return runAction(async () => {
    await assertUser();
    const data = z.object({ otherUserId: z.uuid(), area }).parse(input);
    const id = await startConversation(data.otherUserId);
    return ok({ href: `${MESSAGES_BASE[data.area]}/${id}` });
  });
}

export async function reportMessageAction(input: {
  messageId: string;
  reason: "spam" | "harassment" | "inappropriate" | "off_topic" | "other";
  details?: string;
}): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const data = z
      .object({
        messageId: z.uuid(),
        reason: z.enum(["spam", "harassment", "inappropriate", "off_topic", "other"]),
        details: z.string().max(2000).optional(),
      })
      .parse(input);
    // Only messages the reporter can read (RLS) can be reported.
    const msg = await loadMessage(data.messageId);
    if (!msg) return { ok: false, error: "Message not found." };
    await reportContent(user, { targetType: "message", targetId: data.messageId, reason: data.reason, details: data.details });
    return ok(null, "Report sent to the Foremint team");
  });
}

export async function removeMessageAction(input: { messageId: string; reason?: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = z.object({ messageId: z.uuid(), reason: z.string().trim().min(3).max(1000) }).parse(input);
    await removeMessageAsModerator(user, data.messageId, data.reason);
    refresh();
    return ok(null, "Message removed");
  });
}
