import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomToken, sha256 } from "@/lib/security/crypto";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { decide, prepareKnowledge, redactForLog, type AdvisorConfig, type AdvisorState, type Decision, type PreparedKnowledge } from "@/lib/domain/advisor";
import type { AdvisorBlock, AdvisorCourseCard, AdvisorOption, AdvisorReply, AdvisorRequest } from "@/lib/domain/advisor-view";
import { durationAccessLabel, learnerEmailSchema } from "@/lib/domain/commerce";
import { formatMinor } from "@/lib/domain/invoicing";
import type { CartView } from "@/lib/domain/commerce-view";
import type { Json, Tables } from "@/types/database";
import { addCoursesToCart, cartView, getOrCreateCart, loadCart, quoteCart, removeCourseFromCart, saveCart, type CartRow } from "@/lib/services/commerce/cart";
import { getSelectorCatalog } from "@/lib/services/commerce/catalog";
import { checkoutCart } from "@/lib/services/commerce/orders";
import { getAdvisorConfig, loadAdvisorKnowledge } from "./knowledge";

/**
 * The course advisor's conversation handler. Every reply is assembled from
 * stored rules and approved content only: intent responses and follow-up
 * questions written by admins, course cards and prices from the live catalog,
 * FAQ answers from the FAQ table. Cart, coupon and payment-link actions call
 * exactly the same services as the website, so there is one cart, one
 * pricing engine and one checkout.
 */

type SessionRow = Tables<"course_advisor_conversation_sessions">;

export const ADVISOR_COOKIE = "fm_advisor";

const db = () => createAdminClient();

async function sessionToken(): Promise<string | null> {
  const v = (await cookies()).get(ADVISOR_COOKIE)?.value ?? null;
  return v && /^[A-Za-z0-9_-]{40,64}$/.test(v) ? v : null;
}

async function loadSession(config: AdvisorConfig): Promise<SessionRow | null> {
  const token = await sessionToken();
  if (!token) return null;
  const { data } = await db().from("course_advisor_conversation_sessions").select("*").eq("token_hash", sha256(token)).maybeSingle();
  const row = (data as SessionRow | null) ?? null;
  if (!row) return null;
  const idleMs = Date.now() - new Date(row.last_activity_at).getTime();
  if (row.session_status === "active" && idleMs > config.session_ttl_minutes * 60_000) {
    await db().from("course_advisor_conversation_sessions").update({ session_status: "expired", ended_at: new Date().toISOString() }).eq("id", row.id);
    return null;
  }
  return row.session_status === "expired" || row.session_status === "ended" ? null : row;
}

async function createSession(cartId: string | null): Promise<SessionRow> {
  const token = randomToken(32);
  const { data, error } = await db().from("course_advisor_conversation_sessions").insert({ token_hash: sha256(token), cart_id: cartId }).select("*").single();
  if (error || !data) throw new Error(`advisor session insert failed: ${error?.message}`);
  (await cookies()).set(ADVISOR_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 });
  return data as SessionRow;
}

function stateOf(session: SessionRow): AdvisorState {
  const s = (session.conversation_state ?? {}) as Partial<AdvisorState>;
  return { stage: s.stage ?? "idle", options: s.options, lastIntents: s.lastIntents };
}

async function saveSession(session: SessionRow, patch: Partial<SessionRow> & { state?: AdvisorState }) {
  const { state, ...rest } = patch;
  await db()
    .from("course_advisor_conversation_sessions")
    .update({ ...rest, ...(state ? { conversation_state: state as unknown as Json } : {}), last_activity_at: new Date().toISOString() })
    .eq("id", session.id);
}

async function logTurn(session: SessionRow, row: Partial<Tables<"course_advisor_messages">> & { message_role: "user" | "event" }) {
  const { error } = await db().from("course_advisor_messages").insert({ session_id: session.id, ...row });
  if (error) console.error("[advisor] log failed", error.message);
}

// ---------------------------------------------------------------------------
// Building replies
// ---------------------------------------------------------------------------

