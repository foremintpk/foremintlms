import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeEqual } from "@/lib/security/crypto";
import { bunnyVideoPatch, getBunnyConfig, getBunnyVideo } from "@/lib/services/video/bunny";
import { verifyBunnyWebhookSignature } from "@/lib/services/video/bunny-sign";
import { toAssetRow, updateVideoAsset, VIDEO_ASSET_COLUMNS } from "@/lib/services/video/assets";
import { finishWebhookEvent, recordWebhookEvent } from "@/lib/services/video/webhook-events";

/**
 * Bunny Stream webhook receiver (https://docs.bunny.net/docs/stream-webhook).
 *
 * Authentication, in order of preference:
 *  1. Signed delivery: X-BunnyStream-Signature = HMAC-SHA256(raw body) keyed
 *     with the library's read-only API key (set BUNNY_WEBHOOK_SECRET to it).
 *  2. Unsigned delivery: the webhook URL must carry ?secret=<BUNNY_WEBHOOK_SECRET>.
 * Either way the payload is never trusted: the video is re-fetched from the
 * Bunny API before anything is updated.
 */
const payloadSchema = z.object({
  VideoLibraryId: z.union([z.number(), z.string()]),
  VideoGuid: z.string().min(1),
  Status: z.number().int(),
  EventId: z.string().optional(),
  Timestamp: z.string().optional(),
});

export async function POST(req: Request) {
  const cfg = await getBunnyConfig();
  if (!cfg.configured || !cfg.webhookSecret) {
    return NextResponse.json({ error: "Bunny webhooks are not configured" }, { status: 503 });
  }
  const body = await req.text();
  const signature = req.headers.get("x-bunnystream-signature");
  const urlSecret = new URL(req.url).searchParams.get("secret") ?? "";

  const authorised = signature
    ? req.headers.get("x-bunnystream-signature-version") === "v1" &&
      (req.headers.get("x-bunnystream-signature-algorithm") ?? "").toLowerCase() === "hmac-sha256" &&
      verifyBunnyWebhookSignature(body, signature, cfg.webhookSecret)
    : urlSecret.length > 0 && safeEqual(urlSecret, cfg.webhookSecret);
  if (!authorised) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: z.infer<typeof payloadSchema>;
  try {
    payload = payloadSchema.parse(JSON.parse(body));
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (String(payload.VideoLibraryId) !== String(cfg.libraryId)) {
    return NextResponse.json({ received: true, ignored: "other library" });
  }

  const eventId = payload.EventId ?? `${payload.VideoGuid}:${payload.Status}:${payload.Timestamp ?? ""}`;
  const recordId = await recordWebhookEvent({ provider: "bunny", eventId, eventType: `video.status.${payload.Status}`, payload });
  if (!recordId) return NextResponse.json({ received: true, duplicate: true });

  try {
    const { data } = await createAdminClient()
      .from("video_assets")
      .select(VIDEO_ASSET_COLUMNS)
      .eq("provider", "bunny")
      .eq("provider_asset_id", payload.VideoGuid)
      .maybeSingle();
    if (!data) {
      await finishWebhookEvent(recordId, "ignored");
      return NextResponse.json({ received: true });
    }
    const asset = toAssetRow(data as Record<string, unknown>);

    if (payload.Status === 32) {
      await updateVideoAsset(asset.id, { status: "errored", error_message: "The video was deleted in Bunny" });
    } else {
      const video = await getBunnyVideo(payload.VideoGuid).catch((err: { status?: number }) => {
        if (err.status === 404) return null;
        throw err;
      });
      if (!video) await updateVideoAsset(asset.id, { status: "errored", error_message: "The video was deleted in Bunny" });
      else await updateVideoAsset(asset.id, bunnyVideoPatch(video, cfg.cdnHostname));
    }
    await finishWebhookEvent(recordId, "processed");
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[bunny-webhook] processing failed", err);
    await finishWebhookEvent(recordId, "failed", err instanceof Error ? err.message : "Unknown error");
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
