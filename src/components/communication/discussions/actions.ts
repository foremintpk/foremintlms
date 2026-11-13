"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { assertUser } from "@/lib/auth/guards";
import { ok, runAction, type ActionResult } from "@/lib/actions";
import {
  acceptAnswer,
  createDiscussion,
  createReply,
  deleteDiscussion,
  deleteReply,
  editDiscussion,
  editReply,
  REACTIONS,
  reportContent,
  searchCourseMembers,
  staffDiscussionAction,
  staffReplyAction,
  toggleReaction,
  type MemberSuggestion,
} from "@/lib/services/discussions";

const mentionIds = z.array(z.uuid()).max(20).default([]);
const reason = z.enum(["spam", "harassment", "inappropriate", "off_topic", "other"]);

export async function createDiscussionAction(input: {
  courseId: string;
  title: string;
  body: string;
  kind: "discussion" | "question" | "announcement";
  lessonId?: string | null;
  isPinned?: boolean;
  mentionIds?: string[];
}): Promise<ActionResult<{ id: string; url: string }>> {
  return runAction(async () => {
    const user = await assertUser();
    const data = z
      .object({
        courseId: z.uuid(),
        title: z.string().trim().min(3, "Add a title of at least 3 characters").max(200),
        body: z.string().trim().min(1, "Write your post").max(20_000),
        kind: z.enum(["discussion", "question", "announcement"]),
        lessonId: z.uuid().nullable().optional(),
        isPinned: z.boolean().optional(),
        mentionIds,
      })
      .parse(input);
    const result = await createDiscussion(user, data);
    return ok(result, data.kind === "question" ? "Question posted" : "Discussion posted");
  });
}

export async function createReplyAction(input: {
  discussionId: string;
  parentReplyId?: string | null;
  body: string;
  mentionIds?: string[];
}): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await assertUser();
    const data = z
      .object({
        discussionId: z.uuid(),
        parentReplyId: z.uuid().nullable().optional(),
        body: z.string().trim().min(1, "Write a reply").max(20_000),
        mentionIds,
      })
      .parse(input);
    const result = await createReply(user, data);
    refresh();
    return ok(result, "Reply posted");
  });
}

export async function editDiscussionAction(input: { discussionId: string; title: string; body: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const data = z
      .object({ discussionId: z.uuid(), title: z.string().trim().min(3).max(200), body: z.string().trim().min(1).max(20_000) })
      .parse(input);
    await editDiscussion(user, data.discussionId, data);
    refresh();
    return ok(null, "Post updated");
  });
}

export async function editReplyAction(input: { replyId: string; body: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const data = z.object({ replyId: z.uuid(), body: z.string().trim().min(1).max(20_000) }).parse(input);
    await editReply(user, data.replyId, data.body);
    refresh();
    return ok(null, "Reply updated");
  });
}

export async function deleteDiscussionAction(input: { discussionId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const { discussionId } = z.object({ discussionId: z.uuid() }).parse(input);
    await deleteDiscussion(user, discussionId);
    return ok(null, "Post deleted");
  });
}

export async function deleteReplyAction(input: { replyId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const { replyId } = z.object({ replyId: z.uuid() }).parse(input);
    await deleteReply(user, replyId);
    refresh();
    return ok(null, "Reply deleted");
  });
}

export async function toggleReactionAction(input: {
  courseId: string;
  discussionId?: string | null;
  replyId?: string | null;
  emoji: (typeof REACTIONS)[number];
}): Promise<ActionResult<{ active: boolean }>> {
  return runAction(async () => {
    const user = await assertUser();
    const data = z
      .object({
        courseId: z.uuid(),
        discussionId: z.uuid().nullable().optional(),
        replyId: z.uuid().nullable().optional(),
        emoji: z.enum(REACTIONS),
      })
      .parse(input);
    return ok(await toggleReaction(user, data));
  });
}

export async function acceptAnswerAction(input: { replyId: string; accept: boolean }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const data = z.object({ replyId: z.uuid(), accept: z.boolean() }).parse(input);
    await acceptAnswer(user, data.replyId, data.accept);
    refresh();
    return ok(null, data.accept ? "Answer accepted" : "Answer unmarked");
  });
}

const STAFF_MESSAGES = {
  pin: "Discussion pinned",
  unpin: "Discussion unpinned",
  lock: "Discussion locked",
  unlock: "Discussion unlocked",
  hide: "Discussion hidden",
  unhide: "Discussion visible again",
  remove: "Discussion removed",
  resolve: "Marked as resolved",
  reopen: "Marked as open",
} as const;

export async function staffDiscussionActionAction(input: {
  discussionId: string;
  action: keyof typeof STAFF_MESSAGES;
  reason?: string;
}): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const data = z
      .object({
        discussionId: z.uuid(),
        action: z.enum(["pin", "unpin", "lock", "unlock", "hide", "unhide", "remove", "resolve", "reopen"]),
        reason: z.string().max(1000).optional(),
      })
      .parse(input);
    await staffDiscussionAction(user, data.discussionId, data.action, data.reason);
    refresh();
    return ok(null, STAFF_MESSAGES[data.action]);
  });
}

export async function staffReplyActionAction(input: { replyId: string; action: "hide" | "unhide" | "remove"; reason?: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const data = z
      .object({ replyId: z.uuid(), action: z.enum(["hide", "unhide", "remove"]), reason: z.string().max(1000).optional() })
      .parse(input);
    await staffReplyAction(user, data.replyId, data.action, data.reason);
    refresh();
    return ok(null, data.action === "hide" ? "Reply hidden" : data.action === "remove" ? "Reply removed" : "Reply visible again");
  });
}

export async function reportPostAction(input: {
  targetType: "discussion" | "reply";
  targetId: string;
  courseId: string;
  reason: z.infer<typeof reason>;
  details?: string;
}): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const data = z
      .object({
        targetType: z.enum(["discussion", "reply"]),
        targetId: z.uuid(),
        courseId: z.uuid(),
        reason,
        details: z.string().max(2000).optional(),
      })
      .parse(input);
    await reportContent(user, data);
    return ok(null, "Report sent to the moderators");
  });
}

export async function searchMembersAction(input: { courseId: string; q: string }): Promise<ActionResult<MemberSuggestion[]>> {
  return runAction(async () => {
    await assertUser();
    const data = z.object({ courseId: z.uuid(), q: z.string().max(40) }).parse(input);
    return ok(await searchCourseMembers(data.courseId, data.q));
  });
}
