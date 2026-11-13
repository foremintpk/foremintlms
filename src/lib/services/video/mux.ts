import "server-only";
import Mux from "@mux/mux-node";
import { appUrl } from "@/lib/env";
import { getIntegration, IntegrationNotConfiguredError } from "@/lib/services/integrations";
import { insertVideoAsset, updateVideoAsset } from "./assets";
import type { CreateUploadResult, PlaybackSource, VideoAssetRow, VideoProvider } from "./types";

/**
 * Mux Video provider.
 * Docs: https://www.mux.com/docs/guides/upload-files-directly (direct uploads),
 *       https://www.mux.com/docs/guides/secure-video-playback (signed playback),
 *       https://www.mux.com/docs/core/listen-for-webhooks (webhooks).
 * SDK: @mux/mux-node — video.uploads.create, video.assets.retrieve,
 *      jwt.signPlaybackId, webhooks.unwrap.
 */

export async function getMuxConfig() {
  const cfg = await getIntegration("mux");
  return {
    ...cfg,
    configured: Boolean(cfg.tokenId && cfg.tokenSecret),
    signed: Boolean(cfg.signingKeyId && cfg.signingPrivateKey),
  };
}

export async function getMuxClient(): Promise<Mux> {
  const cfg = await getMuxConfig();
  if (!cfg.configured) throw new IntegrationNotConfiguredError("mux");
  return new Mux({
    tokenId: cfg.tokenId,
    tokenSecret: cfg.tokenSecret,
    webhookSecret: cfg.webhookSecret ?? null,
    jwtSigningKey: cfg.signingKeyId ?? null,
    jwtPrivateKey: cfg.signingPrivateKey ?? null,
  });
}

type MuxAsset = Awaited<ReturnType<Mux["video"]["assets"]["retrieve"]>>;

/** Map a Mux asset to our video_assets columns. */
export function muxAssetPatch(asset: MuxAsset): Partial<VideoAssetRow> & { metadata?: Record<string, unknown> } {
  const status: VideoAssetRow["status"] = asset.status === "ready" ? "ready" : asset.status === "errored" ? "errored" : "processing";
  const playback = asset.playback_ids?.find((p) => p.policy === "signed") ?? asset.playback_ids?.find((p) => p.policy === "public");
  const captions = (asset.tracks ?? [])
    .filter((t) => t.type === "text" && t.status === "ready")
    .map((t) => ({ id: t.id, language: t.language_code ?? null, label: t.name ?? t.language_code ?? "Captions" }));
  return {
    provider_asset_id: asset.id,
    status,
    playback_id: playback?.id ?? null,
    duration_seconds: typeof asset.duration === "number" ? Math.round(asset.duration * 100) / 100 : null,
    thumbnail_url: playback && playback.policy === "public" ? `https://image.mux.com/${playback.id}/thumbnail.webp?width=640` : null,
    captions,
    error_message: status === "errored" ? (asset.errors?.messages?.join("; ") ?? "Mux could not process this video") : null,
    metadata: {
      playback_policy: playback?.policy ?? null,
      aspect_ratio: asset.aspect_ratio ?? null,
      resolution_tier: asset.resolution_tier ?? null,
    },
  };
}

