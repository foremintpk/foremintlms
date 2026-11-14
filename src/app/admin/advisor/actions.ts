"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/guards";
import { fail, ok, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { SETTINGS_TAG } from "@/lib/settings";
import {
  advisorConfigSchema,
  clauses,
  decide,
  followUpSchema,
  isQuestionText,
  prepareKnowledge,
  scoreFaqs,
  scoreIntents,
  type AdvisorState,
} from "@/lib/domain/advisor";
import { ADVISOR_TAG, loadAdvisorKnowledge } from "@/lib/services/advisor/knowledge";
import type { Json } from "@/types/database";

/** Admin → Course advisor. Every change expires the advisor's cached rules. */

const intentKey = z.string().trim().regex(/^[a-z0-9_]{2,60}$/, "Use 2–60 lowercase letters, numbers or underscores");

function refresh(...paths: string[]) {
  updateTag(ADVISOR_TAG);
  revalidatePath("/admin/advisor", "layout");
  for (const p of paths) revalidatePath(p);
}

function dbError(error: { code?: string; message: string } | null, duplicateMessage: string): never | void {
  if (!error) return;
  if (error.code === "23505") throw new UserFacingError(duplicateMessage);
  throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Intents
// ---------------------------------------------------------------------------

const createIntentSchema = z.object({
  intent_key: intentKey,
  title: z.string().trim().min(1, "Give the intent a title").max(120),
  response: z.string().trim().min(1, "Write what the advisor says").max(1200),
});

export async function createIntentAction(input: z.input<typeof createIntentSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const data = createIntentSchema.parse(input);
    const { data: row, error } = await createAdminClient().from("course_advisor_intents").insert(data).select("id").single();
    if (error?.code === "23505") return fail("Check the highlighted fields.", { intent_key: ["That key is already used"] });
    dbError(error, "That key is already used.");
    await audit({ actor, action: "advisor.intent_created", entityType: "advisor_intent", entityId: row!.id, summary: `Created intent ${data.intent_key}` });
    refresh("/admin/advisor/intents");
    return ok({ id: row!.id }, "Intent created");
  });
}

const updateIntentSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1, "Give the intent a title").max(120),
  description: z.string().trim().max(500).nullable().optional(),
  response: z.string().trim().min(1, "Write what the advisor says").max(1200),
  priority: z.number().int().min(-100, "Use -100 to 100").max(100, "Use -100 to 100"),
  is_active: z.boolean(),
  follow_up: followUpSchema.optional(),
});

export async function updateIntentAction(input: z.input<typeof updateIntentSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const data = updateIntentSchema.parse(input);
    const admin = createAdminClient();
    if (data.follow_up) {
      const { data: keys } = await admin.from("course_advisor_intents").select("intent_key").in("intent_key", data.follow_up.options.map((o) => o.intent));
      const known = new Set((keys ?? []).map((k) => k.intent_key));
      const missing = data.follow_up.options.filter((o) => !known.has(o.intent));
      if (missing.length) return fail("Check the highlighted fields.", { follow_up: [`Unknown intent: ${missing.map((m) => m.intent).join(", ")}`] });
    }
    const { error } = await admin
      .from("course_advisor_intents")
      .update({
        title: data.title,
        description: data.description || null,
        response: data.response,
        priority: data.priority,
        is_active: data.is_active,
        ...(data.follow_up !== undefined ? { follow_up: (data.follow_up ?? null) as unknown as Json } : {}),
      })
      .eq("id", data.id);
    dbError(error, "Could not save the intent.");
    await audit({ actor, action: "advisor.intent_updated", entityType: "advisor_intent", entityId: data.id, summary: `Updated intent ${data.title}` });
    refresh("/admin/advisor/intents", `/admin/advisor/intents/${data.id}`);
    return ok(null, "Intent saved");
  });
}

export async function setIntentActiveAction(input: { id: string; active: boolean }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const { id, active } = z.object({ id: z.uuid(), active: z.boolean() }).parse(input);
    const { data, error } = await createAdminClient().from("course_advisor_intents").update({ is_active: active }).eq("id", id).select("intent_key").single();
    dbError(error, "Could not update the intent.");
    await audit({ actor, action: active ? "advisor.intent_enabled" : "advisor.intent_disabled", entityType: "advisor_intent", entityId: id, summary: data?.intent_key });
    refresh("/admin/advisor/intents", `/admin/advisor/intents/${id}`);
    return ok(null, active ? "Intent enabled" : "Intent disabled");
  });
}

