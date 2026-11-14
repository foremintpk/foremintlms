import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { followUpSchema, parseAdvisorConfig, type AdvisorConfig, type FollowUp } from "@/lib/domain/advisor";
import type { Tables } from "@/types/database";

/**
 * Admin reads for Admin → Course advisor. Callers must have checked
 * requireAdmin()/assertAdmin(): these use the service role (the advisor's
 * rule and log tables are admin-only).
 */

const db = () => createAdminClient();

export type IntentRow = Tables<"course_advisor_intents">;
export type KeywordRow = Tables<"course_advisor_keywords">;
export type RecommendationRow = Tables<"course_advisor_recommendations">;
export type SynonymRow = Tables<"course_advisor_synonyms">;
export type SessionRow = Tables<"course_advisor_conversation_sessions">;
export type MessageRow = Tables<"course_advisor_messages">;

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export interface AdvisorAnalytics {
  sessions: number;
  questions: number;
  fallbacks: number;
  faq_answers: number;
  top_intents: { key: string; count: number }[];
  recommended_courses: { id: string; title: string; count: number }[];
  selected_courses: { id: string; title: string; count: number }[];
  orders: number;
  paid_orders: number;
  paid_total_minor: number;
  unanswered: { question: string; count: number; last_asked: string }[];
}

export async function getAdvisorAnalytics(days: number): Promise<AdvisorAnalytics> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await db().rpc("course_advisor_analytics", { p_since: since });
  if (error) throw new Error(`advisor analytics: ${error.message}`);
  const raw = (data ?? {}) as Partial<AdvisorAnalytics>;
  return {
    sessions: Number(raw.sessions ?? 0),
    questions: Number(raw.questions ?? 0),
    fallbacks: Number(raw.fallbacks ?? 0),
    faq_answers: Number(raw.faq_answers ?? 0),
    top_intents: (raw.top_intents ?? []).map((r) => ({ key: r.key, count: Number(r.count) })),
    recommended_courses: (raw.recommended_courses ?? []).map((r) => ({ ...r, count: Number(r.count) })),
    selected_courses: (raw.selected_courses ?? []).map((r) => ({ ...r, count: Number(r.count) })),
    orders: Number(raw.orders ?? 0),
    paid_orders: Number(raw.paid_orders ?? 0),
    paid_total_minor: Number(raw.paid_total_minor ?? 0),
    unanswered: (raw.unanswered ?? []).map((r) => ({ ...r, count: Number(r.count) })),
  };
}

/** intent_key → title, for labelling analytics and logs. */
export async function intentTitles(): Promise<Map<string, string>> {
  const { data } = await db().from("course_advisor_intents").select("intent_key, title");
  return new Map((data ?? []).map((i) => [i.intent_key, i.title]));
}

// ---------------------------------------------------------------------------
// Intents
// ---------------------------------------------------------------------------

export interface IntentListItem extends IntentRow {
  keywordCount: number;
  courseCount: number;
}

export async function listIntents(): Promise<IntentListItem[]> {
  const { data, error } = await db()
    .from("course_advisor_intents")
    .select("*, course_advisor_keywords(id), course_advisor_recommendations(id)")
    .order("priority", { ascending: false })
    .order("title");
  if (error) throw new Error(`advisor intents: ${error.message}`);
  return ((data ?? []) as (IntentRow & { course_advisor_keywords: { id: string }[]; course_advisor_recommendations: { id: string }[] })[]).map(
    ({ course_advisor_keywords, course_advisor_recommendations, ...row }) => ({
      ...row,
      keywordCount: course_advisor_keywords.length,
      courseCount: course_advisor_recommendations.length,
    }),
  );
}

export interface IntentDetail {
  intent: IntentRow;
  followUp: FollowUp | null;
  keywords: KeywordRow[];
  recommendations: (RecommendationRow & { course: { id: string; title: string; status: string } | null })[];
  intentOptions: { key: string; title: string }[];
  courses: { id: string; title: string; status: string }[];
}

export async function getIntentDetail(id: string): Promise<IntentDetail | null> {
  const admin = db();
  const { data: intent } = await admin.from("course_advisor_intents").select("*").eq("id", id).maybeSingle();
  if (!intent) return null;
  const [keywords, recs, intents, courses] = await Promise.all([
    admin.from("course_advisor_keywords").select("*").eq("intent_id", id).order("weight", { ascending: false }).order("keyword"),
    admin.from("course_advisor_recommendations").select("*, courses(id, title, status)").eq("intent_id", id).order("role").order("recommendation_priority"),
    admin.from("course_advisor_intents").select("intent_key, title").order("title"),
    admin.from("courses").select("id, title, status").in("status", ["published", "unpublished"]).order("title"),
  ]);
  const fu = followUpSchema.safeParse(intent.follow_up ?? null);
  return {
    intent: intent as IntentRow,
    followUp: fu.success ? fu.data : null,
    keywords: (keywords.data ?? []) as KeywordRow[],
    recommendations: ((recs.data ?? []) as (RecommendationRow & { courses: { id: string; title: string; status: string } | null })[]).map(({ courses: course, ...r }) => ({ ...r, course })),
    intentOptions: (intents.data ?? []).map((i) => ({ key: i.intent_key, title: i.title })),
    courses: (courses.data ?? []) as { id: string; title: string; status: string }[],
  };
}

