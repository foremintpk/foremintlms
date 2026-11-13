import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getIntegration } from "@/lib/services/integrations";
import { verifyZoomSignature, zoomEventId, zoomUrlValidationResponse, type ZoomWebhookEnvelope } from "@/lib/services/live/zoom-webhook";
import type { Json } from "@/types/database";

/**
 * Zoom event subscription endpoint.
 * Subscribe to: meeting.started, meeting.ended, recording.completed,
 * meeting.participant_joined, meeting.participant_left (see docs/teaching-live.md).
 */

type Admin = ReturnType<typeof createAdminClient>;

async function findSession(admin: Admin, meetingId: string | number | undefined) {
  if (meetingId === undefined || meetingId === null) return null;
  const { data } = await admin
    .from("live_sessions")
    .select("id, status, title")
    .eq("provider", "zoom")
    .eq("external_meeting_id", String(meetingId))
    .maybeSingle();
  return data as { id: string; status: string; title: string } | null;
}

async function userIdForEmail(admin: Admin, email: string | undefined | null): Promise<string | null> {
  if (!email) return null;
  const { data } = await admin.from("profile_private").select("user_id").eq("email", email.toLowerCase()).maybeSingle();
  return (data as { user_id: string } | null)?.user_id ?? null;
}

async function handleEvent(admin: Admin, envelope: ZoomWebhookEnvelope): Promise<"processed" | "ignored"> {
  const obj = envelope.payload?.object;
  const session = await findSession(admin, obj?.id);
  if (!session) return "ignored";

  switch (envelope.event) {
    case "meeting.started": {
      if (session.status === "scheduled") await admin.from("live_sessions").update({ status: "live" }).eq("id", session.id);
      return "processed";
    }
    case "meeting.ended": {
      if (session.status !== "canceled") await admin.from("live_sessions").update({ status: "completed" }).eq("id", session.id);
      return "processed";
    }
    case "recording.completed": {
      if (!obj?.share_url) return "ignored";
      const externalId = obj.uuid ?? String(obj.id);
      const { data: existing } = await admin
        .from("meeting_recordings")
        .select("id")
        .eq("session_id", session.id)
        .eq("external_id", externalId)
        .maybeSingle();
      if (!existing) {
        const { error } = await admin.from("meeting_recordings").insert({
          session_id: session.id,
          provider: "zoom",
          external_id: externalId,
          title: obj.topic ? `${obj.topic} recording` : `${session.title} recording`,
          url: obj.share_url,
          passcode: obj.recording_play_passcode ?? obj.password ?? null,
          duration_seconds: typeof obj.duration === "number" ? obj.duration * 60 : null,
          recorded_at: obj.start_time ?? null,
          is_visible: true,
        });
        if (error && error.code !== "23505") throw new Error(error.message);
      }
      return "processed";
    }
    case "meeting.participant_joined": {
      const p = obj?.participant;
      if (!p) return "ignored";
      const { error } = await admin.from("live_session_attendance").insert({
        session_id: session.id,
        user_id: await userIdForEmail(admin, p.email),
        participant_name: p.user_name ?? null,
        participant_email: p.email || null,
        joined_at: p.join_time ?? new Date().toISOString(),
        source: "provider",
      });
      if (error) throw new Error(error.message);
      return "processed";
    }
    case "meeting.participant_left": {
      const p = obj?.participant;
      if (!p) return "ignored";
      const leftAt = p.leave_time ?? new Date().toISOString();
      let query = admin
        .from("live_session_attendance")
        .select("id, joined_at")
        .eq("session_id", session.id)
        .eq("source", "provider")
        .is("left_at", null)
        .order("joined_at", { ascending: false })
        .limit(1);
      query = p.email ? query.eq("participant_email", p.email) : query.eq("participant_name", p.user_name ?? "");
      const { data: open } = await query.maybeSingle();
      if (open) {
        const joined = (open as { joined_at: string | null }).joined_at;
        await admin
          .from("live_session_attendance")
          .update({
            left_at: leftAt,
            duration_seconds: joined ? Math.max(0, Math.round((new Date(leftAt).getTime() - new Date(joined).getTime()) / 1000)) : null,
          })
          .eq("id", (open as { id: string }).id);
      } else {
        await admin.from("live_session_attendance").insert({
          session_id: session.id,
          user_id: await userIdForEmail(admin, p.email),
          participant_name: p.user_name ?? null,
          participant_email: p.email || null,
          left_at: leftAt,
          source: "provider",
        });
      }
      return "processed";
    }
    default:
      return "ignored";
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  let envelope: ZoomWebhookEnvelope;
  try {
    envelope = JSON.parse(rawBody) as ZoomWebhookEnvelope;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { webhookSecretToken } = await getIntegration("zoom");
  if (!webhookSecretToken) {
    return NextResponse.json({ error: "Zoom webhooks are not configured" }, { status: 503 });
  }

  // URL validation proves we hold the secret token; no state is changed.
  if (envelope.event === "endpoint.url_validation") {
    const plainToken = envelope.payload?.plainToken;
    if (!plainToken) return NextResponse.json({ error: "Missing plainToken" }, { status: 400 });
    return NextResponse.json(zoomUrlValidationResponse(webhookSecretToken, plainToken), { status: 200 });
  }

  const check = verifyZoomSignature({
    secretToken: webhookSecretToken,
    signature: req.headers.get("x-zm-signature"),
    timestamp: req.headers.get("x-zm-request-timestamp"),
    rawBody,
  });
  if (!check.ok) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  const admin = createAdminClient();
  const eventId = zoomEventId(envelope, rawBody);

  const { data: existing } = await admin
    .from("webhook_events")
    .select("id, status, attempts")
    .eq("provider", "zoom")
    .eq("event_id", eventId)
    .maybeSingle();
  let rowId: string;
  if (existing) {
    const row = existing as { id: string; status: string; attempts: number };
    if (row.status !== "failed") return NextResponse.json({ received: true, duplicate: true });
    rowId = row.id;
    await admin.from("webhook_events").update({ status: "processing", attempts: row.attempts + 1 }).eq("id", row.id);
  } else {
    const { data: inserted, error } = await admin
      .from("webhook_events")
      .insert({ provider: "zoom", event_id: eventId, event_type: envelope.event, payload: envelope as unknown as Json, status: "processing", attempts: 1 })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ received: true, duplicate: true });
      console.error("[zoom-webhook] store failed", error.message);
      return NextResponse.json({ error: "Could not record event" }, { status: 500 });
    }
    rowId = (inserted as { id: string }).id;
  }

  try {
    const outcome = await handleEvent(admin, envelope);
    await admin.from("webhook_events").update({ status: outcome, processed_at: new Date().toISOString(), last_error: null }).eq("id", rowId);
    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    console.error("[zoom-webhook] processing failed", message);
    await admin.from("webhook_events").update({ status: "failed", last_error: message.slice(0, 500) }).eq("id", rowId);
    // Non-2xx makes Zoom retry; the failed row is reprocessed on retry.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
