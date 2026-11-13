import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserFacingError } from "@/lib/actions";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { notify } from "@/lib/services/notifications";
import { getCourseAccess } from "@/lib/services/access";
import { getCourseRole } from "@/lib/auth/guards";
import { appUrl } from "@/lib/env";
import { stripHtml } from "@/lib/sanitize";
import { escapeLike } from "@/lib/list-params";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session";
import type { TablesUpdate } from "@/types/database";
import { cardFor, getProfileCards, type ProfileCard } from "@/lib/services/messaging";
import { discussionReplyEmailKey } from "@/components/communication/lib/email-bucket";
import { normalizeBody, previewText, sanitizeMentionIds } from "@/components/communication/lib/text";

export type DiscussionKind = "discussion" | "question" | "announcement";
export type ContentStatus = "visible" | "hidden" | "removed";
export type DiscussionFilter = "all" | "questions" | "unanswered" | "resolved" | "announcements";
export const REACTIONS = ["like", "love", "insightful", "celebrate", "thanks"] as const;
export type Reaction = (typeof REACTIONS)[number];

export interface DiscussionCourse {
  id: string;
  slug: string;
  title: string;
  discussionsEnabled: boolean;
}

export interface DiscussionContext {
  course: DiscussionCourse;
  hasAccess: boolean;
  /** Admin or assigned instructor: may pin, lock, hide and remove. */
  isStaff: boolean;
  accessReason: string;
}

/** Resolve a course by slug (RLS) and the viewer's relation to it. */
export async function getDiscussionContext(user: SessionUser, slug: string): Promise<DiscussionContext | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select("id, slug, title, status, discussions_enabled")
    .eq("slug", slug)
    .maybeSingle();
  const course = data as { id: string; slug: string; title: string; status: string; discussions_enabled: boolean } | null;
  if (!course) return null;
  const access = await getCourseAccess(user, { id: course.id, status: course.status });
  return {
    course: { id: course.id, slug: course.slug, title: course.title, discussionsEnabled: course.discussions_enabled },
    hasAccess: access.hasAccess,
    isStaff: access.isStaff,
    accessReason: access.reason,
  };
}

export interface DiscussionSummary {
  id: string;
  courseId: string;
  lessonId: string | null;
  lessonTitle: string | null;
  author: ProfileCard;
  title: string;
  preview: string;
  kind: DiscussionKind;
  isPinned: boolean;
  isLocked: boolean;
  isResolved: boolean;
  status: ContentStatus;
  replyCount: number;
  answeredAt: string | null;
  lastActivityAt: string;
  createdAt: string;
}

interface DiscussionRow {
  id: string;
  course_id: string;
  lesson_id: string | null;
  author_id: string | null;
  title: string;
  body: string;
  kind: DiscussionKind;
  is_pinned: boolean;
  is_locked: boolean;
  is_resolved: boolean;
  status: ContentStatus;
  mentions: string[];
  reply_count: number;
  answered_at: string | null;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}

const DISCUSSION_COLUMNS =
  "id, course_id, lesson_id, author_id, title, body, kind, is_pinned, is_locked, is_resolved, status, mentions, reply_count, answered_at, last_activity_at, created_at, updated_at";

async function lessonTitles(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((v): v is string => Boolean(v)))];
  if (!unique.length) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.from("lessons").select("id, title").in("id", unique);
  return new Map(((data ?? []) as { id: string; title: string }[]).map((l) => [l.id, l.title]));
}

async function toSummaries(rows: DiscussionRow[]): Promise<DiscussionSummary[]> {
  const [cards, lessons] = await Promise.all([getProfileCards(rows.map((r) => r.author_id)), lessonTitles(rows.map((r) => r.lesson_id))]);
  return rows.map((r) => ({
    id: r.id,
    courseId: r.course_id,
    lessonId: r.lesson_id,
    lessonTitle: r.lesson_id ? lessons.get(r.lesson_id) ?? null : null,
    author: cardFor(cards, r.author_id),
    title: r.title,
    preview: previewText(r.body, 200),
    kind: r.kind,
    isPinned: r.is_pinned,
    isLocked: r.is_locked,
    isResolved: r.is_resolved,
    status: r.status,
    replyCount: r.reply_count,
    answeredAt: r.answered_at,
    lastActivityAt: r.last_activity_at,
    createdAt: r.created_at,
  }));
}

