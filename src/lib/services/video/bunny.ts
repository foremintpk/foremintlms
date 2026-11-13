import "server-only";
import { getIntegration, IntegrationNotConfiguredError } from "@/lib/services/integrations";
import { insertVideoAsset, updateVideoAsset } from "./assets";
import { bunnyEmbedUrl, bunnyTusSignature, mapBunnyStatus } from "./bunny-sign";
import type { CreateUploadResult, PlaybackSource, VideoAssetRow, VideoProvider } from "./types";

/**
 * Bunny Stream provider.
 * Docs: https://docs.bunny.net/reference/video_createvideo (create),
 *       https://docs.bunny.net/reference/video_getvideo (status),
 *       https://docs.bunny.net/reference/tus-resumable-uploads (browser uploads),
 *       https://docs.bunny.net/docs/stream-embed-token-authentication (signed embeds).
 */

const API = "https://video.bunnycdn.com";
const TUS_ENDPOINT = "https://video.bunnycdn.com/tusupload";

export async function getBunnyConfig() {
  const cfg = await getIntegration("bunny");
  return { ...cfg, configured: Boolean(cfg.libraryId && cfg.apiKey) };
}

async function requireBunny() {
  const cfg = await getBunnyConfig();
  if (!cfg.configured) throw new IntegrationNotConfiguredError("bunny");
  return cfg as typeof cfg & { libraryId: string; apiKey: string };
}

export interface BunnyVideo {
  guid: string;
  title: string;
  status: number;
  length: number;
  thumbnailFileName: string | null;
  encodeProgress: number;
  width: number;
  height: number;
  captions: { srclang: string | null; label: string | null }[] | null;
}

async function bunnyFetch<T>(path: string, init: RequestInit & { apiKey: string }): Promise<T> {
  const { apiKey, ...rest } = init;
  const res = await fetch(`${API}${path}`, {
    ...rest,
    headers: { AccessKey: apiKey, accept: "application/json", "content-type": "application/json", ...(rest.headers ?? {}) },
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = new Error(`Bunny API ${rest.method ?? "GET"} ${path} failed with ${res.status}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export async function getBunnyVideo(videoId: string): Promise<BunnyVideo> {
  const cfg = await requireBunny();
  return bunnyFetch<BunnyVideo>(`/library/${encodeURIComponent(cfg.libraryId)}/videos/${encodeURIComponent(videoId)}`, {
    apiKey: cfg.apiKey,
  });
}

export function bunnyVideoPatch(video: BunnyVideo, cdnHostname?: string): Partial<VideoAssetRow> {
  const status = mapBunnyStatus(video.status);
  return {
    status,
    duration_seconds: video.length > 0 ? video.length : null,
    thumbnail_url: cdnHostname && video.thumbnailFileName ? `https://${cdnHostname}/${video.guid}/${video.thumbnailFileName}` : null,
    captions: (video.captions ?? []).map((c) => ({ language: c.srclang, label: c.label ?? c.srclang ?? "Captions" })),
    error_message: status === "errored" ? "Bunny could not process this video" : null,
  };
}

export const bunnyProvider: VideoProvider = {
  id: "bunny",
  async isConfigured() {
    return (await getBunnyConfig()).configured;
  },

  async createUpload(input): Promise<CreateUploadResult> {
    const cfg = await requireBunny();
    const asset = await insertVideoAsset({
      provider: "bunny",
      title: input.title,
      courseId: input.courseId,
      createdBy: input.createdBy,
      status: "waiting",
      metadata: { token_auth: Boolean(cfg.tokenKey) },
    });
    try {
      const video = await bunnyFetch<BunnyVideo>(`/library/${encodeURIComponent(cfg.libraryId)}/videos`, {
        apiKey: cfg.apiKey,
        method: "POST",
        body: JSON.stringify({ title: input.title.slice(0, 200) }),
      });
      await updateVideoAsset(asset.id, { provider_asset_id: video.guid, playback_id: video.guid });
      const expires = Math.floor(Date.now() / 1000) + 24 * 3600;
      return {
        videoAssetId: asset.id,
        upload: {
          kind: "bunny-tus",
          endpoint: TUS_ENDPOINT,
          headers: {
            AuthorizationSignature: bunnyTusSignature(cfg.libraryId, cfg.apiKey, expires, video.guid),
            AuthorizationExpire: String(expires),
            VideoId: video.guid,
            LibraryId: cfg.libraryId,
          },
        },
      };
    } catch (err) {
      await updateVideoAsset(asset.id, { status: "errored", error_message: "Could not start the Bunny upload" });
      throw err;
    }
  },

  async getPlayback(asset, opts): Promise<PlaybackSource> {
    const cfg = await requireBunny();
    const videoId = asset.provider_asset_id;
    if (!videoId) throw new Error(`Bunny asset ${asset.id} has no video ID`);
    return {
      provider: "bunny",
      embedUrl: bunnyEmbedUrl({
        libraryId: cfg.libraryId,
        videoId,
        tokenKey: cfg.tokenKey,
        expiresAt: Math.floor(Date.now() / 1000) + 3 * 3600,
        startSeconds: opts.startSeconds,
      }),
      startSeconds: Math.max(0, Math.floor(opts.startSeconds)),
    };
  },

  async refresh(asset) {
    if (!asset.provider_asset_id) return { status: "errored", error_message: "Missing Bunny video ID" };
    const cfg = await requireBunny();
    try {
      const video = await getBunnyVideo(asset.provider_asset_id);
      return bunnyVideoPatch(video, cfg.cdnHostname);
    } catch (err) {
      if ((err as { status?: number }).status === 404) return { status: "errored", error_message: "The video was deleted in Bunny" };
      throw err;
    }
  },

  async remove(asset) {
    if (!asset.provider_asset_id) return;
    const cfg = await requireBunny();
    await bunnyFetch(`/library/${encodeURIComponent(cfg.libraryId)}/videos/${encodeURIComponent(asset.provider_asset_id)}`, {
      apiKey: cfg.apiKey,
      method: "DELETE",
    }).catch((err: { status?: number }) => {
      if (err.status !== 404) throw err;
    });
  },
};

export async function testBunny(): Promise<{ ok: boolean; message: string }> {
  const cfg = await getBunnyConfig();
  if (!cfg.configured) return { ok: false, message: "Add the Bunny Stream library ID and API key." };
  try {
    await bunnyFetch(`/library/${encodeURIComponent(cfg.libraryId!)}/videos?page=1&itemsPerPage=1`, { apiKey: cfg.apiKey! });
    const notes = [
      cfg.tokenKey ? "token-authenticated embeds on" : "token authentication off (add the library's token key to protect embeds)",
      cfg.cdnHostname ? "thumbnails on" : "CDN hostname missing — thumbnails off",
    ];
    return { ok: true, message: `Connected to Bunny Stream · ${notes.join(" · ")}` };
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 401 || status === 403) return { ok: false, message: "Bunny rejected the API key for this library." };
    if (status === 404) return { ok: false, message: "Bunny couldn't find that video library." };
    return { ok: false, message: "Bunny didn't respond. Check the credentials and try again." };
  }
}
