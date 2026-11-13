/**
 * Transactional email composition.
 *
 * Emails are built from editable `email_templates` rows (subject, preheader,
 * heading, plain-text body with {{placeholders}}, CTA label) wrapped in one
 * branded, table-based layout that renders consistently across mail clients.
 * Every inserted value is HTML-escaped; template text is treated as plain
 * text, never as HTML. Pure module — no I/O — so it is unit tested.
 */

export interface EmailTemplateRecord {
  key: string;
  category: string;
  subject: string;
  preheader: string | null;
  heading: string;
  body: string;
  cta_label: string | null;
  is_required: boolean;
}

export interface EmailContext {
  brandName: string;
  appUrl: string;
  logoUrl: string;
  supportEmail: string;
  legalEntityName: string;
  businessAddress: string;
  primaryColor: string;
  /** Where recipients manage notification emails. */
  preferencesUrl: string;
}

export interface ComposedEmail {
  subject: string;
  preheader: string;
  html: string;
  text: string;
}

export interface DetailRow {
  label: string;
  value: string;
}

export interface LineItem {
  description: string;
  amount: string;
}

const PLACEHOLDER = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Primitive payload values become template variables; objects/arrays are ignored here. */
export function payloadToVars(payload: Record<string, unknown>): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") vars[key] = String(value);
  }
  return vars;
}

/** Replace {{name}} with values. Missing values become "" (or a visible marker in previews). */
export function fillVars(text: string, vars: Record<string, string>, missing: "empty" | "marker" = "empty"): string {
  return text.replace(PLACEHOLDER, (_, name: string) => {
    const v = vars[name];
    if (v !== undefined && v !== "") return v;
    return missing === "marker" ? `[${name.replace(/_/g, " ")}]` : "";
  });
}

export function listPlaceholders(text: string): string[] {
  return [...new Set([...text.matchAll(PLACEHOLDER)].map((m) => m[1]))];
}

/** Only absolute http(s) links may become buttons. */
export function safeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function asDetails(value: unknown): DetailRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((r): r is { label: unknown; value: unknown } => Boolean(r) && typeof r === "object")
    .map((r) => ({ label: String(r.label ?? ""), value: String(r.value ?? "") }))
    .filter((r) => r.label.length > 0)
    .slice(0, 30);
}

function asLineItems(value: unknown): LineItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((r): r is { description: unknown; amount: unknown } => Boolean(r) && typeof r === "object")
    .map((r) => ({ description: String(r.description ?? ""), amount: String(r.amount ?? "") }))
    .filter((r) => r.description.length > 0)
    .slice(0, 30);
}

function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

const INK = "#15122e";
const BODY = "#3f3b5c";
const MUTED = "#6b6789";
const BORDER = "#e6e3f0";
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

function paragraphsHtml(body: string): string {
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const isQuote = /^["“][\s\S]*["”]$/.test(p);
      const inner = escapeHtml(isQuote ? p.slice(1, -1) : p).replace(/\n/g, "<br>");
      if (isQuote) {
        return `<p style="margin:0 0 16px;padding:12px 16px;border-left:3px solid #c9bfff;background:#f6f4ff;border-radius:6px;font-size:15px;line-height:24px;color:${BODY};">${inner}</p>`;
      }
      return `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${BODY};">${inner}</p>`;
    })
    .join("\n");
}

function detailsHtml(rows: DetailRow[]): string {
  if (!rows.length) return "";
  const trs = rows
    .map(
      (r) =>
        `<tr><td style="padding:8px 0;font-size:14px;color:${MUTED};border-bottom:1px solid ${BORDER};">${escapeHtml(r.label)}</td><td align="right" style="padding:8px 0;font-size:14px;color:${INK};font-weight:600;border-bottom:1px solid ${BORDER};">${escapeHtml(r.value)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;border-collapse:collapse;">${trs}</table>`;
}

function lineItemsHtml(items: LineItem[], total: string | null): string {
  if (!items.length) return "";
  const rows = items
    .map(
      (i) =>
        `<tr><td style="padding:10px 0;font-size:14px;color:${BODY};border-bottom:1px solid ${BORDER};">${escapeHtml(i.description)}</td><td align="right" style="padding:10px 0;font-size:14px;color:${INK};border-bottom:1px solid ${BORDER};white-space:nowrap;">${escapeHtml(i.amount)}</td></tr>`,
    )
    .join("");
  const totalRow = total
    ? `<tr><td style="padding:12px 0 0;font-size:15px;font-weight:700;color:${INK};">Total</td><td align="right" style="padding:12px 0 0;font-size:15px;font-weight:700;color:${INK};white-space:nowrap;">${escapeHtml(total)}</td></tr>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 24px;border-collapse:collapse;"><tr><td style="padding:0 0 8px;font-size:12px;color:${MUTED};">Item</td><td align="right" style="padding:0 0 8px;font-size:12px;color:${MUTED};">Amount</td></tr>${rows}${totalRow}</table>`;
}

function buttonHtml(label: string, url: string, color: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr><td align="center" bgcolor="${escapeHtml(color)}" style="border-radius:10px;"><a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:13px 24px;font-family:${FONT};font-size:15px;font-weight:600;line-height:20px;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(label)}</a></td></tr></table>
<p style="margin:0 0 16px;font-size:12px;line-height:18px;color:${MUTED};">If the button doesn't work, copy this link into your browser:<br><a href="${escapeHtml(url)}" style="color:${MUTED};word-break:break-all;">${escapeHtml(url)}</a></p>`;
}

