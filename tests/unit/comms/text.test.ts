import { describe, expect, it } from "vitest";
import { activeMentionQuery, linkify, normalizeBody, previewText, safeHref, sanitizeMentionIds } from "@/components/communication/lib/text";

describe("linkify", () => {
  it("splits text, links and line breaks", () => {
    const segs = linkify("See https://foremint.academy/courses.\nThanks");
    expect(segs).toEqual([
      { type: "text", value: "See " },
      { type: "link", value: "https://foremint.academy/courses", href: "https://foremint.academy/courses" },
      { type: "text", value: "." },
      { type: "break" },
      { type: "text", value: "Thanks" },
    ]);
  });

  it("upgrades bare www links to https", () => {
    const link = linkify("go to www.example.com now").find((s) => s.type === "link");
    expect(link).toMatchObject({ href: "https://www.example.com/" });
  });

  it("never produces javascript: or data: links", () => {
    const segs = linkify("javascript:alert(1) data:text/html,<b>x</b>");
    expect(segs.some((s) => s.type === "link")).toBe(false);
  });

  it("keeps parentheses that belong to the URL", () => {
    const link = linkify("(https://en.wikipedia.org/wiki/Foo_(bar))").find((s) => s.type === "link");
    expect(link && link.type === "link" ? link.value : "").toBe("https://en.wikipedia.org/wiki/Foo_(bar)");
  });

  it("rejects hosts without a dot", () => {
    expect(safeHref("http://localhost")).toBeNull();
    expect(safeHref("https://example.com")).toBe("https://example.com/");
  });
});

describe("previewText", () => {
  it("collapses whitespace and truncates on a word boundary", () => {
    const out = previewText("Hello   there\n\nthis is a long message that keeps going", 24);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(24);
    expect(out).not.toMatch(/\s{2,}/);
  });
  it("returns short text unchanged", () => {
    expect(previewText("  hi  ")).toBe("hi");
  });
});

describe("normalizeBody", () => {
  it("strips control characters and caps blank lines", () => {
    expect(normalizeBody("a\u0007b\r\n\r\n\r\n\r\nc  ")).toBe("ab\n\nc");
  });
});

describe("sanitizeMentionIds", () => {
  const a = "11111111-1111-4111-8111-111111111111";
  const b = "22222222-2222-4222-8222-222222222222";
  const author = "33333333-3333-4333-8333-333333333333";
  const allowed = new Set([a, b, author]);

  it("keeps allowed, unique, non-author ids", () => {
    expect(sanitizeMentionIds([a, a.toUpperCase(), b, author, "nope", 42], allowed, author)).toEqual([a, b]);
  });
  it("drops ids that are not course members", () => {
    expect(sanitizeMentionIds(["44444444-4444-4444-8444-444444444444"], allowed, author)).toEqual([]);
  });
  it("caps the number of mentions", () => {
    expect(sanitizeMentionIds([a, b], allowed, author, 1)).toEqual([a]);
  });
});

describe("activeMentionQuery", () => {
  it("finds the handle being typed", () => {
    expect(activeMentionQuery("Hi @mar", 7)).toEqual({ query: "mar", start: 3 });
  });
  it("ignores emails and finished tokens", () => {
    expect(activeMentionQuery("mail me at a@b.co", 17)).toBeNull();
    expect(activeMentionQuery("@ana done", 9)).toBeNull();
  });
});
