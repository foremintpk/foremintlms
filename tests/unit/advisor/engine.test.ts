import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  clauses,
  decide,
  matchOption,
  prepareKnowledge,
  prepareSynonyms,
  redactForLog,
  stem,
  tokenize,
  type AdvisorIntentRule,
  type AdvisorKnowledge,
  type MatchType,
} from "@/lib/domain/advisor";

/**
 * The advisor engine against the starter rules that ship in the migration
 * (parsed from the SQL so the test can't drift from the seeded data).
 */
const sql = readFileSync(path.resolve(__dirname, "../../../supabase/migrations/20261115100000_public_course_commerce.sql"), "utf8");

function block(startMarker: string, endMarker: string) {
  const start = sql.indexOf(startMarker);
  return sql.slice(start, sql.indexOf(endMarker, start));
}

const keywordRows = [...block("insert into public.course_advisor_keywords", "on conflict (intent_id, keyword").matchAll(/\('([a-z_]+)', '([^']*)', '(keyword|phrase|pattern)', ([\d.]+)\)/g)];
const synonymRows = [...block("insert into public.course_advisor_synonyms", "on conflict (term)").matchAll(/\('([^']+)', '([^']+)'\)/g)];
const intentKeys = [...new Set(keywordRows.map((r) => r[1]))];

const FOLLOW_UPS: Record<string, { label: string; intent: string }[]> = {
  online_business: [
    { label: "Selling on Amazon", intent: "amazon_business" },
    { label: "Selling on eBay", intent: "ebay_selling" },
    { label: "Building my own store", intent: "own_store" },
    { label: "General e-commerce", intent: "ecommerce_general" },
  ],
  own_store: [
    { label: "Shopify", intent: "shopify_store" },
    { label: "General e-commerce first", intent: "ecommerce_general" },
  ],
};

const PRIORITY: Record<string, number> = { website_development: 10, mobile_app_development: 10, amazon_business: 10, seo: 9, company_formation: 9, own_store: 8, shopify_store: 8, digital_marketing: 8, online_business: 7 };

const knowledge: AdvisorKnowledge = {
  intents: intentKeys.map(
    (key): AdvisorIntentRule => ({
      key,
      title: key,
      response: key,
      priority: PRIORITY[key] ?? 0,
      followUp: FOLLOW_UPS[key] ? { question: "?", options: FOLLOW_UPS[key] } : null,
      keywords: keywordRows.filter((r) => r[1] === key).map((r) => ({ text: r[2], type: r[3] as MatchType, weight: Number(r[4]) })),
      recommendations: [],
    }),
  ),
  synonyms: synonymRows.map((r) => ({ term: r[1], replacement: r[2] })),
  faqs: [
    { id: "faq-choose", question: "Which course should I choose?", answer: "", keywords: ["which course", "choose", "right course", "recommend", "best course"], priority: 1 },
    { id: "faq-pay", question: "How do I pay?", answer: "", keywords: ["pay", "payment", "how to pay", "payment method", "card", "checkout"], priority: 2 },
    { id: "faq-sponsor", question: "Can my institution, employer or parent pay for me?", answer: "", keywords: ["institution", "employer", "parent", "someone else", "pay for me", "sponsor", "payment link", "school", "company pay"], priority: 3 },
    { id: "faq-multi", question: "Can I buy more than one course at once?", answer: "", keywords: ["multiple courses", "several courses", "more than one", "many courses", "package", "bundle"], priority: 2 },
    { id: "faq-after", question: "What happens after I pay?", answer: "", keywords: ["after payment", "after i pay", "what happens", "next step", "paid"], priority: 2 },
    { id: "faq-login", question: "How do I receive my login details?", answer: "", keywords: ["login", "log in", "password", "credential", "account details", "sign in", "username"], priority: 3 },
    { id: "faq-access", question: "How long will I have access?", answer: "", keywords: ["how long", "access", "duration", "days", "lifetime"], priority: 0 },
    { id: "faq-extend", question: "Can I extend my access?", answer: "", keywords: ["extend", "renew", "more time", "access ended", "expired", "expire"], priority: 2 },
    { id: "faq-support", question: "How can I contact support?", answer: "", keywords: ["support", "contact", "help", "talk to someone", "human", "email you"], priority: 2 },
  ],
};
const k = prepareKnowledge(knowledge);
const idle = { stage: "idle" as const };

function intentsFor(text: string, state: Parameters<typeof decide>[2] = idle) {
  const d = decide(k, text, state);
  return d.kind === "intents" ? d.intents : d.kind;
}

describe("advisor text pipeline", () => {
  it("parses the seeded rules", () => {
    expect(intentKeys.length).toBeGreaterThanOrEqual(15);
    expect(keywordRows.length).toBeGreaterThan(90);
    expect(synonymRows.length).toBeGreaterThan(20);
  });

  it("stems plurals and verb forms predictably", () => {
    expect(stem("websites")).toBe("website");
    expect(stem("building")).toBe("build");
    expect(stem("selling")).toBe("sell");
    expect(stem("shopping")).toBe("shop");
    expect(stem("business")).toBe("business");
    expect(stem("ios")).toBe("ios");
    expect(stem("apps")).toBe("app");
  });

  it("applies synonyms before matching", () => {
    const syn = prepareSynonyms(knowledge.synonyms);
    expect(tokenize("E-commerce for iPhone applications", syn)).toEqual(["ecommerce", "for", "ios", "app"]);
    expect(tokenize("my web site", syn)).toEqual(["my", "website"]);
  });

  it("ignores clauses that describe what the visitor already knows", () => {
    const parts = clauses("I know WordPress, but I want to build custom applications", k.synonyms);
    expect(parts[0].context).toBe(true);
    expect(parts[1].context).toBe(false);
    expect(clauses("I have no idea which course", k.synonyms)[0].context).toBe(false);
  });

  it("redacts emails and long numbers before logging", () => {
    expect(redactForLog("mail me at sam@example.com or +44 7700 900123")).toBe("mail me at [email] or +[number]");
  });
});

describe("spec conversations (TEST F)", () => {
  it.each([
    ["I want to create websites.", "website_development"],
    ["I want to build Android and iOS apps.", "mobile_app_development"],
    ["I want to create apps for Android and iPhone.", "mobile_app_development"],
    ["I want to start selling on Amazon.", "amazon_business"],
    ["I want to start my own online store.", "own_store"],
    ["I need more organic traffic for my website.", "seo"],
    ["I want to learn digital marketing.", "digital_marketing"],
    ["I want to register a US LLC.", "company_formation"],
    ["I want to register a company in the US or UK.", "company_formation"],
    ["I want to establish my company.", "company_formation"],
    ["I have no idea which course is right for me.", "not_sure"],
    ["I'm not sure which course is right for me.", "not_sure"],
    ["I want to start an online business but don't know where to begin.", "online_business"],
    ["I want to start an online business.", "online_business"],
    ["I want to build websites for my clients. What should I learn?", "website_development"],
    ["I want to learn SEO.", "seo"],
    ["I want to sell on Amazon.", "amazon_business"],
    ["I want to develop mobile apps.", "mobile_app_development"],
    ["I want to improve my digital marketing.", "digital_marketing"],
  ])("%s → %s", (text, expected) => {
    const got = intentsFor(text);
    expect(Array.isArray(got) ? got[0] : got).toBe(expected);
  });

  it("does not recommend website building to someone who already has a website (Example D)", () => {
    const got = intentsFor("I already have a website and want more organic traffic.");
    expect(got).toEqual(["seo"]);
  });

  it("combines mixed goals and skips what the visitor already knows (Example F)", () => {
    const got = intentsFor("I know WordPress, but I want to build custom applications and rank my clients' websites.");
    expect(Array.isArray(got)).toBe(true);
    expect(got).toEqual(expect.arrayContaining(["website_development", "seo", "mobile_app_development"]));
    expect(got).not.toContain("wordpress_websites");
    const d = decide(k, "I know WordPress, but I want to build custom applications and rank my clients' websites.", idle);
    expect(d.kind === "intents" && d.known).toEqual(["wordpress_websites"]);
  });

  it("asks for more detail instead of guessing", () => {
    expect(decide(k, "Tell me something", idle).kind).toBe("fallback");
    expect(decide(k, "website", idle).kind).toBe("fallback");
  });
});

describe("multi-turn decision paths", () => {
  const followUp = (key: string) => ({ stage: "follow_up" as const, options: FOLLOW_UPS[key] });

  it("follows the online business → own store → Shopify path", () => {
    expect(intentsFor("Building my own store.", followUp("online_business"))).toEqual(["own_store"]);
    expect(intentsFor("Shopify please", followUp("own_store"))).toEqual(["shopify_store"]);
    expect(intentsFor("general e-commerce first", followUp("own_store"))).toEqual(["ecommerce_general"]);
  });

  it("accepts option numbers and 'both'", () => {
    expect(matchOption(k, "2", FOLLOW_UPS.online_business)).toEqual(["ebay_selling"]);
    expect(matchOption(k, "both", FOLLOW_UPS.own_store)).toEqual(["shopify_store", "ecommerce_general"]);
  });

  it("still understands a new free-text goal during a follow-up", () => {
    expect(intentsFor("Actually I want to learn SEO", followUp("online_business"))).toEqual(["seo"]);
  });
});

describe("FAQs and commands", () => {
  it.each([
    ["How do I pay?", "faq-pay"],
    ["Can my employer pay for me?", "faq-sponsor"],
    ["Can my parent pay for my courses?", "faq-sponsor"],
    ["Can I purchase multiple courses?", "faq-multi"],
    ["What happens after payment?", "faq-after"],
    ["How long does access last?", "faq-access"],
    ["How do I get my login details?", "faq-login"],
    ["Can I extend my access?", "faq-extend"],
    ["How can I contact support?", "faq-support"],
  ])("%s → %s", (text, faq) => {
    const d = decide(k, text, idle);
    expect(d.kind).toBe("faq");
    if (d.kind === "faq") expect(d.faqId).toBe(faq);
  });

  it("recognises cart, coupon and link commands", () => {
    expect(decide(k, "show my cart", idle)).toEqual({ kind: "command", command: "cart" });
    expect(decide(k, "I have a coupon", idle)).toEqual({ kind: "command", command: "coupon" });
    expect(decide(k, "my coupon code is SAVE10", idle)).toEqual({ kind: "coupon_code", code: "SAVE10" });
    expect(decide(k, "send me the payment link", idle)).toEqual({ kind: "command", command: "link" });
    expect(decide(k, "I want to check out web development courses", idle).kind).toBe("intents");
  });

  it("reads emails and coupon codes when it asked for them", () => {
    expect(decide(k, "it's Student@Example.com", { stage: "email" })).toEqual({ kind: "email", email: "student@example.com" });
    expect(decide(k, "save10", { stage: "coupon" })).toEqual({ kind: "coupon_code", code: "SAVE10" });
    expect(decide(k, "no thanks", { stage: "coupon" })).toEqual({ kind: "cancel" });
  });
});