/**
 * Build subject, HTML and plain text for a template + payload.
 * `missing: "marker"` shows unfilled variables (admin previews).
 */
export function composeEmail(
  template: EmailTemplateRecord,
  payload: Record<string, unknown>,
  ctx: EmailContext,
  opts: { missing?: "empty" | "marker" } = {},
): ComposedEmail {
  const missing = opts.missing ?? "empty";
  const vars: Record<string, string> = {
    brand_name: ctx.brandName,
    support_email: ctx.supportEmail,
    first_name: "there",
    ...payloadToVars(payload),
  };
  const subject = oneLine(fillVars(template.subject, vars, missing)) || ctx.brandName;
  const preheader = oneLine(fillVars(template.preheader ?? "", vars, missing));
  const heading = oneLine(fillVars(template.heading, vars, missing));
  const body = fillVars(template.body, vars, missing);
  const ctaUrl = safeUrl(payload.cta_url);
  const ctaLabel = template.cta_label ? oneLine(fillVars(template.cta_label, vars, missing)) : "";
  const details = asDetails(payload.details);
  const lineItems = asLineItems(payload.line_items);
  const total = typeof payload.total === "string" ? payload.total : null;
  const color = /^#[0-9a-f]{6}$/i.test(ctx.primaryColor) ? ctx.primaryColor : "#5B3DF5";

  const legalLine = [ctx.legalEntityName, ctx.businessAddress].filter(Boolean).map(escapeHtml).join(" · ");
  const supportLine = ctx.supportEmail
    ? `Questions? Reply to this email or contact <a href="mailto:${escapeHtml(ctx.supportEmail)}" style="color:${MUTED};">${escapeHtml(ctx.supportEmail)}</a>.`
    : `Questions? Visit <a href="${escapeHtml(ctx.appUrl)}/learn/support" style="color:${MUTED};">our help centre</a>.`;
  const preferencesLine = template.is_required
    ? "You received this email because it concerns your account or a purchase."
    : `<a href="${escapeHtml(ctx.preferencesUrl)}" style="color:${MUTED};">Manage email preferences</a>`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f3fa;-webkit-text-size-adjust:100%;">
<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3fa;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:${FONT};">
<tr><td style="padding:0 4px 20px;">
<a href="${escapeHtml(ctx.appUrl)}" style="text-decoration:none;color:${INK};"><img src="${escapeHtml(ctx.logoUrl)}" width="32" height="32" alt="" style="vertical-align:middle;border:0;border-radius:8px;"><span style="vertical-align:middle;margin-left:10px;font-size:17px;font-weight:700;letter-spacing:-0.3px;color:${INK};">${escapeHtml(ctx.brandName)}</span></a>
</td></tr>
<tr><td style="background:#ffffff;border:1px solid ${BORDER};border-radius:16px;padding:32px 28px;">
<h1 style="margin:0 0 18px;font-size:22px;line-height:30px;font-weight:700;color:${INK};letter-spacing:-0.3px;">${escapeHtml(heading)}</h1>
${paragraphsHtml(body)}
${detailsHtml(details)}
${lineItemsHtml(lineItems, total)}
${ctaUrl && ctaLabel ? buttonHtml(ctaLabel, ctaUrl, color) : ""}
</td></tr>
<tr><td style="padding:20px 8px 0;font-size:12px;line-height:18px;color:${MUTED};">
<p style="margin:0 0 6px;">${supportLine}</p>
<p style="margin:0 0 6px;"><a href="${escapeHtml(ctx.appUrl)}/legal/terms" style="color:${MUTED};">Terms</a> · <a href="${escapeHtml(ctx.appUrl)}/legal/privacy" style="color:${MUTED};">Privacy</a> · <a href="${escapeHtml(ctx.appUrl)}/legal/refund" style="color:${MUTED};">Refunds</a></p>
<p style="margin:0 0 6px;">${preferencesLine}</p>
${legalLine ? `<p style="margin:0;">${legalLine}</p>` : ""}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const textParts: string[] = [heading, "", body.trim()];
  if (details.length) textParts.push("", ...details.map((d) => `${d.label}: ${d.value}`));
  if (lineItems.length) {
    textParts.push("", ...lineItems.map((i) => `${i.description} — ${i.amount}`));
    if (total) textParts.push(`Total: ${total}`);
  }
  if (ctaUrl && ctaLabel) textParts.push("", `${ctaLabel}: ${ctaUrl}`);
  textParts.push(
    "",
    "—",
    ctx.supportEmail ? `Questions? Contact ${ctx.supportEmail}` : `Help: ${ctx.appUrl}/learn/support`,
    template.is_required ? "You received this email because it concerns your account or a purchase." : `Manage email preferences: ${ctx.preferencesUrl}`,
  );
  if (ctx.legalEntityName || ctx.businessAddress) textParts.push([ctx.legalEntityName, ctx.businessAddress].filter(Boolean).join(" · "));

  return { subject, preheader, html, text: textParts.join("\n").replace(/\n{3,}/g, "\n\n") };
}
