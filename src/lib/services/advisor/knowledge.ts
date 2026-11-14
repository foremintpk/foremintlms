import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripHtml } from "@/lib/sanitize";
import { followUpSchema, parseAdvisorConfig, type AdvisorConfig, type AdvisorKnowledge, type MatchType } from "@/lib/domain/advisor";
import { getPublicSetting } from "@/lib/settings";
import { PUBLIC_TAGS } from "@/lib/services/public/tags";

/** FAQ answers are stored as sanitised HTML; the chat shows plain text. */
function plainText(html: string): string {
  return stripHtml(html.replace(/<\/(p|li|h[1-6])>/gi, "$&\n"))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Cache tag for advisor rules; admin edits call updateTag(ADVISOR_TAG). */
export const ADVISOR_TAG = "advisor-knowledge";

/**
 * The advisor's approved knowledge: active intents with their keywords and
 * course mappings, the synonym dictionary, and published FAQs. Read with
 * the service role (rules are admin-only tables) and cached.
 */
export async function loadAdvisorKnowledge(): Promise<AdvisorKnowledge> {
  "use cache";
  cacheTag(ADVISOR_TAG, PUBLIC_TAGS.faqs);
  cacheLife("minutes");
  const admin = createAdminClient();
  const [intents, synonyms, faqs] = await Promise.all([
    admin
      .from("course_advisor_intents")
      .select("intent_key, title, response, follow_up, priority, course_advisor_keywords(keyword, match_type, weight, is_active), course_advisor_recommendations(course_id, recommendation_priority, role, explanation, is_active)")
      .eq("is_active", true),
    admin.from("course_advisor_synonyms").select("term, replacement").eq("is_active", true),
    admin.from("faqs").select("id, question, answer, keywords, advisor_priority").eq("is_published", true).eq("advisor_enabled", true),
  ]);
  if (intents.error) throw new Error(`[advisor] intents: ${intents.error.message}`);

  type IntentRow = {
    intent_key: string;
    title: string;
    response: string;
    follow_up: unknown;
    priority: number;
    course_advisor_keywords: { keyword: string; match_type: string; weight: number; is_active: boolean }[];
    course_advisor_recommendations: { course_id: string; recommendation_priority: number; role: string; explanation: string | null; is_active: boolean }[];
  };
  return {
    intents: ((intents.data ?? []) as unknown as IntentRow[]).map((i) => {
      const fu = followUpSchema.safeParse(i.follow_up ?? null);
      return {
        key: i.intent_key,
        title: i.title,
        response: i.response,
        priority: i.priority,
        followUp: fu.success ? fu.data : null,
        keywords: i.course_advisor_keywords.filter((k) => k.is_active).map((k) => ({ text: k.keyword, type: k.match_type as MatchType, weight: Number(k.weight) })),
        recommendations: i.course_advisor_recommendations
          .filter((r) => r.is_active)
          .map((r) => ({ courseId: r.course_id, priority: r.recommendation_priority, role: r.role === "supporting" ? ("supporting" as const) : ("primary" as const), explanation: r.explanation }))
          .sort((a, b) => (a.role === b.role ? a.priority - b.priority : a.role === "primary" ? -1 : 1)),
      };
    }),
    synonyms: (synonyms.data ?? []).map((s) => ({ term: s.term, replacement: s.replacement })),
    faqs: (faqs.data ?? []).map((f) => ({ id: f.id, question: f.question, answer: plainText(f.answer).slice(0, 1200), keywords: f.keywords ?? [], priority: f.advisor_priority ?? 0 })),
  };
}

export async function getAdvisorConfig(): Promise<AdvisorConfig> {
  return parseAdvisorConfig(await getPublicSetting<unknown>("advisor.config", {}));
}
