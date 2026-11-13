import "server-only";
import { loadVideoAsset, updateVideoAsset } from "./assets";
import { bunnyProvider, testBunny } from "./bunny";
import { muxProvider, testMux } from "./mux";
import type { PlaybackSource, VideoProvider, VideoProviderId } from "./types";
import { youtubeProvider } from "./youtube";

export type { PlaybackSource, VideoProvider, VideoProviderId, VideoAssetRow, CreateUploadResult } from "./types";

const PROVIDERS: Record<VideoProviderId, VideoProvider> = {
  youtube: youtubeProvider,
  mux: muxProvider,
  bunny: bunnyProvider,
};

export function getVideoProvider(id: VideoProviderId): VideoProvider {
  const provider = PROVIDERS[id];
  if (!provider) throw new Error(`Unknown video provider "${id}"`);
  return provider;
}

/**
 * Playback details for a learner. Callers MUST have already verified that
 * `viewerId` may watch the lesson that references this asset; this function
 * only resolves provider-specific (and, for Mux/Bunny, signed) playback.
 * Returns null while the asset is still processing or failed.
 */
export async function getPlaybackForAsset(assetId: string, viewerId: string, startSeconds: number): Promise<PlaybackSource | null> {
  const asset = await loadVideoAsset(assetId);
  if (!asset || asset.status !== "ready") return null;
  try {
    return await getVideoProvider(asset.provider).getPlayback(asset, { startSeconds: Math.max(0, startSeconds || 0), viewerId });
  } catch (err) {
    console.error(`[video] playback failed for asset ${assetId}`, err);
    return null;
  }
}

/** Pull the latest status from the provider and store it. */
export async function refreshVideoAssetStatus(assetId: string) {
  const asset = await loadVideoAsset(assetId);
  if (!asset) return null;
  const patch = await getVideoProvider(asset.provider).refresh(asset);
  await updateVideoAsset(asset.id, patch);
  return { ...asset, ...patch };
}

export async function testVideoProvider(id: VideoProviderId): Promise<{ ok: boolean; message: string }> {
  switch (id) {
    case "mux":
      return testMux();
    case "bunny":
      return testBunny();
    case "youtube":
      return (await youtubeProvider.isConfigured())
        ? { ok: true, message: "YouTube links are enabled. No credentials are needed; videos must be Unlisted with embedding allowed." }
        : { ok: false, message: "YouTube videos are switched off in integration settings." };
  }
}

export async function videoProviderStatuses(): Promise<Record<VideoProviderId, boolean>> {
  const [youtube, mux, bunny] = await Promise.all([
    youtubeProvider.isConfigured(),
    muxProvider.isConfigured(),
    bunnyProvider.isConfigured(),
  ]);
  return { youtube, mux, bunny };
}