export async function listDiscussions(
  courseId: string,
  opts: { filter: DiscussionFilter; lessonId?: string | null; q?: string; from: number; to: number },
): Promise<{ items: DiscussionSummary[]; total: number }> {
  const supabase = await createClient();
  let query = supabase
    .from("course_discussions")
    .select(DISCUSSION_COLUMNS, { count: "exact" })
    .eq("course_id", courseId)
    .neq("status", "removed");
  if (opts.filter === "questions") query = query.eq("kind", "question");
  if (opts.filter === "unanswered") query = query.eq("kind", "question").is("answered_at", null).eq("is_resolved", false);
  if (opts.filter === "resolved") query = query.eq("is_resolved", true);
  if (opts.filter === "announcements") query = query.eq("kind", "announcement");
  if (opts.lessonId) query = query.eq("lesson_id", opts.lessonId);
  if (opts.q && opts.q.trim().length >= 2) query = query.textSearch("search_vector", opts.q.trim(), { type: "websearch", config: "simple" });
  const { data, count, error } = await query
    .order("is_pinned", { ascending: false })
    .order("last_activity_at", { ascending: false })
    .range(opts.from, opts.to);
  if (error) throw new Error(`discussions query failed: ${error.message}`);
  return { items: await toSummaries((data ?? []) as DiscussionRow[]), total: count ?? 0 };
}

export async function listLessonDiscussions(courseId: string, lessonId: string, limit = 5) {
  const supabase = await createClient();
  const { data, count } = await supabase
    .from("course_discussions")
    .select(DISCUSSION_COLUMNS, { count: "exact" })
    .eq("course_id", courseId)
    .eq("lesson_id", lessonId)
    .eq("status", "visible")
    .order("is_pinned", { ascending: false })
    .order("last_activity_at", { ascending: false })
    .limit(limit);
  return { items: await toSummaries((data ?? []) as DiscussionRow[]), total: count ?? 0 };
}

export async function listCourseLessons(courseId: string): Promise<{ id: string; title: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lessons")
    .select("id, title, sort_order, course_modules!inner(sort_order)")
    .eq("course_id", courseId)
    .eq("is_published", true)
    .order("sort_order", { ascending: true });
  const rows = (data ?? []) as unknown as { id: string; title: string; sort_order: number; course_modules: { sort_order: number } }[];
  return rows
    .sort((a, b) => a.course_modules.sort_order - b.course_modules.sort_order || a.sort_order - b.sort_order)
    .map((l) => ({ id: l.id, title: l.title }));
}

export type ReactionCounts = Partial<Record<Reaction, number>>;

export interface ThreadReply {
  id: string;
  parentReplyId: string | null;
  author: ProfileCard;
  body: string;
  isInstructorAnswer: boolean;
  isAcceptedAnswer: boolean;
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
  reactions: ReactionCounts;
  myReactions: Reaction[];
  children: ThreadReply[];
}

export interface ThreadDetail {
  discussion: DiscussionSummary & { body: string; updatedAt: string; reactions: ReactionCounts; myReactions: Reaction[] };
  replies: ThreadReply[];
}

interface ReplyRow {
  id: string;
  discussion_id: string;
  parent_reply_id: string | null;
  author_id: string | null;
  body: string;
  is_instructor_answer: boolean;
  is_accepted_answer: boolean;
  status: ContentStatus;
  created_at: string;
  updated_at: string;
}