const NEXT_STEPS: AdvisorOption[] = [
  { label: "View my package", action: "view_cart" },
  { label: "I have a coupon code", action: "coupon" },
  { label: "Get a payment link", action: "request_link" },
  { label: "Go to checkout", action: "checkout" },
];

async function courseCards(knowledge: PreparedKnowledge, intentKeys: string[], cart: CartView, knownIntents: string[] = []): Promise<AdvisorCourseCard[]> {
  const catalog = await getSelectorCatalog();
  const duration = cart.duration ?? catalog.defaultDuration;
  // Courses for skills the visitor said they already have are left out.
  const seen = new Set<string>(knownIntents.flatMap((key) => (knowledge.byKey.get(key)?.recommendations ?? []).filter((r) => r.role === "primary").map((r) => r.courseId)));
  const out: AdvisorCourseCard[] = [];
  for (const key of intentKeys) {
    const intent = knowledge.byKey.get(key);
    for (const rec of intent?.recommendations ?? []) {
      if (seen.has(rec.courseId) || out.length >= 4) continue;
      const course = catalog.courses.find((c) => c.id === rec.courseId);
      if (!course) continue; // unpublished or not for sale: never described
      seen.add(rec.courseId);
      const price = duration ? course.prices[duration] : undefined;
      out.push({
        id: course.id,
        slug: course.slug,
        title: course.title,
        category: course.category?.name ?? null,
        thumbnailUrl: course.thumbnailUrl,
        priceMinor: price?.priceMinor ?? null,
        currency: catalog.currency,
        accessLabel: price && duration ? durationAccessLabel(duration) : null,
        explanation: rec.explanation,
        role: rec.role,
      });
    }
  }
  return out;
}

function guidedOptions(knowledge: PreparedKnowledge, config: AdvisorConfig): AdvisorOption[] {
  const notSure = knowledge.byKey.get("not_sure")?.followUp;
  if (notSure) return notSure.options.map((o) => ({ label: o.label, intent: o.intent }));
  return config.quick_replies.slice(0, 6).map((q) => ({ label: q, message: q }));
}

async function intentReply(knowledge: PreparedKnowledge, intentKeys: string[], cart: CartView, knownIntents: string[] = []): Promise<{ blocks: AdvisorBlock[]; state: AdvisorState; recommended: string[] }> {
  const [topKey, ...others] = intentKeys;
  const top = knowledge.byKey.get(topKey);
  if (!top) return { blocks: [], state: { stage: "idle" }, recommended: [] };
  const blocks: AdvisorBlock[] = [];
  let text = top.response;
  const otherTitles = others.map((k) => knowledge.byKey.get(k)?.title).filter(Boolean) as string[];
  if (otherTitles.length) text += ` You also mentioned ${otherTitles.map((t) => t.toLowerCase()).join(" and ")}, so I've included courses for that too.`;
  blocks.push({ type: "text", text });

  const cards = await courseCards(knowledge, intentKeys, cart, knownIntents);
  const knownTitles = knownIntents.map((k) => knowledge.byKey.get(k)?.title).filter(Boolean) as string[];
  if (knownTitles.length && cards.length) blocks.push({ type: "text", text: `Since you already know ${knownTitles.map((t) => t.toLowerCase()).join(" and ")}, I've left that out.` });
  if (cards.length) {
    const fresh = cards.filter((c) => !cart.courseIds.includes(c.id));
    blocks.push({ type: "text", text: cards.length === 1 ? "I recommend this course:" : `I recommend these ${cards.length} courses:` });
    blocks.push({ type: "courses", courses: cards });
    if (cards.length && fresh.length === 0) blocks.push({ type: "notice", tone: "info", text: "They're already in your learning package." });
  }

  if (top.followUp && !(cards.length && others.length)) {
    blocks.push({ type: "options", question: top.followUp.question, options: top.followUp.options.map((o) => ({ label: o.label, intent: o.intent })) });
    return { blocks, state: { stage: "follow_up", options: top.followUp.options, lastIntents: intentKeys }, recommended: cards.map((c) => c.id) };
  }
  return { blocks, state: { stage: "idle", lastIntents: intentKeys }, recommended: cards.map((c) => c.id) };
}

