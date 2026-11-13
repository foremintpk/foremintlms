import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json, TablesUpdate } from "@/types/database";
import type { VideoAssetRow, VideoProviderId } from "./types";

/** Data access for video_assets rows (service role; callers authorise first). */

export const VIDEO_ASSET_COLUMNS =
  "id, provider, title, course_id, provider_asset_id, provider_upload_id, playback_id, status, duration_seconds, thumbnail_url, captions, error_message, metadata";

export function toAssetRow(row: Record<string, unknown>): VideoAssetRow {
  return {
    id: String(row.id),
    provider: row.provider as VideoProviderId,
    title: (row.title as string | null) ?? null,
    course_id: (row.course_id as string | null) ?? null,
    provider_asset_id: (row.provider_asset_id as string | null) ?? null,
    provider_upload_id: (row.provider_upload_id as string | null) ?? null,
    playback_id: (row.playback_id as string | null) ?? null,
    status: row.status as VideoAssetRow["status"],
    duration_seconds: row.duration_seconds === null || row.duration_seconds === undefined ? null : Number(row.duration_seconds),
    thumbnail_url: (row.thumbnail_url as string | null) ?? null,
    captions: row.captions ?? [],
    error_message: (row.error_message as string | null) ?? null,
    metadata: row.metadata ?? {},
  };
}

export async function loadVideoAsset(id: string): Promise<VideoAssetRow | null> {
  const { data } = await createAdminClient().from("video_assets").select(VIDEO_ASSET_COLUMNS).eq("id", id).maybeSingle();
  return data ? toAssetRow(data as Record<string, unknown>) : null;
}

export async function insertVideoAsset(input: {
  provider: VideoProviderId;
  title: string;
  courseId: string;
  createdBy: string;
  status?: VideoAssetRow["status"];
  providerAssetId?: string | null;
  playbackId?: string | null;
  thumbnailUrl?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<VideoAssetRow> {
  const { data, error } = await createAdminClient()
    .from("video_assets")
    .insert({
      provider: input.provider,
      title: input.title.slice(0, 200),
      course_id: input.courseId,
      created_by: input.createdBy,
      status: input.status ?? "waiting",
      provider_asset_id: input.providerAssetId ?? null,
      playback_id: input.playbackId ?? null,
      thumbnail_url: input.thumbnailUrl ?? null,
      metadata: (input.metadata ?? {}) as Json,
    })
    .select(VIDEO_ASSET_COLUMNS)
    .single();
  if (error || !data) throw new Error(`video_assets insert failed: ${error?.message}`);
  return toAssetRow(data as Record<string, unknown>);
}

export async function updateVideoAsset(id: string, patch: Partial<VideoAssetRow>): Promise<void> {
  const update: TablesUpdate<"video_assets"> = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.course_id !== undefined) update.course_id = patch.course_id;
  if (patch.provider_asset_id !== undefined) update.provider_asset_id = patch.provider_asset_id;
  if (patch.provider_upload_id !== undefined) update.provider_upload_id = patch.provider_upload_id;
  if (patch.playback_id !== undefined) update.playback_id = patch.playback_id;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.duration_seconds !== undefined) update.duration_seconds = patch.duration_seconds;
  if (patch.thumbnail_url !== undefined) update.thumbnail_url = patch.thumbnail_url;
  if (patch.captions !== undefined) update.captions = patch.captions as Json;
  if (patch.error_message !== undefined) update.error_message = patch.error_message;
  if (patch.metadata !== undefined) update.metadata = patch.metadata as Json;
  if (Object.keys(update).length === 0) return;
  const { error } = await createAdminClient().from("video_assets").update(update).eq("id", id);
  if (error) throw new Error(`video_assets update failed: ${error.message}`);
}
