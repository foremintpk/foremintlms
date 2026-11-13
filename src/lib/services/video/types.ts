/**
 * Video provider abstraction. Lessons reference a `video_assets` row; the
 * provider behind it can change without touching the LMS.
 *
 * - youtube: unlisted videos embedded via youtube-nocookie. NOTE: unlisted
 *   videos are viewable by anyone who has the link; we only hand the ID to
 *   authorised learners, but YouTube itself cannot enforce access.
 * - mux: direct uploads, signed playback tokens (JWT) when a signing key is
 *   configured, captions, adaptive quality.
 * - bunny: Bunny Stream library uploads (TUS), token-authenticated embeds.
 */

export type VideoProviderId = "youtube" | "mux" | "bunny";

export type PlaybackSource =
  | { provider: "youtube"; videoId: string; startSeconds: number }
  | {
      provider: "mux";
      playbackId: string;
      /** Signed tokens when the playback policy is signed. */
      tokens: { playback?: string; thumbnail?: string; storyboard?: string };
      startSeconds: number;
      title?: string;
    }
  | { provider: "bunny"; embedUrl: string; startSeconds: number };

export interface CreateUploadResult {
  videoAssetId: string;
  /** How the browser should upload the file. */
  upload:
    | { kind: "mux"; url: string }
    | { kind: "bunny-tus"; endpoint: string; headers: Record<string, string> }
    | { kind: "none" };
}

export interface VideoProvider {
  id: VideoProviderId;
  isConfigured(): Promise<boolean>;
  /** Create a provider-side upload for a new asset owned by a course. */
  createUpload(input: { courseId: string; title: string; createdBy: string }): Promise<CreateUploadResult>;
  /** Short-lived playback details for an authorised viewer. */
  getPlayback(asset: VideoAssetRow, opts: { startSeconds: number; viewerId: string }): Promise<PlaybackSource>;
  /** Refresh processing status/duration from the provider. */
  refresh(asset: VideoAssetRow): Promise<Partial<VideoAssetRow>>;
  remove(asset: VideoAssetRow): Promise<void>;
}

export interface VideoAssetRow {
  id: string;
  provider: VideoProviderId;
  title: string | null;
  course_id: string | null;
  provider_asset_id: string | null;
  provider_upload_id: string | null;
  playback_id: string | null;
  status: "waiting" | "processing" | "ready" | "errored";
  duration_seconds: number | null;
  thumbnail_url: string | null;
  captions: unknown;
  error_message: string | null;
  metadata: unknown;
}
