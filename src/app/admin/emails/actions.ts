"use server";

import { after } from "next/server";
import { updateTag } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { assertAdmin } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { appUrl } from "@/lib/env";
import { SETTINGS_TAG } from "@/lib/settings";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { enqueueEmail } from "@/lib/services/email/outbox";
import { EMAIL_TEMPLATES_TAG, getEmailTemplate, renderEmailDraft } from "@/lib/services/email/render";
import { getResendClient, getSenderConfig, testResendConnection } from "@/lib/services/email/resend";
import { samplePayload } from "@/lib/services/email/templates";
import { processEmailOutbox } from "@/lib/services/email/worker";
import type { Json } from "@/types/database";

const templateFields = z.object({
  key: z.string().regex(/^[a-z0-9_.]+$/).max(80),
  subject: z.string().trim().min(1, "Add a subject").max(200),
  preheader: z.string().trim().max(200).optional().default(""),
  heading: z.string().trim().min(1, "Add a heading").max(200),
  body: z.string().trim().min(1, "Add the email text").max(6000),
  ctaLabel: z.string().trim().max(60).optional().default(""),
  isEnabled: z.boolean(),
});

export async function saveEmailTemplateAction(input: z.input<typeof templateFields>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const data = templateFields.parse(input);
    const current = await getEmailTemplate(data.key);
    if (!current) throw new UserFacingError("That template doesn't exist.");
    if (current.is_required && !data.isEnabled) throw new UserFacingError("Security and account emails can't be turned off.");

    const supabase = await createClient();
    const { error } = await supabase
      .from("email_templates")
      .update({
        subject: data.subject,
        preheader: data.preheader || null,
        heading: data.heading,
        body: data.body,
        cta_label: data.ctaLabel || null,
        is_enabled: current.is_required ? true : data.isEnabled,
        updated_by: actor.id,
      })
      .eq("key", data.key);
    if (error) throw new Error(`template update failed: ${error.message}`);
    updateTag(EMAIL_TEMPLATES_TAG);
    await audit({
      actor,
      action: "email_template.updated",
      entityType: "email_template",
      entityId: data.key,
      summary: `Updated email template “${current.name}”`,
      metadata: { enabled: data.isEnabled },
    });
    return ok(null, "Template saved");
  });
}

export async function previewEmailTemplateAction(
  input: z.input<typeof templateFields>,
): Promise<ActionResult<{ subject: string; preheader: string; html: string; text: string }>> {
  return runAction(async () => {
    await assertAdmin();
    const data = templateFields.parse(input);
    const current = await getEmailTemplate(data.key);
    if (!current) throw new UserFacingError("That template doesn't exist.");
    const composed = await renderEmailDraft(
      {
        ...current,
        subject: data.subject,
        preheader: data.preheader || null,
        heading: data.heading,
        body: data.body,
        cta_label: data.ctaLabel || null,
      },
      samplePayload(data.key, appUrl()),
    );
    return ok(composed);
  });
}

export async function sendTestEmailAction(input: { key: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    await enforceRateLimit("email-test", 10, 600, actor.id);
    const key = z.string().regex(/^[a-z0-9_.]+$/).max(80).parse(input.key);
    if (!(await getEmailTemplate(key))) throw new UserFacingError("That template doesn't exist.");
    await enqueueEmail({
      templateKey: key,
      to: actor.email,
      userId: actor.id,
      idempotencyKey: `test:${key}:${actor.id}:${Date.now()}`,
      payload: { ...samplePayload(key, appUrl()), first_name: actor.displayName },
    });
    const [client, sender] = await Promise.all([getResendClient(), getSenderConfig()]);
    if (!client || !sender.from) {
      return ok(null, "Test queued — it will send once Resend and a sending address are configured.");
    }
    return ok(null, `Test email sent to ${actor.email}`);
  });
}

const outboxSchema = z.object({ id: z.uuid() });

export async function retryOutboxEmailAction(input: { id: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const { id } = outboxSchema.parse(input);
    const { data, error } = await createAdminClient()
      .from("email_outbox")
      .update({ status: "pending", attempts: 0, next_attempt_at: new Date().toISOString(), last_error: null, locked_at: null })
      .eq("id", id)
      .in("status", ["failed", "cancelled", "skipped"])
      .select("id, template_key, to_email")
      .maybeSingle();
    if (error) throw new Error(`retry failed: ${error.message}`);
    if (!data) throw new UserFacingError("Only failed, skipped or cancelled emails can be retried.");
    await audit({ actor, action: "email_outbox.retried", entityType: "email_outbox", entityId: id, summary: `Retried ${data.template_key} to ${data.to_email}` });
    after(async () => {
      await processEmailOutbox({ limit: 5 });
    });
    return ok(null, "Email queued to send again");
  });
}

export async function cancelOutboxEmailAction(input: { id: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const { id } = outboxSchema.parse(input);
    const { data, error } = await createAdminClient()
      .from("email_outbox")
      .update({ status: "cancelled", last_error: "Cancelled by an administrator.", locked_at: null })
      .eq("id", id)
      .in("status", ["pending", "failed"])
      .select("id, template_key, to_email")
      .maybeSingle();
    if (error) throw new Error(`cancel failed: ${error.message}`);
    if (!data) throw new UserFacingError("Only queued or failed emails can be cancelled.");
    await audit({ actor, action: "email_outbox.cancelled", entityType: "email_outbox", entityId: id, summary: `Cancelled ${data.template_key} to ${data.to_email}` });
    return ok(null, "Email cancelled");
  });
}

const senderSchema = z.object({
  senderName: z.string().trim().min(1, "Add a sender name").max(80).refine((v) => !/[<>"\r\n]/.test(v), "Remove < > and quote characters"),
  fromAddress: z.union([z.literal(""), z.email("Enter an email address on your verified domain")]),
  replyTo: z.union([z.literal(""), z.email("Enter a valid reply-to address")]),
});

export async function saveSenderSettingsAction(input: z.input<typeof senderSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const data = senderSchema.parse(input);
    const supabase = await createClient();
    const rows = [
      { key: "email.sender_name", value: data.senderName as Json, description: "Display name on outgoing email.", is_public: false, updated_by: actor.id },
      { key: "email.from_address", value: data.fromAddress as Json, description: "From address (must be on a domain verified in Resend). Falls back to EMAIL_FROM.", is_public: false, updated_by: actor.id },
      { key: "email.reply_to", value: data.replyTo as Json, description: "Reply-to address for transactional email.", is_public: false, updated_by: actor.id },
    ];
    const { error } = await supabase.from("platform_settings").upsert(rows, { onConflict: "key" });
    if (error) throw new Error(`sender settings failed: ${error.message}`);
    updateTag(SETTINGS_TAG);
    await audit({ actor, action: "settings.email_sender_updated", entityType: "platform_settings", entityId: "email", summary: "Updated email sender settings", metadata: data });
    return ok(null, "Sender settings saved");
  });
}

export async function testEmailConnectionAction(): Promise<ActionResult<{ ok: boolean; message: string }>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    await enforceRateLimit("resend-test", 10, 600, actor.id);
    return ok(await testResendConnection());
  });
}
