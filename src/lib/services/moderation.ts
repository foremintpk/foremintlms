import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserFacingError } from "@/lib/actions";
import { escapeLike } from "@/lib/list-params";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/services/notifications";
import type { SessionUser } from "@/lib/auth/session";
import { cardFor, getProfileCards, removeMessageAsModerator, type ProfileCard } from "@/lib/services/messaging";
import { previewText } from "@/components/communication/lib/text";

export type ReportTarget = "discussion" | "reply" | "message" | "review";
export type ReportStatus = "open" | "dismissed" | "actioned";

export interface ReportItem {
  id: string;
  targetType: ReportTarget;
  targetId: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  createdAt: string;
  reviewedAt: string | null;
  reporter: ProfileCard | null;
  reviewer: ProfileCard | null;
  course: { id: string; title: string; slug: string } | null;
  target: {
    exists: boolean;
    author: ProfileCard | null;
    title: string | null;
    excerpt: string;
    status: string | null;
    /** Where a moderator can see the content in context. */
    href: string | null;
  };
}

interface ReportRow {
  id: string;
  reporter_id: string | null;
  course_id: string | null;
  target_type: ReportTarget;
  target_id: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface TargetInfo {
  authorId: string | null;
  title: string | null;
  body: string;
  status: string | null;
  href: string | null;
}

async function loadTargets(rows: ReportRow[], courseSlugs: Map<string, string>): Promise<Map<string, TargetInfo>> {
  const admin = createAdminClient();
  const ids = (type: ReportTarget) => [...new Set(rows.filter((r) => r.target_type === type).map((r) => r.target_id))];
  const out = new Map<string, TargetInfo>();

  const discussionIds = ids("discussion");
  const replyIds = ids("reply");
  const messageIds = ids("message");
  const reviewIds = ids("review");

  const [discussions, replies, messages, reviews] = await Promise.all([
    discussionIds.length
      ? admin.from("course_discussions").select("id, course_id, author_id, title, body, status").in("id", discussionIds)
      : Promise.resolve({ data: [] }),
    replyIds.length
      ? admin.from("discussion_replies").select("id, course_id, discussion_id, author_id, body, status").in("id", replyIds)
      : Promise.resolve({ data: [] }),
    messageIds.length
      ? admin.from("messages").select("id, conversation_id, sender_id, body, deleted_at").in("id", messageIds)
      : Promise.resolve({ data: [] }),
    reviewIds.length
      ? admin.from("course_reviews").select("id, course_id, user_id, title, body, rating, status").in("id", reviewIds)
      : Promise.resolve({ data: [] }),
  ]);

  for (const d of (discussions.data ?? []) as { id: string; course_id: string; author_id: string | null; title: string; body: string; status: string }[]) {
    const slug = courseSlugs.get(d.course_id);
    out.set(`discussion:${d.id}`, {
      authorId: d.author_id,
      title: d.title,
      body: d.body,
      status: d.status,
      href: slug ? `/learn/courses/${slug}/discussions/${d.id}` : null,
    });
  }
  for (const r of (replies.data ?? []) as { id: string; course_id: string; discussion_id: string; author_id: string | null; body: string; status: string }[]) {
    const slug = courseSlugs.get(r.course_id);
    out.set(`reply:${r.id}`, {
      authorId: r.author_id,
      title: null,
      body: r.body,
      status: r.status,
      href: slug ? `/learn/courses/${slug}/discussions/${r.discussion_id}#reply-${r.id}` : null,
    });
  }
  for (const m of (messages.data ?? []) as { id: string; conversation_id: string; sender_id: string | null; body: string; deleted_at: string | null }[]) {
    out.set(`message:${m.id}`, {
      authorId: m.sender_id,
      title: null,
      body: m.body,
      status: m.deleted_at ? "removed" : "visible",
      href: `/admin/messages/${m.conversation_id}#message-${m.id}`,
    });
  }
  for (const r of (reviews.data ?? []) as { id: string; course_id: string; user_id: string; title: string | null; body: string | null; rating: number; status: string }[]) {
    out.set(`review:${r.id}`, {
      authorId: r.user_id,
      title: r.title ?? `${r.rating}-star review`,
      body: r.body ?? "",
      status: r.status,
      href: `/admin/reviews?status=${r.status}`,
    });
  }
  return out;
}

export async function listReports(opts: { status: ReportStatus | "all"; from: number; to: number }): Promise<{ items: ReportItem[]; total: number }> {
  const supabase = await createClient();
  let query = supabase
    .from("content_reports")
    .select("id, reporter_id, course_id, target_type, target_id, reason, details, status, reviewed_by, reviewed_at, created_at", { count: "exact" });
  if (opts.status !== "all") query = query.eq("status", opts.status);
  const { data, count, error } = await query.order("created_at", { ascending: opts.status === "open" }).range(opts.from, opts.to);
  if (error) throw new Error(`reports query failed: ${error.message}`);
  const rows = (data ?? []) as ReportRow[];

  const courseIds = [...new Set(rows.map((r) => r.course_id).filter((v): v is string => Boolean(v)))];
  const { data: courseData } = courseIds.length
    ? await createAdminClient().from("courses").select("id, title, slug").in("id", courseIds)
    : { data: [] };
  const courses = new Map(((courseData ?? []) as { id: string; title: string; slug: string }[]).map((c) => [c.id, c]));
  const targets = await loadTargets(rows, new Map([...courses.values()].map((c) => [c.id, c.slug])));
  const cards = await getProfileCards([...rows.flatMap((r) => [r.reporter_id, r.reviewed_by]), ...[...targets.values()].map((t) => t.authorId)]);

  return {
    total: count ?? 0,
    items: rows.map((r) => {
      const t = targets.get(`${r.target_type}:${r.target_id}`);
      return {
        id: r.id,
        targetType: r.target_type,
        targetId: r.target_id,
        reason: r.reason,
        details: r.details,
        status: r.status,
        createdAt: r.created_at,
        reviewedAt: r.reviewed_at,
        reporter: r.reporter_id ? cardFor(cards, r.reporter_id) : null,
        reviewer: r.reviewed_by ? cardFor(cards, r.reviewed_by) : null,
        course: r.course_id ? courses.get(r.course_id) ?? null : null,
        target: t
          ? { exists: true, author: t.authorId ? cardFor(cards, t.authorId) : null, title: t.title, excerpt: previewText(t.body, 400), status: t.status, href: t.href }
          : { exists: false, author: null, title: null, excerpt: "", status: null, href: null },
      };
    }),
  };
}

export type ReportDecision = "dismiss" | "hide" | "remove";

/** Resolve a report and apply the decision to the reported content. */
export async function resolveReport(actor: SessionUser, reportId: string, decision: ReportDecision, note?: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("content_reports").select("id, target_type, target_id, status").eq("id", reportId).maybeSingle();
  const report = data as { id: string; target_type: ReportTarget; target_id: string; status: ReportStatus } | null;
  if (!report) throw new UserFacingError("Report not found.");

  if (decision !== "dismiss") {
    const status = decision === "hide" ? "hidden" : "removed";
    const supabase = await createClient();
    if (report.target_type === "discussion") {
      const { error } = await supabase.from("course_discussions").update({ status }).eq("id", report.target_id);
      if (error) throw new Error(`discussion moderation failed: ${error.message}`);
    } else if (report.target_type === "reply") {
      const { error } = await supabase.from("discussion_replies").update({ status }).eq("id", report.target_id);
      if (error) throw new Error(`reply moderation failed: ${error.message}`);
    } else if (report.target_type === "message") {
      await removeMessageAsModerator(actor, report.target_id, note || "Removed after a report");
    } else if (report.target_type === "review") {
      const { error } = await supabase
        .from("course_reviews")
        .update({ status: "rejected", moderated_by: actor.id, moderated_at: new Date().toISOString(), moderation_note: note ?? "Removed after a report" })
        .eq("id", report.target_id);
      if (error) throw new Error(`review moderation failed: ${error.message}`);
    }
  }

  // Close every open report about the same content.
  const { error } = await admin
    .from("content_reports")
    .update({ status: decision === "dismiss" ? "dismissed" : "actioned", reviewed_by: actor.id, reviewed_at: new Date().toISOString() })
    .eq("target_type", report.target_type)
    .eq("target_id", report.target_id)
    .eq("status", "open");
  if (error) throw new Error(`report update failed: ${error.message}`);

  await audit({
    actor,
    action: `report.${decision}`,
    entityType: report.target_type,
    entityId: report.target_id,
    summary: note,
    metadata: { report_id: reportId },
  });
}

export interface AdminDiscussionRow {
  id: string;
  title: string;
  kind: string;
  status: string;
  isPinned: boolean;
  isLocked: boolean;
  isResolved: boolean;
  replyCount: number;
  lastActivityAt: string;
  author: ProfileCard;
  course: { id: string; title: string; slug: string } | null;
}

export async function listAllDiscussions(opts: {
  q?: string;
  status?: string;
  course?: string;
  from: number;
  to: number;
}): Promise<{ items: AdminDiscussionRow[]; total: number; courses: { id: string; title: string }[] }> {
  const supabase = await createClient();
  let query = supabase
    .from("course_discussions")
    .select("id, course_id, author_id, title, kind, status, is_pinned, is_locked, is_resolved, reply_count, last_activity_at", { count: "exact" });
  if (opts.status && opts.status !== "all") query = query.eq("status", opts.status);
  if (opts.course) query = query.eq("course_id", opts.course);
  if (opts.q && opts.q.trim().length >= 2) query = query.ilike("title", `%${escapeLike(opts.q.trim())}%`);
  const { data, count, error } = await query.order("last_activity_at", { ascending: false }).range(opts.from, opts.to);
  if (error) throw new Error(`discussions query failed: ${error.message}`);
  const rows = (data ?? []) as {
    id: string;
    course_id: string;
    author_id: string | null;
    title: string;
    kind: string;
    status: string;
    is_pinned: boolean;
    is_locked: boolean;
    is_resolved: boolean;
    reply_count: number;
    last_activity_at: string;
  }[];
  const admin = createAdminClient();
  const [{ data: courseData }, cards] = await Promise.all([
    admin.from("courses").select("id, title, slug").order("title"),
    getProfileCards(rows.map((r) => r.author_id)),
  ]);
  const courses = new Map(((courseData ?? []) as { id: string; title: string; slug: string }[]).map((c) => [c.id, c]));
  return {
    total: count ?? 0,
    courses: [...courses.values()].map((c) => ({ id: c.id, title: c.title })),
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      kind: r.kind,
      status: r.status,
      isPinned: r.is_pinned,
      isLocked: r.is_locked,
      isResolved: r.is_resolved,
      replyCount: r.reply_count,
      lastActivityAt: r.last_activity_at,
      author: cardFor(cards, r.author_id),
      course: courses.get(r.course_id) ?? null,
    })),
  };
}