export async function deleteIntentAction(input: { id: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const { id } = z.object({ id: z.uuid() }).parse(input);
    const admin = createAdminClient();
    const { data: intent } = await admin.from("course_advisor_intents").select("intent_key").eq("id", id).maybeSingle();
    if (!intent) throw new UserFacingError("Intent not found.");
    // Follow-up paths in other intents must not point at a deleted intent.
    const { data: others } = await admin.from("course_advisor_intents").select("title, follow_up").neq("id", id);
    const referencing = (others ?? []).filter((o) => {
      const fu = followUpSchema.safeParse(o.follow_up ?? null);
      return fu.success && fu.data?.options.some((opt) => opt.intent === intent.intent_key);
    });
    if (referencing.length) throw new UserFacingError(`Remove it from these follow-up questions first: ${referencing.map((r) => r.title).join(", ")}. Or disable it instead.`);
    const { error } = await admin.from("course_advisor_intents").delete().eq("id", id);
    dbError(error, "Could not delete the intent.");
    await audit({ actor, action: "advisor.intent_deleted", entityType: "advisor_intent", entityId: id, summary: `Deleted intent ${intent.intent_key}` });
    refresh("/admin/advisor/intents");
    return ok(null, "Intent deleted");
  });
}

// ---------------------------------------------------------------------------
// Keywords
// ---------------------------------------------------------------------------

const keywordSchema = z
  .object({
    intent_id: z.uuid(),
    keyword: z.string().trim().min(1, "Enter a word or phrase").max(120),
    match_type: z.enum(["keyword", "phrase", "pattern"]),
    weight: z.number().min(0.1, "Use 0.1 to 10").max(10, "Use 0.1 to 10"),
  })
  .superRefine((k, ctx) => {
    if (k.match_type === "keyword" && /\s/.test(k.keyword)) ctx.addIssue({ code: "custom", path: ["keyword"], message: "A keyword is a single word — use a phrase for several words" });
    if (k.match_type === "pattern" && !k.keyword.split(/\s+/).includes("*")) ctx.addIssue({ code: "custom", path: ["keyword"], message: "A pattern needs at least one * (e.g. build * app)" });
    if (k.match_type !== "pattern" && k.keyword.includes("*")) ctx.addIssue({ code: "custom", path: ["keyword"], message: "Only patterns can use *" });
  });

export async function addKeywordAction(input: z.input<typeof keywordSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const data = keywordSchema.parse(input);
    const { error } = await createAdminClient().from("course_advisor_keywords").insert({ ...data, keyword: data.keyword.toLowerCase() });
    if (error?.code === "23505") return fail("Check the highlighted fields.", { keyword: ["This intent already has that keyword"] });
    dbError(error, "This intent already has that keyword.");
    await audit({ actor, action: "advisor.keyword_added", entityType: "advisor_intent", entityId: data.intent_id, summary: `${data.match_type}: ${data.keyword}` });
    refresh(`/admin/advisor/intents/${data.intent_id}`);
    return ok(null, "Keyword added");
  });
}

const keywordUpdateSchema = z.object({
  id: z.uuid(),
  weight: z.number().min(0.1).max(10).optional(),
  is_active: z.boolean().optional(),
});

export async function updateKeywordAction(input: z.input<typeof keywordUpdateSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const data = keywordUpdateSchema.parse(input);
    const patch = { ...(data.weight !== undefined ? { weight: data.weight } : {}), ...(data.is_active !== undefined ? { is_active: data.is_active } : {}) };
    const { data: row, error } = await createAdminClient().from("course_advisor_keywords").update(patch).eq("id", data.id).select("intent_id, keyword").single();
    dbError(error, "Could not update the keyword.");
    await audit({ actor, action: "advisor.keyword_updated", entityType: "advisor_intent", entityId: row?.intent_id ?? null, summary: row?.keyword, metadata: patch });
    refresh(`/admin/advisor/intents/${row?.intent_id}`);
    return ok(null, "Keyword updated");
  });
}

export async function deleteKeywordAction(input: { id: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const { id } = z.object({ id: z.uuid() }).parse(input);
    const { data: row, error } = await createAdminClient().from("course_advisor_keywords").delete().eq("id", id).select("intent_id, keyword").single();
    dbError(error, "Could not delete the keyword.");
    await audit({ actor, action: "advisor.keyword_deleted", entityType: "advisor_intent", entityId: row?.intent_id ?? null, summary: row?.keyword });
    refresh(`/admin/advisor/intents/${row?.intent_id}`);
    return ok(null, "Keyword removed");
  });
}

// ---------------------------------------------------------------------------
// Course recommendations
// ---------------------------------------------------------------------------