export async function getThread(user: SessionUser, courseId: string, discussionId: string): Promise<ThreadDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("course_discussions")
    .select(DISCUSSION_COLUMNS)
    .eq("id", discussionId)
    .eq("course_id", courseId)
    .maybeSingle();
  const row = data as DiscussionRow | null;
  if (!row || row.status === "removed") return null;

  type ReactionRow = { user_id: string; discussion_id: string | null; reply_id: string | null; emoji: Reaction };
  const [{ data: replyData }, { data: discussionReactionData }] = await Promise.all([
    supabase
      .from("discussion_replies")
      .select("id, discussion_id, parent_reply_id, author_id, body, is_instructor_answer, is_accepted_answer, status, created_at, updated_at")
      .eq("discussion_id", discussionId)
      .order("created_at", { ascending: true }),
    supabase.from("discussion_reactions").select("user_id, discussion_id, reply_id, emoji").eq("discussion_id", discussionId),
  ]);
  const replies = ((replyData ?? []) as ReplyRow[]).filter((r) => r.status !== "removed");

  let reactions = (discussionReactionData ?? []) as ReactionRow[];
  if (replies.length) {
    const { data: replyReactions } = await supabase
      .from("discussion_reactions")
      .select("user_id, discussion_id, reply_id, emoji")
      .in("reply_id", replies.map((r) => r.id));
    reactions = [...reactions, ...((replyReactions ?? []) as ReactionRow[])];
  }

  const summarize = (filter: (r: (typeof reactions)[number]) => boolean) => {
    const counts: ReactionCounts = {};
    const mine: Reaction[] = [];
    for (const r of reactions.filter(filter)) {
      counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
      if (r.user_id === user.id) mine.push(r.emoji);
    }
    return { counts, mine };
  };

  const [summary] = await toSummaries([row]);
  const cards = await getProfileCards(replies.map((r) => r.author_id));
  const discussionReactions = summarize((r) => r.discussion_id === row.id);

  const byId = new Map<string, ThreadReply>();
  for (const r of replies) {
    const rx = summarize((x) => x.reply_id === r.id);
    byId.set(r.id, {
      id: r.id,
      parentReplyId: r.parent_reply_id,
      author: cardFor(cards, r.author_id),
      body: r.body,
      isInstructorAnswer: r.is_instructor_answer,
      isAcceptedAnswer: r.is_accepted_answer,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      reactions: rx.counts,
      myReactions: rx.mine,
      children: [],
    });
  }
  const roots: ThreadReply[] = [];
  for (const reply of byId.values()) {
    const parent = reply.parentReplyId ? byId.get(reply.parentReplyId) : null;
    if (parent) parent.children.push(reply);
    else roots.push(reply);
  }
  // Accepted answer first, then chronological.
  roots.sort((a, b) => Number(b.isAcceptedAnswer) - Number(a.isAcceptedAnswer) || a.createdAt.localeCompare(b.createdAt));

  return {
    discussion: {
      ...summary,
      body: row.body,
      updatedAt: row.updated_at,
      reactions: discussionReactions.counts,
      myReactions: discussionReactions.mine,
    },
    replies: roots,
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

async function courseMemberIds(courseId: string): Promise<Set<string>> {
  const admin = createAdminClient();
  const [enrolled, instructors] = await Promise.all([
    admin.from("enrollments").select("user_id").eq("course_id", courseId).in("status", ["active", "completed"]),
    admin.from("course_instructors").select("user_id").eq("course_id", courseId),
  ]);
  return new Set(
    [...((enrolled.data ?? []) as { user_id: string }[]), ...((instructors.data ?? []) as { user_id: string }[])].map((r) =>
      r.user_id.toLowerCase(),
    ),
  );
}

async function courseInfo(courseId: string) {
  const { data } = await createAdminClient().from("courses").select("id, slug, title").eq("id", courseId).single();
  return data as { id: string; slug: string; title: string };
}

function threadUrl(slug: string, discussionId: string) {
  return `/learn/courses/${slug}/discussions/${discussionId}`;
}

function cleanBody(body: string, max = 20_000): string {
  const clean = normalizeBody(stripHtml(body));
  if (!clean) throw new UserFacingError("Write something first.");
  if (clean.length > max) throw new UserFacingError(`Posts can be up to ${max.toLocaleString("en-US")} characters.`);
  return clean;
}

async function notifyMentions(user: SessionUser, courseId: string, mentionIds: string[], url: string, body: string, key: string) {
  if (!mentionIds.length) return;
  const course = await courseInfo(courseId);
  const author = user.fullName || user.displayName;
  await notify(mentionIds, {
    category: "discussions",
    type: "mention",
    title: `${author} mentioned you in ${course.title}`,
    body: previewText(body, 160),
    url,
    email: {
      templateKey: "communication.mention",
      idempotencyKey: key,
      payload: { author_name: author, course_title: course.title, preview: previewText(body, 180), cta_url: appUrl(url) },
    },
  });
}

export interface CreateDiscussionInput {
  courseId: string;
  title: string;
  body: string;
  kind: DiscussionKind;
  lessonId?: string | null;
  isPinned?: boolean;
  mentionIds: string[];
}

export async function createDiscussion(user: SessionUser, input: CreateDiscussionInput): Promise<{ id: string; url: string }> {
  await enforceRateLimit("discussion-create", 10, 600, user.id);
  const role = await getCourseRole(user, input.courseId);
  const isStaff = role.isAdmin || role.isInstructor;
  if (input.kind === "announcement" && !isStaff) throw new UserFacingError("Only course staff can post announcements.");
  const title = input.title.replace(/\s+/g, " ").trim();
  if (title.length < 3) throw new UserFacingError("Give your post a short title.");
  const body = cleanBody(input.body);
  const members = await courseMemberIds(input.courseId);
  const mentions = sanitizeMentionIds(input.mentionIds, members, user.id);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("course_discussions")
    .insert({
      course_id: input.courseId,
      lesson_id: input.lessonId ?? null,
      author_id: user.id,
      title: title.slice(0, 200),
      body,
      kind: input.kind,
      is_pinned: isStaff ? Boolean(input.isPinned) : false,
      mentions,
    })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "42501") throw new UserFacingError("You can't post in this course's discussions.");
    throw new Error(`discussion insert failed: ${error?.message}`);
  }
  const id = (data as { id: string }).id;
  const course = await courseInfo(input.courseId);
  const url = threadUrl(course.slug, id);
  await notifyMentions(user, input.courseId, mentions, url, body, `mention:discussion:${id}`);

  // Instructors hear about new questions in their courses.
  if (input.kind === "question" && !isStaff) {
    const { data: instructors } = await createAdminClient().from("course_instructors").select("user_id").eq("course_id", input.courseId);
    const ids = ((instructors ?? []) as { user_id: string }[]).map((i) => i.user_id).filter((i) => i !== user.id);
    if (ids.length) {
      await notify(ids, {
        category: "discussions",
        type: "new_question",
        title: `New question in ${course.title}`,
        body: title,
        url,
      });
    }
  }
  return { id, url };
}