export type ReviewStatus = "pending" | "published" | "rejected";

export interface ReviewItem {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: ReviewStatus;
  verifiedEnrollment: boolean;
  moderationNote: string | null;
  moderatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: ProfileCard;
  course: { id: string; title: string; slug: string } | null;
}

export async function listReviews(opts: { status: ReviewStatus; q?: string; from: number; to: number }): Promise<{ items: ReviewItem[]; total: number }> {
  const supabase = await createClient();
  let query = supabase
    .from("course_reviews")
    .select("id, course_id, user_id, rating, title, body, status, verified_enrollment, moderation_note, moderated_at, created_at, updated_at", { count: "exact" })
    .eq("status", opts.status);
  if (opts.q && opts.q.trim().length >= 2) {
    const term = escapeLike(opts.q.trim());
    query = query.or(`title.ilike.%${term}%,body.ilike.%${term}%`);
  }
  const { data, count, error } = await query.order(opts.status === "pending" ? "updated_at" : "moderated_at", { ascending: opts.status === "pending" }).range(opts.from, opts.to);
  if (error) throw new Error(`reviews query failed: ${error.message}`);
  const rows = (data ?? []) as {
    id: string;
    course_id: string;
    user_id: string;
    rating: number;
    title: string | null;
    body: string | null;
    status: ReviewStatus;
    verified_enrollment: boolean;
    moderation_note: string | null;
    moderated_at: string | null;
    created_at: string;
    updated_at: string;
  }[];
  const courseIds = [...new Set(rows.map((r) => r.course_id))];
  const [{ data: courseData }, cards] = await Promise.all([
    courseIds.length ? createAdminClient().from("courses").select("id, title, slug").in("id", courseIds) : Promise.resolve({ data: [] }),
    getProfileCards(rows.map((r) => r.user_id)),
  ]);
  const courses = new Map(((courseData ?? []) as { id: string; title: string; slug: string }[]).map((c) => [c.id, c]));
  return {
    total: count ?? 0,
    items: rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      status: r.status,
      verifiedEnrollment: r.verified_enrollment,
      moderationNote: r.moderation_note,
      moderatedAt: r.moderated_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      author: cardFor(cards, r.user_id),
      course: courses.get(r.course_id) ?? null,
    })),
  };
}