const recommendationSchema = z.object({
  intent_id: z.uuid(),
  course_id: z.uuid("Choose a course"),
  role: z.enum(["primary", "supporting"]),
  recommendation_priority: z.number().int().min(-100).max(100),
  explanation: z.string().trim().max(400, "Keep it under 400 characters").nullable().optional(),
});

export async function addRecommendationAction(input: z.input<typeof recommendationSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const data = recommendationSchema.parse(input);
    const { error } = await createAdminClient()
      .from("course_advisor_recommendations")
      .insert({ ...data, explanation: data.explanation || null });
    if (error?.code === "23505") return fail("Check the highlighted fields.", { course_id: ["This course is already recommended for this intent"] });
    dbError(error, "This course is already recommended for this intent.");
    await audit({ actor, action: "advisor.recommendation_added", entityType: "advisor_intent", entityId: data.intent_id, summary: `Course ${data.course_id} (${data.role})` });
    refresh(`/admin/advisor/intents/${data.intent_id}`);
    return ok(null, "Course added");
  });
}

const recommendationUpdateSchema = z.object({
  id: z.uuid(),
  role: z.enum(["primary", "supporting"]),
  recommendation_priority: z.number().int().min(-100).max(100),
  explanation: z.string().trim().max(400, "Keep it under 400 characters").nullable().optional(),
  is_active: z.boolean(),
});

export async function updateRecommendationAction(input: z.input<typeof recommendationUpdateSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const { id, ...data } = recommendationUpdateSchema.parse(input);
    const { data: row, error } = await createAdminClient()
      .from("course_advisor_recommendations")
      .update({ ...data, explanation: data.explanation || null })
      .eq("id", id)
      .select("intent_id")
      .single();
    dbError(error, "Could not update the recommendation.");
    await audit({ actor, action: "advisor.recommendation_updated", entityType: "advisor_intent", entityId: row?.intent_id ?? null, summary: `Recommendation ${id}`, metadata: data });
    refresh(`/admin/advisor/intents/${row?.intent_id}`);
    return ok(null, "Recommendation saved");
  });
}

export async function deleteRecommendationAction(input: { id: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const { id } = z.object({ id: z.uuid() }).parse(input);
    const { data: row, error } = await createAdminClient().from("course_advisor_recommendations").delete().eq("id", id).select("intent_id, course_id").single();
    dbError(error, "Could not remove the course.");
    await audit({ actor, action: "advisor.recommendation_deleted", entityType: "advisor_intent", entityId: row?.intent_id ?? null, summary: `Course ${row?.course_id}` });
    refresh(`/admin/advisor/intents/${row?.intent_id}`);
    return ok(null, "Course removed");
  });
}

// ---------------------------------------------------------------------------
// Rule tester
// ---------------------------------------------------------------------------

export interface TestResult {
  decision: string;
  detail: string;
  intents: { key: string; score: number; matched: string[] }[];
  faqs: { question: string; score: number }[];
}

export async function testAdvisorMessageAction(input: { text: string }): Promise<ActionResult<TestResult>> {
  return runAction(async () => {
    await assertAdmin();
    const { text } = z.object({ text: z.string().trim().min(1, "Type a message to test").max(500) }).parse(input);
    // Uses the same cached rules visitors get (saving a rule expires that cache).
    const knowledge = await loadAdvisorKnowledge();
    const k = prepareKnowledge(knowledge);
    const state: AdvisorState = { stage: "idle" };
    const d = decide(k, text, state);
    const parts = clauses(text, k.synonyms);
    const intents = scoreIntents(k, parts).slice(0, 5);
    const faqQuestions = new Map(knowledge.faqs.map((f) => [f.id, f.question]));
    const faqs = scoreFaqs(k, parts, isQuestionText(text))
      .slice(0, 3)
      .map((f) => ({ question: faqQuestions.get(f.id) ?? f.id, score: f.score }));
    const titles = new Map(knowledge.intents.map((i) => [i.key, i.title]));
    const detail =
      d.kind === "intents"
        ? `Recommends for: ${d.intents.map((key) => titles.get(key) ?? key).join(", ")} (top score ${d.confidence})`
        : d.kind === "faq"
          ? `Answers the FAQ “${faqQuestions.get(d.faqId) ?? d.faqId}” (score ${d.confidence})`
          : d.kind === "command"
            ? `Runs the built-in “${d.command}” step`
            : d.kind === "fallback"
              ? `No rule is confident enough (best score ${d.confidence}); the fallback message and guided options are shown`
              : d.kind === "coupon_code"
                ? `Tries the coupon code ${d.code}`
                : d.kind === "email"
                  ? "Reads an email address"
                  : "Cancels the current step";
    const ignored = parts.filter((p) => p.context).length;
    return ok({
      decision: d.kind,
      detail: ignored ? `${detail}. ${ignored} clause${ignored === 1 ? "" : "s"} describing what the visitor already knows ${ignored === 1 ? "was" : "were"} ignored.` : detail,
      intents: intents.map((i) => ({ key: titles.get(i.key) ? `${titles.get(i.key)} (${i.key})` : i.key, score: i.score, matched: i.matched })),
      faqs,
    });
  });
}

