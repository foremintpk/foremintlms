import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmailTemplate, renderEmail } from "./render";
import { getResendClient, getSenderConfig } from "./resend";

interface OutboxRow {
  id: string;
  idempotency_key: string;
  template_key: string;
  user_id: string | null;
  to_email: string;
  payload: Record<string, unknown> | null;
  status: string;
  attempts: number;
  max_attempts: number;
  created_at: string;
}

const MAX_BACKOFF_MINUTES = 6 * 60;
/** Queued mail older than this is cancelled instead of retried (e.g. a verification link from last week). */
const MAX_AGE_DAYS = 7;

/** Exponential backoff after a failed attempt: 2, 4, 8 … minutes, capped at 6 hours. */
export function backoffMinutes(attempts: number): number {
  return Math.min(MAX_BACKOFF_MINUTES, 2 ** Math.max(1, attempts));
}

/** Keep provider errors useful but never echo credentials back into the database. */
export function redactError(message: string): string {
  return message
    .replace(/re_[A-Za-z0-9_]{8,}/g, "re_[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .slice(0, 400);
}

function tagValue(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 256);
}

/**
 * Send queued transactional emails. Rows are claimed with SKIP LOCKED (see
 * public.claim_email_outbox), so overlapping cron runs and after() hooks
 * never send the same email twice; Resend's idempotency key protects
 * against duplicates if a send succeeds but the status update fails.
 */
export async function processEmailOutbox(opts: { limit: number }): Promise<{ sent: number; failed: number; skipped: number }> {
  const admin = createAdminClient();
  const result = { sent: 0, failed: 0, skipped: 0 };

  const { data, error } = await admin.rpc("claim_email_outbox", { p_limit: Math.max(1, Math.min(opts.limit, 100)) });
  if (error) {
    console.error("[email] could not claim outbox rows", error.message);
    return result;
  }
  const rows = (data ?? []) as OutboxRow[];
  if (rows.length === 0) return result;

  const [client, sender] = await Promise.all([getResendClient(), getSenderConfig()]);
  const now = Date.now();

  for (const row of rows) {
    const update = async (values: Record<string, unknown>) => {
      const { error: updateError } = await admin.from("email_outbox").update({ locked_at: null, ...values }).eq("id", row.id);
      if (updateError) console.error("[email] status update failed", row.id, updateError.message);
    };

    try {
      if (now - new Date(row.created_at).getTime() > MAX_AGE_DAYS * 86_400_000) {
        await update({ status: "cancelled", last_error: `Not sent within ${MAX_AGE_DAYS} days; cancelled.` });
        result.skipped++;
        continue;
      }

      const template = await getEmailTemplate(row.template_key);
      if (!template) {
        await update({ status: "failed", attempts: row.max_attempts, last_error: `Unknown template "${row.template_key}".` });
        result.failed++;
        continue;
      }
      if (!template.is_enabled && !template.is_required) {
        await update({ status: "skipped", last_error: "Template is disabled in Admin → Email templates." });
        result.skipped++;
        continue;
      }

      if (!client || !sender.from) {
        // Not an attempt against the provider: give the attempt back and
        // retry hourly until credentials are added (or the row ages out).
        await update({
          status: "failed",
          attempts: Math.max(0, row.attempts - 1),
          last_error: !client ? "Resend is not configured." : "No sending address is configured (EMAIL_FROM or Admin → Email templates → Sender).",
          next_attempt_at: new Date(now + 60 * 60_000).toISOString(),
        });
        result.failed++;
        continue;
      }

      const rendered = await renderEmail(row.template_key, row.payload ?? {});
      const { data: sent, error: sendError } = await client.emails.send(
        {
          from: sender.from,
          to: row.to_email,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          replyTo: sender.replyTo ?? undefined,
          headers: { "X-Entity-Ref-ID": row.id },
          tags: [
            { name: "template", value: tagValue(row.template_key) },
            { name: "category", value: tagValue(template.category) },
          ],
        },
        { idempotencyKey: row.idempotency_key.slice(0, 256) },
      );

      if (sendError || !sent) {
        // After max_attempts the claim RPC stops picking the row up; it stays
        // "failed" with the last error visible in Admin → Email templates → Outbox.
        await update({
          status: "failed",
          last_error: redactError(`${sendError?.name ?? "error"}: ${sendError?.message ?? "No response from Resend"}`),
          next_attempt_at: new Date(now + backoffMinutes(row.attempts) * 60_000).toISOString(),
        });
        result.failed++;
        continue;
      }

      await update({ status: "sent", provider_message_id: sent.id, sent_at: new Date().toISOString(), last_error: null });
      result.sent++;
    } catch (err) {
      await update({
        status: "failed",
        last_error: redactError(err instanceof Error ? err.message : "Unexpected error while sending"),
        next_attempt_at: new Date(now + backoffMinutes(row.attempts) * 60_000).toISOString(),
      });
      result.failed++;
    }
  }

  return result;
}