export async function reviewCounts(): Promise<Record<ReviewStatus, number>> {
  const supabase = await createClient();
  const statuses: ReviewStatus[] = ["pending", "published", "rejected"];
  const results = await Promise.all(
    statuses.map((s) => supabase.from("course_reviews").select("id", { count: "exact", head: true }).eq("status", s)),
  );
  return Object.fromEntries(statuses.map((s, i) => [s, results[i].count ?? 0])) as Record<ReviewStatus, number>;
}

export async function moderateReview(
  actor: SessionUser,
  reviewId: string,
  decision: "publish" | "reject",
  note?: string,
): Promise<{ courseId: string }> {
  const supabase = await createClient();
  const status: ReviewStatus = decision === "publish" ? "published" : "rejected";
  const { data, error } = await supabase
    .from("course_reviews")
    .update({ status, moderated_by: actor.id, moderated_at: new Date().toISOString(), moderation_note: note?.trim() || null })
    .eq("id", reviewId)
    .select("id, user_id, course_id");
  if (error) throw new Error(`review moderation failed: ${error.message}`);
  const row = (data?.[0] ?? null) as { id: string; user_id: string; course_id: string } | null;
  if (!row) throw new UserFacingError("Review not found.");
  await audit({ actor, action: `review.${decision}`, entityType: "course_review", entityId: reviewId, summary: note, metadata: { course_id: row.course_id } });
  if (decision === "reject" && note?.trim()) {
    await notify(row.user_id, {
      category: "learning",
      type: "review_rejected",
      title: "Your course review wasn't published",
      body: note.trim().slice(0, 300),
    });
  }
  return { courseId: row.course_id };
}