// ---------------------------------------------------------------------------
// Synonyms
// ---------------------------------------------------------------------------

export async function listSynonyms(): Promise<SynonymRow[]> {
  const { data, error } = await db().from("course_advisor_synonyms").select("*").order("term");
  if (error) throw new Error(`advisor synonyms: ${error.message}`);
  return (data ?? []) as SynonymRow[];
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export async function listSessions(opts: { from: number; to: number; status: string | null; q: string }) {
  let query = db().from("course_advisor_conversation_sessions").select("*", { count: "exact" }).order("started_at", { ascending: false });
  if (opts.status) query = query.eq("session_status", opts.status);
  if (opts.q) query = query.ilike("current_intent", `%${opts.q.replace(/[%_\\]/g, "")}%`);
  const { data, error, count } = await query.range(opts.from, opts.to);
  if (error) throw new Error(`advisor sessions: ${error.message}`);
  const rows = (data ?? []) as SessionRow[];
  const orderIds = [...new Set(rows.map((r) => r.order_id).filter(Boolean))] as string[];
  const { data: orders } = orderIds.length ? await db().from("public_course_orders").select("id, order_number, status").in("id", orderIds) : { data: [] };
  const byId = new Map((orders ?? []).map((o) => [o.id, o]));
  return { rows: rows.map((r) => ({ ...r, order: r.order_id ? byId.get(r.order_id) ?? null : null })), total: count ?? rows.length };
}

export interface SessionDetail {
  session: SessionRow;
  messages: (MessageRow & { faqQuestion: string | null; recommended: string[]; eventCourses: string[]; orderNumber: string | null })[];
  order: { id: string; order_number: string; status: string } | null;
}

export async function getSessionDetail(id: string): Promise<SessionDetail | null> {
  const admin = db();
  const { data: session } = await admin.from("course_advisor_conversation_sessions").select("*").eq("id", id).maybeSingle();
  if (!session) return null;
  const { data: msgs } = await admin.from("course_advisor_messages").select("*").eq("session_id", id).order("created_at");
  const messages = (msgs ?? []) as MessageRow[];
  const courseIds = [...new Set(messages.flatMap((m) => [...m.recommended_course_ids, ...m.event_course_ids]))];
  const faqIds = [...new Set(messages.map((m) => m.matched_faq_id).filter(Boolean))] as string[];
  const orderIds = [...new Set([session.order_id, ...messages.map((m) => m.order_id)].filter(Boolean))] as string[];
  const [courses, faqs, orders] = await Promise.all([
    courseIds.length ? admin.from("courses").select("id, title").in("id", courseIds) : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    faqIds.length ? admin.from("faqs").select("id, question").in("id", faqIds) : Promise.resolve({ data: [] as { id: string; question: string }[] }),
    orderIds.length ? admin.from("public_course_orders").select("id, order_number, status").in("id", orderIds) : Promise.resolve({ data: [] as { id: string; order_number: string; status: string }[] }),
  ]);
  const courseTitle = new Map((courses.data ?? []).map((c) => [c.id, c.title]));
  const faqQuestion = new Map((faqs.data ?? []).map((f) => [f.id, f.question]));
  const orderById = new Map((orders.data ?? []).map((o) => [o.id, o]));
  return {
    session: session as SessionRow,
    messages: messages.map((m) => ({
      ...m,
      faqQuestion: m.matched_faq_id ? faqQuestion.get(m.matched_faq_id) ?? null : null,
      recommended: m.recommended_course_ids.map((cid) => courseTitle.get(cid) ?? "Deleted course"),
      eventCourses: m.event_course_ids.map((cid) => courseTitle.get(cid) ?? "Deleted course"),
      orderNumber: m.order_id ? orderById.get(m.order_id)?.order_number ?? null : null,
    })),
    order: session.order_id ? orderById.get(session.order_id) ?? null : null,
  };
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/** Read straight from the table (not the cached settings) so the form shows what is saved. */
export async function getAdvisorAdminSettings(): Promise<{ config: AdvisorConfig; retentionDays: number }> {
  const { data } = await db().from("platform_settings").select("key, value").in("key", ["advisor.config", "advisor.log_retention_days"]);
  const byKey = new Map((data ?? []).map((r) => [r.key, r.value]));
  const retention = Number(byKey.get("advisor.log_retention_days") ?? 90);
  return { config: parseAdvisorConfig(byKey.get("advisor.config") ?? {}), retentionDays: Number.isFinite(retention) ? retention : 90 };
}
