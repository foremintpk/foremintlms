import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicSettings } from "@/lib/settings";
import { appUrl } from "@/lib/env";
import { composeEmail, type ComposedEmail, type EmailContext, type EmailTemplateRecord } from "@/emails/compose";

export const EMAIL_TEMPLATES_TAG = "email-templates";

export interface StoredEmailTemplate extends EmailTemplateRecord {
  name: string;
  description: string | null;
  is_enabled: boolean;
  updated_at: string;
}

async function loadTemplates(): Promise<Record<string, StoredEmailTemplate>> {
  "use cache";
  cacheTag(EMAIL_TEMPLATES_TAG);
  cacheLife("minutes");
  const { data, error } = await createAdminClient()
    .from("email_templates")
    .select("key, name, description, category, subject, preheader, heading, body, cta_label, is_enabled, is_required, updated_at");
  if (error) throw new Error(`Could not load email templates: ${error.message}`);
  return Object.fromEntries(((data ?? []) as StoredEmailTemplate[]).map((t) => [t.key, t]));
}

export async function getEmailTemplate(key: string): Promise<StoredEmailTemplate | null> {
  return (await loadTemplates())[key] ?? null;
}

export async function getEmailContext(): Promise<EmailContext> {
  const s = await getPublicSettings();
  const logo = /^https:\/\//.test(s.logoUrl) ? s.logoUrl : appUrl("/brand/foremint-mark-256.png");
  return {
    brandName: s.brandName,
    appUrl: appUrl(),
    logoUrl: logo,
    supportEmail: s.supportEmail,
    legalEntityName: s.legalEntityName,
    businessAddress: s.businessAddress,
    primaryColor: s.primaryColor,
    preferencesUrl: appUrl("/learn/settings?tab=notifications"),
  };
}

/** Render a stored template with a payload (used by the outbox worker). */
export async function renderEmail(
  templateKey: string,
  payload: Record<string, unknown>,
): Promise<{ subject: string; html: string; text: string }> {
  const template = await getEmailTemplate(templateKey);
  if (!template) throw new Error(`Unknown email template "${templateKey}"`);
  const composed = composeEmail(template, payload, await getEmailContext());
  return { subject: composed.subject, html: composed.html, text: composed.text };
}

/** Render unsaved edits for the admin preview; unfilled variables are shown as markers. */
export async function renderEmailDraft(template: EmailTemplateRecord, payload: Record<string, unknown>): Promise<ComposedEmail> {
  return composeEmail(template, payload, await getEmailContext(), { missing: "marker" });
}