export interface ReportedConversation {
  conversationId: string;
  openReports: number;
  lastReportedAt: string;
  participants: ProfileCard[];
}

/** Conversations that contain reported messages (moderation entry point). */
export async function listReportedConversations(): Promise<ReportedConversation[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("content_reports")
    .select("target_id, created_at, status")
    .eq("target_type", "message")
    .order("created_at", { ascending: false })
    .limit(500);
  const reports = (data ?? []) as { target_id: string; created_at: string; status: ReportStatus }[];
  if (!reports.length) return [];
  const { data: msgs } = await admin.from("messages").select("id, conversation_id").in("id", [...new Set(reports.map((r) => r.target_id))]);
  const convOf = new Map(((msgs ?? []) as { id: string; conversation_id: string }[]).map((m) => [m.id, m.conversation_id]));
  const byConv = new Map<string, { open: number; last: string }>();
  for (const r of reports) {
    const conv = convOf.get(r.target_id);
    if (!conv) continue;
    const entry = byConv.get(conv) ?? { open: 0, last: r.created_at };
    if (r.status === "open") entry.open += 1;
    if (r.created_at > entry.last) entry.last = r.created_at;
    byConv.set(conv, entry);
  }
  const convIds = [...byConv.keys()];
  if (!convIds.length) return [];
  const { data: parts } = await admin.from("conversation_participants").select("conversation_id, user_id").in("conversation_id", convIds);
  const partRows = (parts ?? []) as { conversation_id: string; user_id: string }[];
  const cards = await getProfileCards(partRows.map((p) => p.user_id));
  return convIds
    .map((id) => ({
      conversationId: id,
      openReports: byConv.get(id)!.open,
      lastReportedAt: byConv.get(id)!.last,
      participants: partRows.filter((p) => p.conversation_id === id).map((p) => cardFor(cards, p.user_id)),
    }))
    .sort((a, b) => b.openReports - a.openReports || b.lastReportedAt.localeCompare(a.lastReportedAt));
}

export async function openReportCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase.from("content_reports").select("id", { count: "exact", head: true }).eq("status", "open");
  return count ?? 0;
}
