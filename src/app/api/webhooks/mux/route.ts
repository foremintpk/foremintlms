import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMuxClient, getMuxConfig, muxAssetPatch } from "@/lib/services/video/mux";
import { toAssetRow, updateVideoAsset, VIDEO_ASSET_COLUMNS } from "@/lib/services/video/assets";
import { finishWebhookEvent, recordWebhookEvent } from "@/lib/services/video/webhook-events";

/**
 * Mux webhook receiver (https://www.mux.com/docs/core/listen-for-webhooks).
 * Verifies the `mux-signature` header with the SDK, stores the event once,
 * then updates the matching video_assets row. Asset state is re-read from
 * the Mux API so out-of-order deliveries cannot regress the status.
 */
export async function POST(req: Request) {
  const cfg = await getMuxConfig();
  if (!cfg.configured || !cfg.webhookSecret) {
    return NextResponse.json({ error: "Mux webhooks are not configured" }, { status: 503 });
  }
  const body = await req.text();
  const mux = await getMuxClient();

  let event: Awaited<ReturnType<typeof mux.webhooks.unwrap>>;
  try {
    event = await mux.webhooks.unwrap(body, req.headers, cfg.webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const recordId = await recordWebhookEvent({ provider: "mux", eventId: event.id, eventType: event.type, payload: JSON.parse(body) });
  if (!recordId) return NextResponse.json({ received: true, duplicate: true });

  try {
    const outcome = await handleMuxEvent(event as unknown as MuxEvent, mux);
    await finishWebhookEvent(recordId, outcome);
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[mux-webhook] processing failed", err);
    await finishWebhookEvent(recordId, "failed", err instanceof Error ? err.message : "Unknown error");
    // 500 asks Mux to retry later.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

interface MuxEvent {
  type: string;
  data: {
    id?: string;
    asset_id?: string;
    passthrough?: string;
    new_asset_settings?: { passthrough?: string };
    errors?: { messages?: string[] };
    error?: { message?: string };
  };
}

async function findAsset(event: MuxEvent) {
  const admin = createAdminClient();
  const passthrough = event.data.passthrough ?? event.data.new_asset_settings?.passthrough;
  if (passthrough && /^[0-9a-f-]{36}$/i.test(passthrough)) {
    const { data } = await admin.from("video_assets").select(VIDEO_ASSET_COLUMNS).eq("id", passthrough).eq("provider", "mux").maybeSingle();
    if (data) return toAssetRow(data as Record<string, unknown>);
  }
  const assetId = event.type.startsWith("video.asset.track") ? event.data.asset_id : event.type.startsWith("video.asset") ? event.data.id : event.data.asset_id;
  if (assetId) {
    const { data } = await admin.from("video_assets").select(VIDEO_ASSET_COLUMNS).eq("provider", "mux").eq("provider_asset_id", assetId).maybeSingle();
    if (data) return toAssetRow(data as Record<string, unknown>);
  }
  if (event.type.startsWith("video.upload") && event.data.id) {
    const { data } = await admin.from("video_assets").select(VIDEO_ASSET_COLUMNS).eq("provider", "mux").eq("provider_upload_id", event.data.id).maybeSingle();
    if (data) return toAssetRow(data as Record<string, unknown>);
  }
  return null;
}

async function handleMuxEvent(event: MuxEvent, mux: Awaited<ReturnType<typeof getMuxClient>>): Promise<"processed" | "ignored"> {
  const relevant = [
    "video.upload.asset_created",
    "video.upload.cancelled",
    "video.upload.errored",
    "video.asset.created",
    "video.asset.ready",
    "video.asset.errored",
    "video.asset.updated",
    "video.asset.deleted",
    "video.asset.track.ready",
    "video.asset.track.errored",
  ];
  if (!relevant.includes(event.type)) return "ignored";

  const asset = await findAsset(event);
  if (!asset) return "ignored"; // not created by this platform

  if (event.type === "video.upload.cancelled" || event.type === "video.upload.errored") {
    await updateVideoAsset(asset.id, { status: "errored", error_message: event.data.error?.message ?? "The upload was cancelled" });
    return "processed";
  }
  if (event.type === "video.asset.deleted") {
    await updateVideoAsset(asset.id, { status: "errored", error_message: "The video was deleted in Mux" });
    return "processed";
  }

  const muxAssetId =
    event.type === "video.upload.asset_created" || event.type.startsWith("video.asset.track")
      ? event.data.asset_id
      : event.data.id;
  if (!muxAssetId) return "ignored";

  const fresh = await mux.video.assets.retrieve(muxAssetId);
  const patch = muxAssetPatch(fresh);
  await updateVideoAsset(asset.id, {
    ...patch,
    metadata: { ...((asset.metadata as Record<string, unknown>) ?? {}), ...patch.metadata },
  });
  return "processed";
}