function cartSummaryText(cart: CartView): string {
  const n = cart.lines.length;
  return `${n} ${n === 1 ? "course" : "courses"} selected · ${cart.durationLabel ?? ""} access · total ${formatMinor(cart.totalMinor, cart.currency)}${cart.discountMinor ? ` after ${formatMinor(cart.discountMinor, cart.currency)} off` : ""}.`;
}

function emptyCartBlocks(knowledge: PreparedKnowledge, config: AdvisorConfig): AdvisorBlock[] {
  return [
    { type: "text", text: "Your learning package is empty for now. Tell me what you'd like to achieve and I'll suggest courses — or pick one of these:" },
    { type: "options", options: guidedOptions(knowledge, config) },
  ];
}

// ---------------------------------------------------------------------------
// Turn handling
// ---------------------------------------------------------------------------

export async function handleAdvisorTurn(req: AdvisorRequest, ctx: { accountEmail: string | null }): Promise<AdvisorReply> {
  const config = await getAdvisorConfig();
  if (!config.enabled) {
    return { blocks: [{ type: "notice", tone: "info", text: "The course advisor is offline right now. Browse every course on Build your learning plan." }], cart: await cartView(await loadCart(), ctx), stage: "idle" };
  }
  const knowledge = prepareKnowledge(await loadAdvisorKnowledge());
  const existingCart = await loadCart();
  let session = await loadSession(config);
  if (!session) session = await createSession(existingCart?.id ?? null);
  let state = stateOf(session);

  if (session.message_count >= config.max_messages) {
    if (session.session_status !== "limited") await saveSession(session, { session_status: "limited" });
    return {
      blocks: [{ type: "notice", tone: "info", text: "We've reached the limit for this conversation. You can keep browsing on Build your learning plan, or contact us and we'll help." }],
      cart: await cartView(existingCart, ctx),
      stage: "idle",
      limited: true,
    };
  }

  const blocks: AdvisorBlock[] = [];
  let cart: CartRow | null = existingCart;
  const ensureCart = async () => {
    if (!cart) cart = await getOrCreateCart();
    if (session && session.cart_id !== cart.id) await saveSession(session, { cart_id: cart.id });
    return cart;
  };
  const view = async () => cartView(cart, ctx);

  // Normalise button presses and typed text into one decision.
  let decision: Decision | null = null;
  let logText: string | null = null;
  switch (req.type) {
    case "message":
      decision = decide(knowledge, req.text, state);
      logText = decision.kind === "email" ? "[email]" : decision.kind === "coupon_code" ? "[coupon code]" : redactForLog(req.text);
      break;
    case "option":
      decision = { kind: "intents", intents: [req.intent], confidence: 10 };
      logText = redactForLog(req.label);
      break;
    case "coupon":
      decision = req.code ? { kind: "coupon_code", code: req.code.toUpperCase() } : { kind: "command", command: "coupon" };
      break;
    case "email":
      decision = { kind: "email", email: req.email };
      break;
    case "request_link":
      decision = { kind: "command", command: "link" };
      break;
    case "view_cart":
      decision = { kind: "command", command: "cart" };
      break;
    case "reset":
      decision = { kind: "command", command: "reset" };
      break;
  }

  let matchedIntent: string | null = null;
  let matchedFaq: string | null = null;
  let recommended: string[] = [];

  if (req.type === "add") {
    const c = await ensureCart();
    const res = await addCoursesToCart(c, req.courseIds);
    cart = res.cart;
    const v = await view();
    const titles = v.lines.filter((l) => res.added.includes(l.courseId)).map((l) => l.title);
    if (res.rejected) blocks.push({ type: "notice", tone: "error", text: res.rejected });
    blocks.push({
      type: "text",
      text: titles.length === 0 ? "That's already in your learning package." : titles.length === 1 ? `Great! ${titles[0]} has been added to your learning package.` : titles.length === 2 ? "Great! Both courses have been added to your learning package." : `Great! ${titles.length} courses have been added to your learning package.`,
    });
    blocks.push({ type: "cart" }, { type: "options", question: "What would you like to do next?", options: NEXT_STEPS });
    await logTurn(session, { message_role: "event", event_type: "cart_add", event_course_ids: res.added });
    state = { ...state, stage: "idle" };
    await saveSession(session, { state });
    return { blocks, cart: v, stage: state.stage };
  }
  if (req.type === "remove") {
    if (cart) cart = await removeCourseFromCart(cart, req.courseId);
    await logTurn(session, { message_role: "event", event_type: "cart_remove", event_course_ids: [req.courseId] });
    const v = await view();
    blocks.push({ type: "text", text: "Removed from your learning package." }, ...(v.lines.length ? [{ type: "cart" } as AdvisorBlock] : []));
    return { blocks, cart: v, stage: state.stage };
  }
  if (req.type === "checkout_opened") {
    await logTurn(session, { message_role: "event", event_type: "checkout_opened" });
    return { blocks: [], cart: await view(), stage: state.stage };
  }

  if (!decision) return { blocks: [], cart: await view(), stage: state.stage };

  switch (decision.kind) {
    case "intents": {
      const reply = await intentReply(knowledge, decision.intents, await view(), decision.known ?? []);
      blocks.push(...reply.blocks);
      state = reply.state;
      matchedIntent = decision.intents[0];
      recommended = reply.recommended;
      break;
    }
    case "faq": {
      const faq = knowledge.faqs.find((f) => f.id === decision.faqId);
      matchedIntent = "faq";
      matchedFaq = decision.faqId;
      if (faq) blocks.push({ type: "faq", question: faq.question, answer: faq.answer });
      blocks.push({ type: "options", question: "Anything else I can help with?", options: guidedOptions(knowledge, config).slice(0, 4) });
      state = { stage: "idle" };
      break;
    }
    case "command": {
      matchedIntent = "command";
      const v = await view();
      if (decision.command === "reset") {
        state = { stage: "idle" };
        blocks.push({ type: "text", text: `${config.greeting} ${config.intro}`.trim() });
        if (config.show_quick_replies) blocks.push({ type: "options", options: config.quick_replies.map((q) => ({ label: q, message: q })) });
      } else if (v.courseIds.length === 0) {
        blocks.push(...emptyCartBlocks(knowledge, config));
        state = { stage: "idle" };
      } else if (decision.command === "cart") {
        blocks.push({ type: "text", text: cartSummaryText(v) }, { type: "cart" }, { type: "options", options: NEXT_STEPS.filter((o) => o.action !== "view_cart") });
        state = { stage: "idle" };
      } else if (decision.command === "checkout") {
        blocks.push({ type: "text", text: `You're ready to go — ${cartSummaryText(v)}` }, { type: "checkout_cta" });
        state = { stage: "idle" };
      } else if (decision.command === "coupon") {
        blocks.push({ type: "text", text: "Do you have a coupon code? Type it below and I'll check it." }, { type: "coupon_request" });
        state = { stage: "coupon" };
      } else if (decision.command === "link") {
        blocks.push({ type: "text", text: "Which email address should receive your Foremint Academy account access after payment?" }, { type: "email_request", suggested: v.email ?? v.accountEmail });
        state = { stage: "email" };
      }
      break;
    }
    case "coupon_code": {
      matchedIntent = "command";
      const c = await ensureCart();
      if (c.course_ids.length === 0) {
        blocks.push({ type: "text", text: "Add a course first, then I can apply your code." }, ...emptyCartBlocks(knowledge, config).slice(1));
        state = { stage: "idle" };
        break;
      }
      // Same validation (and the same brute-force limit) as the checkout page; a code is saved only when it applies.
      await enforceRateLimit("coupon-check", 20, 600);
      const quote = await quoteCart({ ...c, coupon_code: decision.code });
      const evaluation = quote.coupon?.evaluation;
      if (evaluation?.ok) {
        cart = await saveCart(c, { coupon_code: decision.code });
        blocks.push({ type: "text", text: `${evaluation.label} applied — you save ${formatMinor(evaluation.discountMinor, quote.currency)}.` }, { type: "cart" }, { type: "options", options: NEXT_STEPS.filter((o) => o.action !== "coupon") });
        await logTurn(session, { message_role: "event", event_type: "coupon_applied" });
        state = { stage: "idle" };
      } else {
        blocks.push({ type: "notice", tone: "error", text: evaluation && !evaluation.ok ? evaluation.message : "That code isn't valid." }, { type: "coupon_request" });
        await logTurn(session, { message_role: "event", event_type: "coupon_rejected" });
        state = { stage: "coupon" };
      }
      break;
    }
    case "email": {
      matchedIntent = "command";
      const parsed = learnerEmailSchema.safeParse(decision.email);
      if (!parsed.success) {
        blocks.push({ type: "notice", tone: "error", text: parsed.error.issues[0]?.message ?? "Enter a valid email address." }, { type: "email_request", suggested: null });
        state = { stage: "email" };
        break;
      }
      const c = await ensureCart();
      if (c.course_ids.length === 0) {
        blocks.push(...emptyCartBlocks(knowledge, config));
        state = { stage: "idle" };
        break;
      }
      const outcome = await checkoutCart(c, { email: parsed.data, source: "advisor", advisorSessionId: session.id });
      cart = await loadCart();
      if (!outcome.ok) {
        blocks.push({ type: "notice", tone: "error", text: outcome.error }, { type: "cart" });
        state = { stage: outcome.code === "invalid_email" ? "email" : "idle" };
        break;
      }
      const o = outcome.result;
      blocks.push(
        { type: "text", text: o.free ? "Your package is fully covered by your discount — no payment needed. Check the email for the next steps." : "Here's your secure payment link. Anyone can pay with it; the courses go to the email you gave me." },
        { type: "payment_link", orderNumber: o.orderNumber, paymentUrl: o.paymentUrl, statusUrl: o.statusUrl, totalMinor: o.totalMinor, currency: o.currency, expiresAt: o.expiresAt, email: parsed.data, free: o.free },
      );
      await logTurn(session, { message_role: "event", event_type: "order_created", order_id: outcome.order.id, event_course_ids: c.course_ids });
      await saveSession(session, { order_id: outcome.order.id });
      state = { stage: "idle" };
      break;
    }
    case "cancel": {
      matchedIntent = "command";
      blocks.push({ type: "text", text: "No problem. What would you like to do next?" }, { type: "options", options: NEXT_STEPS });
      state = { stage: "idle" };
      break;
    }
    case "fallback": {
      matchedIntent = "fallback";
      blocks.push({ type: "text", text: config.fallback }, { type: "options", options: guidedOptions(knowledge, config) });
      state = { stage: "idle" };
      break;
    }
  }

  // "Thanks" and similar closing intents end with the configured closing line.
  if (matchedIntent === "thanks" && config.closing) blocks.splice(0, blocks.length, { type: "text", text: config.closing });

  const counted = req.type === "message" || req.type === "option";
  if (counted) {
    await logTurn(session, {
      message_role: "user",
      content: logText,
      matched_intent: matchedIntent,
      matched_faq_id: matchedFaq,
      confidence: decision && "confidence" in decision ? Math.min(9999, decision.confidence) : null,
      recommended_course_ids: recommended,
    });
  }
  await saveSession(session, {
    state,
    current_intent: matchedIntent && !["command", "fallback", "faq"].includes(matchedIntent) ? matchedIntent : session.current_intent,
    message_count: session.message_count + (counted ? 1 : 0),
    fallback_count: session.fallback_count + (matchedIntent === "fallback" ? 1 : 0),
  });
  return { blocks, cart: await view(), stage: state.stage };
}