export const muxProvider: VideoProvider = {
  id: "mux",
  async isConfigured() {
    return (await getMuxConfig()).configured;
  },

  async createUpload(input): Promise<CreateUploadResult> {
    const cfg = await getMuxConfig();
    const mux = await getMuxClient();
    const asset = await insertVideoAsset({
      provider: "mux",
      title: input.title,
      courseId: input.courseId,
      createdBy: input.createdBy,
      status: "waiting",
      metadata: { playback_policy: cfg.signed ? "signed" : "public" },
    });
    try {
      const upload = await mux.video.uploads.create({
        cors_origin: appUrl(),
        timeout: 24 * 3600,
        new_asset_settings: {
          playback_policy: [cfg.signed ? "signed" : "public"],
          passthrough: asset.id,
          video_quality: "basic",
          max_resolution_tier: "1080p",
          meta: { title: input.title.slice(0, 200), external_id: asset.id },
          inputs: [{ generated_subtitles: [{ language_code: "en", name: "English (auto-generated)" }] }],
        },
      });
      await updateVideoAsset(asset.id, { provider_upload_id: upload.id });
      if (!upload.url) throw new Error("Mux did not return an upload URL");
      return { videoAssetId: asset.id, upload: { kind: "mux", url: upload.url } };
    } catch (err) {
      await updateVideoAsset(asset.id, { status: "errored", error_message: "Could not start the Mux upload" });
      throw err;
    }
  },

  async getPlayback(asset, opts): Promise<PlaybackSource> {
    if (!asset.playback_id) throw new Error(`Mux asset ${asset.id} has no playback ID yet`);
    const meta = (asset.metadata ?? {}) as { playback_policy?: string };
    const cfg = await getMuxConfig();
    const tokens: { playback?: string; thumbnail?: string; storyboard?: string } = {};
    if (meta.playback_policy === "signed") {
      if (!cfg.signed) throw new IntegrationNotConfiguredError("mux");
      const mux = await getMuxClient();
      const signed = await mux.jwt.signPlaybackId(asset.playback_id, {
        keyId: cfg.signingKeyId,
        keySecret: cfg.signingPrivateKey,
        expiration: "3h",
        type: ["video", "thumbnail", "storyboard"],
        params: { custom: { viewer: opts.viewerId } },
      });
      tokens.playback = signed["playback-token"];
      tokens.thumbnail = signed["thumbnail-token"];
      tokens.storyboard = signed["storyboard-token"];
    }
    return {
      provider: "mux",
      playbackId: asset.playback_id,
      tokens,
      startSeconds: Math.max(0, Math.floor(opts.startSeconds)),
      title: asset.title ?? undefined,
    };
  },

  async refresh(asset) {
    const mux = await getMuxClient();
    let assetId = asset.provider_asset_id;
    if (!assetId && asset.provider_upload_id) {
      const upload = await mux.video.uploads.retrieve(asset.provider_upload_id);
      if (upload.status === "errored" || upload.status === "cancelled" || upload.status === "timed_out") {
        return { status: "errored", error_message: upload.error?.message ?? `Upload ${upload.status.replace("_", " ")}` };
      }
      assetId = upload.asset_id ?? null;
      if (!assetId) return { status: "waiting" };
    }
    if (!assetId) return {};
    const muxAsset = await mux.video.assets.retrieve(assetId);
    const patch = muxAssetPatch(muxAsset);
    return { ...patch, metadata: { ...((asset.metadata as Record<string, unknown>) ?? {}), ...patch.metadata } };
  },

  async remove(asset) {
    const mux = await getMuxClient();
    if (asset.provider_asset_id) {
      await mux.video.assets.delete(asset.provider_asset_id).catch((err: unknown) => {
        if (!(err instanceof Mux.NotFoundError)) throw err;
      });
    } else if (asset.provider_upload_id && asset.status === "waiting") {
      await mux.video.uploads.cancel(asset.provider_upload_id).catch(() => undefined);
    }
  },
};

export async function testMux(): Promise<{ ok: boolean; message: string }> {
  const cfg = await getMuxConfig();
  if (!cfg.configured) return { ok: false, message: "Add a Mux access token ID and secret." };
  try {
    const mux = await getMuxClient();
    await mux.video.assets.list({ limit: 1 });
    const extras = [
      cfg.signed ? "signed playback enabled" : "signed playback off (add a signing key to protect videos)",
      cfg.webhookSecret ? "webhook secret set" : "webhook secret missing — status updates rely on polling",
    ];
    return { ok: true, message: `Connected to Mux · ${extras.join(" · ")}` };
  } catch (err) {
    if (err instanceof Mux.AuthenticationError) return { ok: false, message: "Mux rejected the access token." };
    return { ok: false, message: "Mux didn't respond. Check the credentials and try again." };
  }
}
