import { z } from "zod";

/**
 * The course advisor's matching engine — deterministic, rule-based, no AI.
 *
 * Pipeline for every visitor message:
 *  1. Split into clauses ("I know WordPress, but I want…") and mark clauses
 *     that only describe what the visitor already has/knows (ignored).
 *  2. Normalise each clause: lower case, strip accents and punctuation,
 *     apply the admin's synonym dictionary ("iphone" → "ios"), light stemming.
 *  3. Score every intent from its admin-defined keywords:
 *       keyword  one word present                → weight
 *       phrase   words contiguous, in order      → weight × (1 + 0.15 per extra word)
 *       pattern  words in order, "*" = 0–3 words → weight × 1.1
 *  4. Score FAQs from their keywords and question wording.
 *  5. Decide: follow-up option → command → FAQ / intent by confidence → fallback.
 * Pure functions only; the service layer loads rules from the database.
 */

// ---------------------------------------------------------------------------
// Configuration (Admin → Course advisor → Behaviour)
// ---------------------------------------------------------------------------

export const advisorConfigSchema = z.object({
  enabled: z.boolean().default(true),
  greeting: z.string().trim().min(1).max(200).default("Hey! Welcome to Foremint Academy."),
  intro: z.string().trim().max(600).default("I'm here to help you find the right courses for your goals.\n\nWhat would you like to learn or achieve?"),
  fallback: z.string().trim().min(1).max(400).default("I want to make sure I recommend the right course. Could you tell me a little more about your goal?"),
  closing: z.string().trim().max(300).default("Happy learning! If anything else comes up, I'm right here."),
  privacy_notice: z.string().trim().max(300).default("This assistant follows set rules — it isn't AI. We keep a short, anonymous log of questions to improve answers."),
  show_quick_replies: z.boolean().default(true),
  quick_replies: z.array(z.string().trim().min(1).max(120)).max(12).default([]),
  max_messages: z.number().int().min(5).max(500).default(60),
  session_ttl_minutes: z.number().int().min(5).max(1440).default(120),
});
export type AdvisorConfig = z.infer<typeof advisorConfigSchema>;

export function parseAdvisorConfig(value: unknown): AdvisorConfig {
  const parsed = advisorConfigSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : advisorConfigSchema.parse({});
}

// ---------------------------------------------------------------------------
// Knowledge
// ---------------------------------------------------------------------------

export type MatchType = "keyword" | "phrase" | "pattern";

export interface FollowUp {
  question: string;
  options: { label: string; intent: string }[];
}

export const followUpSchema = z
  .object({
    question: z.string().trim().min(1).max(300),
    options: z.array(z.object({ label: z.string().trim().min(1).max(80), intent: z.string().regex(/^[a-z0-9_]{2,60}$/) })).min(1).max(8),
  })
  .nullable();

export interface AdvisorIntentRule {
  key: string;
  title: string;
  response: string;
  followUp: FollowUp | null;
  priority: number;
  keywords: { text: string; type: MatchType; weight: number }[];
  recommendations: { courseId: string; priority: number; role: "primary" | "supporting"; explanation: string | null }[];
}

export interface AdvisorFaqRule {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  priority: number;
}