// ---------------------------------------------------------------------------
// Synonyms
// ---------------------------------------------------------------------------

const synonymSchema = z.object({
  id: z.uuid().optional(),
  term: z.string().trim().min(1, "Enter the word visitors type").max(80),
  replacement: z.string().trim().min(1, "Enter what it should mean").max(80),
  is_active: z.boolean().default(true),
});

export async function saveSynonymAction(input: z.input<typeof synonymSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const data = synonymSchema.parse(input);
    const term = data.term.toLowerCase();
    const replacement = data.replacement.toLowerCase();
    if (term === replacement) return fail("Check the highlighted fields.", { replacement: ["The replacement must differ from the term"] });
    const admin = createAdminClient();
    const { error } = data.id
      ? await admin.from("course_advisor_synonyms").update({ term, replacement, is_active: data.is_active }).eq("id", data.id)
      : await admin.from("course_advisor_synonyms").insert({ term, replacement, is_active: data.is_active });
    if (error?.code === "23505") return fail("Check the highlighted fields.", { term: ["That term already has a synonym"] });
    dbError(error, "That term already has a synonym.");
    await audit({ actor, action: data.id ? "advisor.synonym_updated" : "advisor.synonym_added", entityType: "advisor_synonym", entityId: data.id ?? null, summary: `${term} → ${replacement}` });
    refresh("/admin/advisor/synonyms");
    return ok(null, data.id ? "Synonym saved" : "Synonym added");
  });
}

export async function setSynonymActiveAction(input: { id: string; active: boolean }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const { id, active } = z.object({ id: z.uuid(), active: z.boolean() }).parse(input);
    const { data, error } = await createAdminClient().from("course_advisor_synonyms").update({ is_active: active }).eq("id", id).select("term").single();
    dbError(error, "Could not update the synonym.");
    await audit({ actor, action: "advisor.synonym_updated", entityType: "advisor_synonym", entityId: id, summary: `${data?.term}: ${active ? "on" : "off"}` });
    refresh("/admin/advisor/synonyms");
    return ok(null, active ? "Synonym enabled" : "Synonym disabled");
  });
}

export async function deleteSynonymAction(input: { id: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const { id } = z.object({ id: z.uuid() }).parse(input);
    const { data, error } = await createAdminClient().from("course_advisor_synonyms").delete().eq("id", id).select("term").single();
    dbError(error, "Could not delete the synonym.");
    await audit({ actor, action: "advisor.synonym_deleted", entityType: "advisor_synonym", entityId: id, summary: data?.term });
    refresh("/admin/advisor/synonyms");
    return ok(null, "Synonym deleted");
  });
}

// ---------------------------------------------------------------------------
// Behaviour settings
// ---------------------------------------------------------------------------

const settingsSchema = z.object({
  config: advisorConfigSchema,
  retention_days: z.number().int().min(7, "Keep logs at least 7 days").max(730, "Keep logs at most 730 days"),
});

export async function saveAdvisorSettingsAction(input: z.input<typeof settingsSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const data = settingsSchema.parse(input);
    const config = { ...data.config, quick_replies: data.config.quick_replies.map((q) => q.trim()).filter(Boolean) };
    const { error } = await createAdminClient()
      .from("platform_settings")
      .upsert(
        [
          { key: "advisor.config", value: config as unknown as Json, description: "Course advisor chatbot: greeting, messages, quick replies and limits.", is_public: true },
          { key: "advisor.log_retention_days", value: data.retention_days as unknown as Json, description: "Days advisor conversation logs are kept before they are deleted.", is_public: false },
        ],
        { onConflict: "key" },
      );
    dbError(error, "Could not save the settings.");
    await audit({ actor, action: "advisor.settings_updated", entityType: "platform_settings", summary: `Advisor ${config.enabled ? "enabled" : "disabled"}`, metadata: { ...config, retention_days: data.retention_days } });
    updateTag(SETTINGS_TAG);
    refresh("/admin/advisor/settings");
    return ok(null, "Advisor settings saved");
  });
}
