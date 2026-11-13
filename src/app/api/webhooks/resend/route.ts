import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { getIntegration } from "@/lib/services/integrations";
import type { Json } from "@/types/database";

interface ResendEvent {
  type: string;
  created_at: string;
  data?: { email_id?: string; bounce?: { type?: string; subType?: string; message?: string } } & Record<string, unknown>;
}

/**
 * Resend delivery events (sent, delivered, bounced, complained, …).
 * Signed with Svix; every event is verified, stored once (idempotent on the
 * Svix message id) and linked to its outbox row.
 */
export async function POST(req: Request) {
  const { webhookSecret, apiKey } = await getIntegration("resend");
  if (!webhookSecret) {
    return NextResponse.json({ error: "Resend webhooks are not configured" }, { status: 503 });
  }

  const payload = await req.text();
  const id = req.headers.get("svix-id") ?? req.headers.get("webhook-id");
  const timestamp = req.headers.get("svix-timestamp") ?? req.headers.get("webhook-timestamp");
  const signature = req.headers.get("svix-signature") ?? req.headers.get("webhook-signature");
  if (!id || !timestamp || !signature) return NextResponse.json({ error: "Missing signature headers" }, { status: 400 });

  let event: ResendEvent;
  try {
    // Verification is local (Svix HMAC); the API key is not used for it.
    const resend = new Resend(apiKey || "re_signature_verification_only");
    event = resend.webhooks.verify({ payload, headers: { id, timestamp, signature }, webhookSecret }) as unknown as ResendEvent;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const admin = createAdminClient();
  let eventRowId: string;
  const { data: stored, error: storeError } = await admin
    .from("webhook_events")
    .insert({ provider: "resend", event_id: id, event_type: event.type, payload: event as unknown as Json, status: "processing", attempts: 1 })
    .select("id")
    .single();
  if (storeError || !stored) {
    if (storeError?.code !== "23505") {
      console.error("[resend-webhook] store failed", storeError?.message);
      return NextResponse.json({ error: "Could not store event" }, { status: 500 });
    }
    // Redelivery: done already → acknowledge; previously failed → process again.
    const { data: existing } = await admin
      .from("webhook_events")
      .select("id, status, attempts")
      .eq("provider", "resend")
      .eq("event_id", id)
      .single();
    if (!existing || existing.status === "processed" || existing.status === "ignored") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    eventRowId = existing.id as string;
    await admin.from("webhook_events").update({ status: "processing", attempts: Number(existing.attempts) + 1 }).eq("id", eventRowId);
  } else {
    eventRowId = stored.id as string;
  }

  try {
    const emailId = event.data?.email_id;
    if (event.type.startsWith("email.") && emailId) {
      const { data: outbox } = await admin.from("email_outbox").select("id").eq("provider_message_id", emailId).maybeSingle();
      const { error } = await admin.from("email_delivery_events").insert({
        outbox_id: (outbox?.id as string | undefined) ?? null,
        provider_message_id: emailId,
        event_type: event.type,
        payload: event as unknown as Json,
        occurred_at: event.created_at ?? new Date().toISOString(),
      });
      if (error) throw new Error(error.message);

      // Bounces and spam complaints are surfaced on the outbox row so admins see them.
      if (outbox && (event.type === "email.bounced" || event.type === "email.complained" || event.type === "email.failed")) {
        const detail =
          event.type === "email.bounced"
            ? `Bounced (${event.data?.bounce?.type ?? "unknown"}): ${event.data?.bounce?.message ?? ""}`.trim()
            : event.type === "email.complained"
              ? "Recipient marked the email as spam."
              : "Resend reported a delivery failure.";
        await admin.from("email_outbox").update({ last_error: detail.slice(0, 400) }).eq("id", outbox.id);
      }
    }
    await admin.from("webhook_events").update({ status: event.type.startsWith("email.") ? "processed" : "ignored", processed_at: new Date().toISOString() }).eq("id", eventRowId);
    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 400) : "Processing failed";
    await admin.from("webhook_events").update({ status: "failed", last_error: message }).eq("id", eventRowId);
    console.error("[resend-webhook] processing failed", message);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
