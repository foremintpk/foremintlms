import "server-only";
import sanitizeHtml from "sanitize-html";

/**
 * XSS-safe HTML for rich text (lessons, blog, legal pages, FAQs, CMS).
 * Applied when content is saved AND when it is rendered.
 */
const RICH_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "h2", "h3", "h4", "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "mark", "code", "pre",
    "blockquote", "ul", "ol", "li", "a", "img", "figure", "figcaption", "table", "thead", "tbody",
    "tr", "th", "td", "div", "span", "sup", "sub",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    div: ["data-legal-review-notice", "data-callout"],
    span: ["data-mention"],
    th: ["colspan", "rowspan"],
    td: ["colspan", "rowspan"],
    code: ["class"],
  },
  allowedSchemes: ["https", "http", "mailto", "tel"],
  allowedSchemesByTag: { img: ["https", "http", "data"] },
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => {
      const href = attribs.href ?? "";
      const external = /^https?:\/\//i.test(href);
      return {
        tagName,
        attribs: {
          ...attribs,
          ...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {}),
        },
      };
    },
    img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy" } }),
  },
};

export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, RICH_OPTIONS);
}

/** Plain text only (messages, discussion bodies are stored as text). */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).trim();
}

/** Fill {{placeholders}} from a map, escaping values. Unknown keys render as a visible marker. */
export function fillPlaceholders(text: string, values: Record<string, string | null | undefined>): string {
  return text.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, key: string) => {
    const v = values[key];
    if (v === undefined || v === null || v === "") return `[${key.replace(/_/g, " ")}]`;
    return sanitizeHtml(v, { allowedTags: [], allowedAttributes: {} });
  });
}