export interface CreateReplyInput {
  discussionId: string;
  parentReplyId?: string | null;
  body: string;
  mentionIds: string[];
}

export async function createReply(user: SessionUser, input: CreateReplyInput): Promise<{ id: string }> {
  await enforceRateLimit("discussion-reply", 30, 600, user.id);
  const supabase = await createClient();
  const { data: d } = await supabase
    .from("course_discussions")
    .select("id, course_id, author_id, title, is_locked, status")
    .eq("id", input.discussionId)
    .maybeSingle();
  const discussion = d as { id: string; course_id: string; author_id: string | null; title: string; is_locked: boolean; status: string } | null;
  if (!discussion || discussion.status !== "visible") throw new UserFacingError("This discussion isn't available.");
  const role = await getCourseRole(user, discussion.course_id);
  const isStaff = role.isAdmin || role.isInstructor;
  if (discussion.is_locked && !isStaff) throw new UserFacingError("This discussion is locked.");

  // One level of nesting: replies to a nested reply attach to its parent.
  let parentId: string | null = null;
  if (input.parentReplyId) {
    const { data: p } = await supabase
      .from("discussion_replies")
      .select("id, parent_reply_id, discussion_id")
      .eq("id", input.parentReplyId)
      .maybeSingle();
    const parent = p as { id: string; parent_reply_id: string | null; discussion_id: string } | null;
    if (!parent || parent.discussion_id !== discussion.id) throw new UserFacingError("The reply you answered no longer exists.");
    parentId = parent.parent_reply_id ?? parent.id;
  }

  const body = cleanBody(input.body);
  const members = await courseMemberIds(discussion.course_id);
  const mentions = sanitizeMentionIds(input.mentionIds, members, user.id);
  const { data, error } = await supabase
    .from("discussion_replies")
    .insert({
      discussion_id: discussion.id,
      course_id: discussion.course_id,
      parent_reply_id: parentId,
      author_id: user.id,
      body,
      mentions,
    })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "42501") throw new UserFacingError("You can't reply in this discussion.");
    throw new Error(`reply insert failed: ${error?.message}`);
  }
  const replyId = (data as { id: string }).id;
  const course = await courseInfo(discussion.course_id);
  const url = threadUrl(course.slug, discussion.id);

  // Notify the thread author and earlier participants (not mentioned users —
  // they get the mention notification instead).
  const { data: participants } = await createAdminClient()
    .from("discussion_replies")
    .select("author_id")
    .eq("discussion_id", discussion.id)
    .eq("status", "visible");
  const recipients = new Set<string>();
  if (discussion.author_id) recipients.add(discussion.author_id);
  for (const p of (participants ?? []) as { author_id: string | null }[]) if (p.author_id) recipients.add(p.author_id);
  recipients.delete(user.id);
  for (const m of mentions) recipients.delete(m);
  const author = user.fullName || user.displayName;
  if (recipients.size) {
    await notify([...recipients], {
      category: "discussions",
      type: "discussion_reply",
      title: `${author} replied to “${discussion.title}”`,
      body: previewText(body, 160),
      url,
      email: {
        templateKey: "communication.discussion_reply",
        idempotencyKey: discussionReplyEmailKey(discussion.id, new Date()),
        payload: {
          author_name: author,
          discussion_title: discussion.title,
          course_title: course.title,
          preview: previewText(body, 180),
          cta_url: appUrl(url),
        },
      },
    });
  }
  await notifyMentions(user, discussion.course_id, mentions, url, body, `mention:reply:${replyId}`);
  return { id: replyId };
}

