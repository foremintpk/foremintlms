import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

export interface EnqueueEmailInput {
  templateKey: string;
  to: string;
  userId?: string | null;
  payload?: Record<string, unknown>;
  /** Same key ⇒ the email is queued at most once (webhook retries, double clicks). */
  idempotencyKey: string;
  sendAt?: Date;
}

/**
 * Queue a transactional email. Rows are durable: if sending fails or the
 * process dies, the cron worker retries with backoff. A best-effort send is
 * attempted right after the response is flushed.
 */
export async function enqueueEmail(input: EnqueueEmailInput): Promise<{ queued: boolean }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("email_outbox")
    .upsert(
      {
        idempotency_key: input.idempotencyKey,
        template_key: input.templateKey,
        user_id: input.userId ?? null,
        to_email: input.to,
        payload: (input.payload ?? {}) as Json,
        next_attempt_at: (input.sendAt ?? new Date()).toISOString(),
      },
      { onConflict: "idempotency_key", ignoreDuplicates: true },
    )
    .select("id");
  if (error) {
    console.error("[email] enqueue failed", input.templateKey, error.message);
    return { queued: false };
  }
  const queued = (data?.length ?? 0) > 0;
  if (queued && !input.sendAt) {
    try {
      after(async () => {
        const { processEmailOutbox } = await import("./worker");
        await processEmailOutbox({ limit: 10 });
      });
    } catch {
      // Outside a request scope (e.g. scripts) — the cron worker will send it.
    }
  }
  return { queued };
}
