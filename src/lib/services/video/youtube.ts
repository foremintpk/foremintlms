import "server-only";
import { UserFacingError } from "@/lib/actions";
import { getIntegration } from "@/lib/services/integrations";
import type { CreateUploadResult, PlaybackSource, VideoAssetRow, VideoProvider } from "./types";
import { parseYouTubeId, youTubeThumbnail, youTubeWatchUrl } from "./youtube-id";

/**
 * YouTube (unlisted) provider.
 *
 * Limitation (documented for admins): YouTube cannot enforce our access
 * rules. We only send the video ID to learners who pass our checks, but an
 * unlisted video can be watched by anyone who obtains its link. Use Mux or
 * Bunny with signed playback for paid content that must stay protected.
 */

export interface YouTubeMeta {
  videoId: string;
  title: string;
  authorName: string | null;
  thumbnailUrl: string;
}

/** Validate a YouTube link/ID with the public oEmbed endpoint (works for public and unlisted videos). */
export async function lookupYouTubeVideo(input: string): Promise<YouTubeMeta> {
  const videoId = parseYouTubeId(input);
  if (!videoId) throw new UserFacingError("That doesn't look like a YouTube link or video ID.");
  const res = await fetch(
    `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(youTubeWatchUrl(videoId))}`,
    { signal: AbortSignal.timeout(8000), cache: "no-store" },
  ).catch(() => null);
  if (!res) throw new UserFacingError("YouTube didn't respond. Try again in a moment.");
  if (res.status === 401 || res.status === 403) {
    throw new UserFacingError("This video is private or can't be embedded. Set it to Unlisted and allow embedding in YouTube Studio.");
  }
  if (res.status === 404 || res.status === 400) throw new UserFacingError("We couldn't find that YouTube video.");
  if (!res.ok) throw new UserFacingError("YouTube couldn't confirm this video. Try again in a moment.");
  const body = (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
  return {
    videoId,
    title: body.title?.slice(0, 200) || "YouTube video",
    authorName: body.author_name ?? null,
    thumbnailUrl: youTubeThumbnail(videoId),
  };
}

export const youtubeProvider: VideoProvider = {
  id: "youtube",
  async isConfigured() {
    return (await getIntegration("youtube")).enabled;
  },
  async createUpload(): Promise<CreateUploadResult> {
    // YouTube videos are added by link, not uploaded through the platform.
    throw new UserFacingError("Add YouTube videos by pasting their link.");
  },
  async getPlayback(asset: VideoAssetRow, opts): Promise<PlaybackSource> {
    const videoId = asset.playback_id ?? asset.provider_asset_id;
    if (!videoId) throw new Error(`YouTube asset ${asset.id} has no video ID`);
    return { provider: "youtube", videoId, startSeconds: Math.max(0, Math.floor(opts.startSeconds)) };
  },
  async refresh(asset: VideoAssetRow) {
    const videoId = asset.playback_id ?? asset.provider_asset_id;
    if (!videoId) return { status: "errored", error_message: "Missing YouTube video ID" };
    try {
      const meta = await lookupYouTubeVideo(videoId);
      return { status: "ready", title: asset.title ?? meta.title, thumbnail_url: meta.thumbnailUrl, error_message: null };
    } catch (err) {
      if (err instanceof UserFacingError) return { status: "errored", error_message: err.message };
      return {};
    }
  },
  async remove() {
    // Nothing to delete on our side: the video lives in the author's YouTube account.
  },
};