export interface AdvisorKnowledge {
  intents: AdvisorIntentRule[];
  synonyms: { term: string; replacement: string }[];
  faqs: AdvisorFaqRule[];
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

const STOPWORDS = new Set(
  "a an the i i m im me my mine we our you your it its is are am be was were to of for in on at by with and or but so do does did can could would should will shall may might how what which who whom when where why this that these those there here some any all about from into as if then than just also really very please want wanna like need get have has had learn learning course courses"
    .split(" "),
);

export function stripAccents(text: string): string {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

/** Lower case, accents and punctuation removed (hyphens kept for the synonym pass), single spaces. */
export function basicNormalize(text: string): string {
  return stripAccents(text.toLowerCase())
    .replace(/[‘’'`´]/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface PreparedSynonyms {
  list: { term: string; replacement: string }[];
}

export function prepareSynonyms(synonyms: { term: string; replacement: string }[]): PreparedSynonyms {
  const list = synonyms
    .map((s) => ({ term: basicNormalize(s.term), replacement: basicNormalize(s.replacement) }))
    .filter((s) => s.term && s.replacement && s.term !== s.replacement)
    .sort((a, b) => b.term.length - a.term.length);
  return { list };
}

export function applySynonyms(normalized: string, synonyms: PreparedSynonyms): string {
  let padded = ` ${normalized} `;
  for (const { term, replacement } of synonyms.list) {
    if (!padded.includes(` ${term} `)) continue;
    padded = padded.split(` ${term} `).join(` ${replacement} `);
    // A replacement can create a new adjacent match ("web sites" → "website"); one pass per term is enough.
  }
  return padded.trim();
}

/** Small, predictable English stemmer (plurals, -ing, -ed). Applied to both rules and messages. */
export function stem(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith("sses")) return word.slice(0, -2);
  if (word.endsWith("ing") && word.length > 5) {
    const base = word.slice(0, -3);
    return /(.)\1$/.test(base) && !/(ll|ss)$/.test(base) ? base.slice(0, -1) : base;
  }
  if (word.endsWith("ed") && word.length > 4) return word.slice(0, -2);
  if (word.endsWith("s") && !/(ss|us|is|os)$/.test(word)) return word.slice(0, -1);
  return word;
}

export function tokenize(text: string, synonyms: PreparedSynonyms): string[] {
  const withSynonyms = applySynonyms(basicNormalize(text), synonyms).replace(/-/g, " ");
  return withSynonyms.split(" ").filter(Boolean).map(stem);
}

const CLAUSE_SPLIT = /[.,;!?\n]+|\b(?:but|however|although|though|whereas)\b|\band\s+(?=(?:i|im|i m|want|would|need|now|also|looking|hope|plan|then|wanna)\b)/;
const KNOWN_PREFIX = /^(?:i\s+)?(?:already\s+)?(?:know|have|own|run|use|understand|am familiar with|m familiar with|can already|already)\b/;
const NEGATION = /\b(?:no|not|don t|dont|never|without|nothing)\b/;

export interface Clause {
  tokens: string[];
  /** Describes what the visitor already has/knows: not used to choose courses. */
  context: boolean;
}

export function clauses(text: string, synonyms: PreparedSynonyms): Clause[] {
  const lowered = stripAccents(text.toLowerCase()).replace(/[‘’'`´]/g, " ");
  return lowered
    .split(CLAUSE_SPLIT)
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .map((part) => {
      const norm = basicNormalize(part);
      return { tokens: tokenize(part, synonyms), context: KNOWN_PREFIX.test(norm) && !NEGATION.test(norm) };
    })
    .filter((c) => c.tokens.length > 0);
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

interface CompiledKeyword {
  source: string;
  type: MatchType;
  weight: number;
  tokens: string[];
}

export interface PreparedKnowledge {
  synonyms: PreparedSynonyms;
  intents: (AdvisorIntentRule & { compiled: CompiledKeyword[] })[];
  faqs: (AdvisorFaqRule & { compiledKeywords: string[][]; questionTokens: string[] })[];
  byKey: Map<string, AdvisorIntentRule>;
}

export function prepareKnowledge(k: AdvisorKnowledge): PreparedKnowledge {
  const synonyms = prepareSynonyms(k.synonyms);
  const compile = (text: string, type: MatchType): string[] =>
    type === "pattern"
      ? text
          .trim()
          .split(/\s+/)
          .flatMap((part) => (part === "*" ? ["*"] : tokenize(part, synonyms)))
      : tokenize(text, synonyms);
  const intents = k.intents.map((intent) => ({
    ...intent,
    compiled: intent.keywords
      .map((kw) => ({ source: kw.text, type: kw.type, weight: kw.weight, tokens: compile(kw.text, kw.type) }))
      .filter((kw) => kw.tokens.some((t) => t !== "*")),
  }));
  const faqs = k.faqs.map((f) => ({
    ...f,
    compiledKeywords: f.keywords.map((kw) => tokenize(kw, synonyms)).filter((t) => t.length > 0),
    questionTokens: tokenize(f.question, synonyms).filter((t) => !STOPWORDS.has(t)),
  }));
  return { synonyms, intents, faqs, byKey: new Map(k.intents.map((i) => [i.key, i])) };
}

function hasSequence(tokens: string[], seq: string[]): boolean {
  if (seq.length === 0 || seq.length > tokens.length) return false;
  outer: for (let i = 0; i <= tokens.length - seq.length; i++) {
    for (let j = 0; j < seq.length; j++) if (tokens[i + j] !== seq[j]) continue outer;
    return true;
  }
  return false;
}

/** Pattern match: tokens in order; "*" allows 0–3 other words in between ("build * app"). */
function hasPattern(tokens: string[], pattern: string[]): boolean {
  const parts: { token: string; gapAfter: number }[] = [];
  for (const t of pattern) {
    if (t === "*") {
      if (parts.length) parts[parts.length - 1].gapAfter = 3;
      continue;
    }
    parts.push({ token: t, gapAfter: 0 });
  }
  if (!parts.length) return false;
  const match = (index: number, from: number, to: number): boolean => {
    if (index === parts.length) return true;
    for (let i = from; i <= Math.min(to, tokens.length - 1); i++) {
      if (tokens[i] === parts[index].token && match(index + 1, i + 1, i + 1 + parts[index].gapAfter)) return true;
    }
    return false;
  };
  return match(0, 0, tokens.length - 1);
}

function keywordScore(kw: CompiledKeyword, tokens: string[]): number {
  if (kw.type === "keyword") return kw.tokens.length === 1 ? (tokens.includes(kw.tokens[0]) ? kw.weight : 0) : hasSequence(tokens, kw.tokens) ? kw.weight : 0;
  if (kw.type === "phrase") return hasSequence(tokens, kw.tokens) ? kw.weight * (1 + 0.15 * (kw.tokens.length - 1)) : 0;
  return hasPattern(tokens, kw.tokens) ? kw.weight * 1.1 : 0;
}

export interface IntentScore {
  key: string;
  score: number;
  matched: string[];
  priority: number;
}

export function scoreIntents(k: PreparedKnowledge, parts: Clause[], boost: Map<string, number> = new Map()): IntentScore[] {
  const usable = parts.filter((c) => !c.context);
  const out: IntentScore[] = [];
  for (const intent of k.intents) {
    let score = 0;
    const matched: string[] = [];
    for (const kw of intent.compiled) {
      let best = 0;
      for (const c of usable) best = Math.max(best, keywordScore(kw, c.tokens));
      if (best > 0) {
        score += best;
        matched.push(kw.source);
      }
    }
    score *= boost.get(intent.key) ?? 1;
    if (score > 0) out.push({ key: intent.key, score: Math.round(score * 100) / 100, matched, priority: intent.priority });
  }
  return out.sort((a, b) => b.score - a.score || b.priority - a.priority);
}

export function scoreFaqs(k: PreparedKnowledge, parts: Clause[], isQuestion: boolean): { id: string; score: number }[] {
  const tokens = parts.flatMap((c) => c.tokens);
  const content = new Set(tokens.filter((t) => !STOPWORDS.has(t)));
  const out: { id: string; score: number }[] = [];
  for (const faq of k.faqs) {
    let score = 0;
    for (const kw of faq.compiledKeywords) if (hasSequence(tokens, kw)) score += 2.5;
    const overlap = faq.questionTokens.filter((t) => content.has(t)).length;
    if (faq.questionTokens.length) score += (overlap / Math.max(3, faq.questionTokens.length)) * 3;
    if (isQuestion) score *= 1.25;
    score += faq.priority * 0.1;
    if (score > 0) out.push({ id: faq.id, score: Math.round(score * 100) / 100 });
  }
  return out.sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

export const INTENT_THRESHOLD = 1.5;
export const FAQ_THRESHOLD = 2.5;
/** Secondary intents must reach this share of the top score to be included (mixed goals). */
export const SECONDARY_RATIO = 0.5;

export type AdvisorStage = "idle" | "follow_up" | "email" | "coupon";

export interface AdvisorState {
  stage: AdvisorStage;
  /** Follow-up options on screen (stage "follow_up"). */
  options?: { label: string; intent: string }[];
  lastIntents?: string[];
}

export type Command = "cart" | "checkout" | "coupon" | "link" | "reset";

export type Decision =
  /** `known`: intents the visitor said they already know/have — their courses aren't recommended. */
  | { kind: "intents"; intents: string[]; confidence: number; known?: string[] }
  | { kind: "faq"; faqId: string; confidence: number }
  | { kind: "command"; command: Command }
  | { kind: "email"; email: string }
  | { kind: "coupon_code"; code: string }
  | { kind: "cancel" }
  | { kind: "fallback"; confidence: number };

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const CANCEL_RE = /^(?:no|nope|cancel|skip|not now|never mind|nevermind|stop|later|no thanks|no thank you)\b/;

function detectCommand(norm: string): Command | null {
  if (/\b(?:start over|restart|reset|clear chat)\b/.test(norm)) return "reset";
  if (/\b(?:payment link|pay link|link to pay|send (?:me )?(?:the |a )?link|share (?:the |a )?link|copy (?:the |a )?link|generate (?:the |a )?link)\b/.test(norm)) return "link";
  if (/\b(?:coupon|discount code|promo code|promo|voucher)\b/.test(norm)) return "coupon";
  if (/\b(?:checkout|pay now|buy now|proceed to pay|ready to pay|i want to pay|purchase now)\b/.test(norm)) return "checkout";
  if (/\b(?:my cart|cart|basket|my package|learning package|what have i (?:added|selected|chosen)|show (?:my )?selection)\b/.test(norm)) return "cart";
  return null;
}

/** Does the message pick one of the follow-up options on screen? */
export function matchOption(k: PreparedKnowledge, text: string, options: { label: string; intent: string }[]): string[] | null {
  const norm = basicNormalize(text);
  const index = /^(?:option\s+)?([1-9])$/.exec(norm);
  if (index) {
    const opt = options[Number(index[1]) - 1];
    return opt ? [opt.intent] : null;
  }
  if (options.length >= 2 && /\b(?:both|all of them|all|everything)\b/.test(norm) && norm.split(" ").length <= 4) return options.map((o) => o.intent);
  const tokens = new Set(tokenize(text, k.synonyms).filter((t) => !STOPWORDS.has(t)));
  let best: { intent: string; share: number } | null = null;
  for (const opt of options) {
    const label = tokenize(opt.label, k.synonyms).filter((t) => !STOPWORDS.has(t));
    if (!label.length) continue;
    if (basicNormalize(opt.label) === norm) return [opt.intent];
    const share = label.filter((t) => tokens.has(t)).length / label.length;
    if (share > (best?.share ?? 0)) best = { intent: opt.intent, share };
  }
  return best && best.share >= 0.66 ? [best.intent] : null;
}

export function isQuestionText(text: string): boolean {
  const norm = basicNormalize(text);
  return text.includes("?") || /^(?:how|what|which|when|where|why|who|can|could|do|does|is|are|will|would|should|may)\b/.test(norm);
}

export function decide(k: PreparedKnowledge, text: string, state: AdvisorState): Decision {
  const norm = basicNormalize(text);

  if (state.stage === "email") {
    const email = EMAIL_RE.exec(text)?.[0];
    if (email) return { kind: "email", email: email.toLowerCase() };
    if (CANCEL_RE.test(norm)) return { kind: "cancel" };
  }
  if (state.stage === "coupon") {
    if (CANCEL_RE.test(norm)) return { kind: "cancel" };
    const code = /^(?:code\s+|coupon\s+)?([a-z0-9_-]{3,40})$/i.exec(text.trim())?.[1];
    if (code) return { kind: "coupon_code", code: code.toUpperCase() };
  }

  const parts = clauses(text, k.synonyms);
  const boost = new Map<string, number>();
  if (state.stage === "follow_up" && state.options?.length) {
    const picked = matchOption(k, text, state.options);
    if (picked) return { kind: "intents", intents: picked, confidence: 10 };
    for (const o of state.options) boost.set(o.intent, 1.5);
  }

  const command = detectCommand(norm);
  if (command) {
    // "coupon SAVE10" / "my code is SAVE10" → apply straight away.
    if (command === "coupon") {
      for (const m of text.matchAll(/\b(?:code|coupon|voucher|promo)(?:\s+(?:code|is|=|:))*\s+([A-Za-z0-9_-]{3,40})\b/gi)) {
        if (!/^(?:code|coupon|voucher|promo|is|the|for|and|but|please)$/i.test(m[1])) return { kind: "coupon_code", code: m[1].toUpperCase() };
      }
    }
    return { kind: "command", command };
  }

  const intents = scoreIntents(k, parts, boost);
  const faqs = scoreFaqs(k, parts, isQuestionText(text));
  const topIntent = intents[0]?.score ?? 0;
  const topFaq = faqs[0]?.score ?? 0;

  if (topFaq >= FAQ_THRESHOLD && topFaq > topIntent) return { kind: "faq", faqId: faqs[0].id, confidence: topFaq };
  if (topIntent >= INTENT_THRESHOLD) {
    const floor = Math.max(INTENT_THRESHOLD, topIntent * SECONDARY_RATIO);
    const chosen = intents.filter((i) => i.score >= floor).slice(0, 3).map((i) => i.key);
    // Topics mentioned only as things the visitor already knows or has ("I know WordPress, but…").
    const contextParts = parts.filter((c) => c.context).map((c) => ({ ...c, context: false }));
    const known = contextParts.length
      ? scoreIntents(k, contextParts)
          .filter((i) => i.score >= INTENT_THRESHOLD && !chosen.includes(i.key))
          .map((i) => i.key)
      : [];
    return { kind: "intents", intents: chosen, confidence: topIntent, ...(known.length ? { known } : {}) };
  }
  if (topFaq >= 2) return { kind: "faq", faqId: faqs[0].id, confidence: topFaq };
  return { kind: "fallback", confidence: Math.max(topIntent, topFaq) };
}

// ---------------------------------------------------------------------------
// Logging hygiene
// ---------------------------------------------------------------------------

/** Remove emails and long digit runs (phones, cards) and cap the length before a question is logged. */
export function redactForLog(text: string): string {
  return text
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, "[email]")
    .replace(/(?:\d[\s-]?){7,}/g, "[number]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}