export async function editDiscussion(user: SessionUser, discussionId: string, input: { title: string; body: string }) {
  const title = input.title.replace(/\s+/g, " ").trim();
  if (title.length < 3) throw new UserFacingError("Give your post a short title.");
  const body = cleanBody(input.body);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("course_discussions")
    .update({ title: title.slice(0, 200), body })
    .eq("id", discussionId)
    .select("id");
  if (error) throw new Error(`discussion edit failed: ${error.message}`);
  if (!data?.length) throw new UserFacingError("You can only edit your own posts.");
}

export async function editReply(user: SessionUser, replyId: string, bodyInput: string) {
  const body = cleanBody(bodyInput);
  const supabase = await createClient();
  const { data: existing } = await supabase.from("discussion_replies").select("author_id").eq("id", replyId).maybeSingle();
  if (!existing || (existing as { author_id: string | null }).author_id !== user.id) throw new UserFacingError("You can only edit your own replies.");
  const { error } = await supabase.from("discussion_replies").update({ body }).eq("id", replyId);
  if (error) throw new Error(`reply edit failed: ${error.message}`);
}

export async function deleteDiscussion(user: SessionUser, discussionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("course_discussions").delete().eq("id", discussionId).select("id, course_id");
  if (error) throw new Error(`discussion delete failed: ${error.message}`);
  if (!data?.length) throw new UserFacingError("You can only delete your own posts.");
}

export async function deleteReply(user: SessionUser, replyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("discussion_replies").delete().eq("id", replyId).select("id");
  if (error) throw new Error(`reply delete failed: ${error.message}`);
  if (!data?.length) throw new UserFacingError("You can only delete your own replies.");
}

export async function toggleReaction(
  user: SessionUser,
  input: { courseId: string; discussionId?: string | null; replyId?: string | null; emoji: Reaction },
): Promise<{ active: boolean }> {
  await enforceRateLimit("discussion-react", 120, 600, user.id);
  if (Boolean(input.discussionId) === Boolean(input.replyId)) throw new UserFacingError("Choose one post to react to.");
  const supabase = await createClient();
  let existing = supabase.from("discussion_reactions").select("id").eq("user_id", user.id).eq("emoji", input.emoji);
  existing = input.discussionId ? existing.eq("discussion_id", input.discussionId) : existing.eq("reply_id", input.replyId!);
  const { data } = await existing.maybeSingle();
  if (data) {
    await supabase.from("discussion_reactions").delete().eq("id", (data as { id: string }).id);
    return { active: false };
  }
  const { error } = await supabase.from("discussion_reactions").insert({
    user_id: user.id,
    course_id: input.courseId,
    discussion_id: input.discussionId ?? null,
    reply_id: input.replyId ?? null,
    emoji: input.emoji,
  });
  if (error) {
    if (error.code === "23505") return { active: true };
    if (error.code === "42501") throw new UserFacingError("You can't react in this course.");
    throw new Error(`reaction insert failed: ${error.message}`);
  }
  return { active: true };
}

