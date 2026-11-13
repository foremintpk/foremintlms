/**
 * Plain-text helpers for messages, discussions and tickets. Bodies are
 * stored as plain text; these helpers turn them into safe render segments.
 */

export type TextSegment =
  | { type: "text"; value: string }
  | { type: "link"; value: string; href: string }
  | { type: "break" };

// http(s) URLs or bare www. hosts. Other schemes (javascript:, data:) never match.
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
const TRAILING_PUNCT = /[.,;:!?)\]}'"]$/;

/** Drop sentence punctuation after a URL, keeping balanced ")" that belong to it. */
function trimTrailing(url: string): string {
  let value = url;
  while (TRAILING_PUNCT.test(value)) {
    const last = value[value.length - 1];
    if (last === ")") {
      const opens = (value.match(/\(/g) ?? []).length;
      const closes = (value.match(/\)/g) ?? []).length;
      if (closes <= opens) break;
    }
    value = value.slice(0, -1);
  }
  return value;
}

/** Normalise a matched URL into a safe absolute https/http href, or null. */
export function safeHref(raw: string): string | null {
  const candidate = raw.toLowerCase().startsWith("www.") ? `https://${raw}` : raw;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function linkifyLine(line: string): TextSegment[] {
  const out: TextSegment[] = [];
  let last = 0;
  for (const match of line.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    const value = trimTrailing(match[0]);
    const href = safeHref(value);
    if (!href) continue;
    if (start > last) out.push({ type: "text", value: line.slice(last, start) });
    out.push({ type: "link", value, href });
    last = start + value.length;
  }
  if (last < line.length) out.push({ type: "text", value: line.slice(last) });
  return out;
}

/** Split plain text into text/link/line-break segments for rendering. */
export function linkify(text: string): TextSegment[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out: TextSegment[] = [];
  lines.forEach((line, i) => {
    if (i > 0) out.push({ type: "break" });
    out.push(...linkifyLine(line));
  });
  return out;
}

/** One-line preview: collapse whitespace and cut at a word boundary. */
export function previewText(body: string | null | undefined, max = 140): string {
  const flat = (body ?? "").replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Normalise user input for storage: trim, unify newlines, cap blank lines. */
export function normalizeBody(body: string): string {
  return body
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Keep only mention ids that are real course members, de-duplicated and
 * capped, excluding the author.
 */
export function sanitizeMentionIds(ids: readonly unknown[], allowed: ReadonlySet<string>, authorId: string, limit = 10): string[] {
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || !UUID_RE.test(id)) continue;
    const lower = id.toLowerCase();
    if (lower === authorId.toLowerCase() || !allowed.has(lower) || out.includes(lower)) continue;
    out.push(lower);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * The @handle being typed at the caret, if any ("Hi @ma" → "ma").
 * Returns null when the caret is not inside a mention token.
 */
export function activeMentionQuery(text: string, caret: number): { query: string; start: number } | null {
  const before = text.slice(0, caret);
  const m = /(^|\s)@([\p{L}\p{N}._-]{0,30})$/u.exec(before);
  if (!m) return null;
  return { query: m[2], start: caret - m[2].length - 1 };
}
