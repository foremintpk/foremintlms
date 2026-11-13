import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

/**
 * Store an incoming provider webhook once. Returns null when the event was
 * already received (duplicate delivery) so the handler can acknowledge it
 * without processing it twice.
 */
export async function recordWebhookEvent(input: {
  provider: "mux" | "bunny";
  eventId: string;
  eventType: string;
  payload: unknown;
}): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("webhook_events")
    .insert({
      provider: input.provider,
      event_id: input.eventId.slice(0, 200),
      event_type: input.eventType.slice(0, 120),
      payload: input.payload as Json,
      status: "processing",
      attempts: 1,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") {
      // Already received: re-run only if the earlier attempt failed.
      const { data: existing } = await admin
        .from("webhook_events")
        .select("id, status")
        .eq("provider", input.provider)
        .eq("event_id", input.eventId.slice(0, 200))
        .maybeSingle();
      if (existing && existing.status === "failed") {
        await admin.from("webhook_events").update({ status: "processing" }).eq("id", existing.id);
        return existing.id;
      }
      return null;
    }
    throw new Error(`webhook_events insert failed: ${error.message}`);
  }
  return data.id;
}

export async function finishWebhookEvent(id: string, outcome: "processed" | "ignored" | "failed", errorMessage?: string) {
  await createAdminClient()
    .from("webhook_events")
    .update({
      status: outcome,
      processed_at: outcome === "failed" ? null : new Date().toISOString(),
      last_error: errorMessage?.slice(0, 1000) ?? null,
      next_attempt_at: outcome === "failed" ? new Date(Date.now() + 10 * 60_000).toISOString() : null,
    })
    .eq("id", id);
}