export async function acceptAnswer(user: SessionUser, replyId: string, accept: boolean) {
  const supabase = await createClient();
  const { data } = await supabase.from("discussion_replies").select("id, discussion_id, author_id").eq("id", replyId).maybeSingle();
  const reply = data as { id: string; discussion_id: string; author_id: string | null } | null;
  if (!reply) throw new UserFacingError("Reply not found.");
  const { data: d } = await supabase.from("course_discussions").select("author_id, course_id, kind").eq("id", reply.discussion_id).single();
  const discussion = d as { author_id: string | null; course_id: string; kind: DiscussionKind };
  const role = await getCourseRole(user, discussion.course_id);
  if (discussion.author_id !== user.id && !role.isAdmin && !role.isInstructor) {
    throw new UserFacingError("Only the person who asked can accept an answer.");
  }
  if (accept) {
    await supabase
      .from("discussion_replies")
      .update({ is_accepted_answer: false })
      .eq("discussion_id", reply.discussion_id)
      .eq("is_accepted_answer", true)
      .neq("id", reply.id);
  }
  const { error } = await supabase.from("discussion_replies").update({ is_accepted_answer: accept }).eq("id", reply.id);
  if (error) throw new Error(`accept answer failed: ${error.message}`);
  if (accept && reply.author_id && reply.author_id !== user.id) {
    const course = await courseInfo(discussion.course_id);
    await notify(reply.author_id, {
      category: "discussions",
      type: "answer_accepted",
      title: "Your answer was accepted",
      url: threadUrl(course.slug, reply.discussion_id),
    });
  }
}

export type StaffDiscussionAction = "pin" | "unpin" | "lock" | "unlock" | "hide" | "unhide" | "remove" | "resolve" | "reopen";

export async function staffDiscussionAction(user: SessionUser, discussionId: string, action: StaffDiscussionAction, reason?: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("course_discussions").select("id, course_id, author_id, title").eq("id", discussionId).maybeSingle();
  const discussion = data as { id: string; course_id: string; author_id: string | null; title: string } | null;
  if (!discussion) throw new UserFacingError("Discussion not found.");
  const role = await getCourseRole(user, discussion.course_id);
  const isStaff = role.isAdmin || role.isInstructor;
  const isAuthor = discussion.author_id === user.id;
  // Authors may mark their own questions resolved; everything else is staff-only.
  if (!isStaff && !(isAuthor && (action === "resolve" || action === "reopen"))) {
    throw new UserFacingError("Only course staff can moderate discussions.");
  }
  const patch: TablesUpdate<"course_discussions"> = {
    pin: { is_pinned: true },
    unpin: { is_pinned: false },
    lock: { is_locked: true },
    unlock: { is_locked: false },
    hide: { status: "hidden" },
    unhide: { status: "visible" },
    remove: { status: "removed" },
    resolve: { is_resolved: true },
    reopen: { is_resolved: false },
  }[action];
  const { error } = await supabase.from("course_discussions").update(patch).eq("id", discussionId);
  if (error) throw new Error(`discussion moderation failed: ${error.message}`);
  if (action === "hide" || action === "remove" || action === "unhide") {
    await audit({
      actor: user,
      action: `discussion.${action}`,
      entityType: "course_discussion",
      entityId: discussionId,
      summary: reason ?? discussion.title,
      metadata: { course_id: discussion.course_id },
    });
  }
}

export async function staffReplyAction(user: SessionUser, replyId: string, action: "hide" | "unhide" | "remove", reason?: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("discussion_replies").select("id, course_id").eq("id", replyId).maybeSingle();
  const reply = data as { id: string; course_id: string } | null;
  if (!reply) throw new UserFacingError("Reply not found.");
  const role = await getCourseRole(user, reply.course_id);
  if (!role.isAdmin && !role.isInstructor) throw new UserFacingError("Only course staff can moderate replies.");
  const status = action === "unhide" ? "visible" : action === "hide" ? "hidden" : "removed";
  const { error } = await supabase.from("discussion_replies").update({ status }).eq("id", replyId);
  if (error) throw new Error(`reply moderation failed: ${error.message}`);
  await audit({ actor: user, action: `discussion_reply.${action}`, entityType: "discussion_reply", entityId: replyId, summary: reason, metadata: { course_id: reply.course_id } });
}

export type ReportReason = "spam" | "harassment" | "inappropriate" | "off_topic" | "other";

export async function reportContent(
  user: SessionUser,
  input: { targetType: "discussion" | "reply" | "message" | "review"; targetId: string; courseId?: string | null; reason: ReportReason; details?: string },
) {
  await enforceRateLimit("content-report", 10, 3600, user.id);
  const supabase = await createClient();
  const { error } = await supabase.from("content_reports").insert({
    reporter_id: user.id,
    course_id: input.courseId ?? null,
    target_type: input.targetType,
    target_id: input.targetId,
    reason: input.reason,
    details: input.details ? previewText(stripHtml(input.details), 2000) : null,
  });
  if (error) throw new Error(`report insert failed: ${error.message}`);
}

export interface MemberSuggestion {
  id: string;
  name: string;
  avatarUrl: string | null;
  isInstructor: boolean;
}

export async function searchCourseMembers(courseId: string, query: string): Promise<MemberSuggestion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("course_discussion_members", {
    p_course: courseId,
    p_search: query.trim().slice(0, 40) || undefined,
    p_limit: 8,
  });
  if (error) throw new Error(`course_discussion_members failed: ${error.message}`);
  return ((data ?? []) as { user_id: string; full_name: string; avatar_url: string | null; is_instructor: boolean }[]).map((m) => ({
    id: m.user_id,
    name: m.full_name,
    avatarUrl: m.avatar_url,
    isInstructor: m.is_instructor,
  }));
}

export interface QueueQuestion extends DiscussionSummary {
  courseSlug: string;
  courseTitle: string;
}

/** Open questions without an instructor answer across the teacher's courses. */
export async function listUnansweredQuestions(
  user: SessionUser,
  opts: { courseId?: string | null; q?: string; from: number; to: number },
): Promise<{ items: QueueQuestion[]; total: number; courses: { id: string; title: string; slug: string }[] }> {
  const admin = createAdminClient();
  const { data: assigned } = await admin
    .from("course_instructors")
    .select("course_id, courses(id, title, slug)")
    .eq("user_id", user.id);
  const courses = ((assigned ?? []) as unknown as { course_id: string; courses: { id: string; title: string; slug: string } | null }[])
    .map((a) => a.courses)
    .filter((c): c is { id: string; title: string; slug: string } => Boolean(c));
  if (!courses.length) return { items: [], total: 0, courses: [] };
  const ids = opts.courseId && courses.some((c) => c.id === opts.courseId) ? [opts.courseId] : courses.map((c) => c.id);

  const supabase = await createClient();
  let query = supabase
    .from("course_discussions")
    .select(DISCUSSION_COLUMNS, { count: "exact" })
    .in("course_id", ids)
    .eq("kind", "question")
    .eq("status", "visible")
    .eq("is_resolved", false)
    .is("answered_at", null);
  if (opts.q && opts.q.trim().length >= 2) query = query.ilike("title", `%${escapeLike(opts.q.trim())}%`);
  const { data, count } = await query.order("created_at", { ascending: true }).range(opts.from, opts.to);
  const rows = (data ?? []) as DiscussionRow[];
  const byCourse = new Map(courses.map((c) => [c.id, c]));
  const summaries = await toSummaries(rows);
  return {
    items: summaries.map((s, i) => ({
      ...s,
      preview: previewText(rows[i].body, 400),
      courseSlug: byCourse.get(s.courseId)?.slug ?? "",
      courseTitle: byCourse.get(s.courseId)?.title ?? "",
    })),
    total: count ?? 0,
    courses,
  };
}
