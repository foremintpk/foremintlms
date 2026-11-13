"use server";

import { z } from "zod";
import { ok, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { assertCourseEditor } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { IntegrationNotConfiguredError } from "@/lib/services/integrations";
import { getVideoProvider, refreshVideoAssetStatus } from "@/lib/services/video";
import { insertVideoAsset, loadVideoAsset } from "@/lib/services/video/assets";
import { lookupYouTubeVideo } from "@/lib/services/video/youtube";
import type { CreateUploadResult } from "@/lib/services/video/types";
import { refreshBuilder, throwDbError } from "@/lib/services/courses/action-helpers";

const uuid = z.uuid();

export interface VideoSummaryDTO {
  id: string;
  provider: "youtube" | "mux" | "bunny";
  title: string | null;
  status: "waiting" | "processing" | "ready" | "errored";
  duration_seconds: number | null;
  thumbnail_url: string | null;
  error_message: string | null;
}

function toDTO(asset: NonNullable<Awaited<ReturnType<typeof loadVideoAsset>>>): VideoSummaryDTO {
  return {
    id: asset.id,
    provider: asset.provider,
    title: asset.title,
    status: asset.status,
    duration_seconds: asset.duration_seconds,
    thumbnail_url: asset.thumbnail_url,
    error_message: asset.error_message,
  };
}

async function assertAssetInCourse(courseId: string, assetId: string) {
  const asset = await loadVideoAsset(assetId);
  if (!asset || asset.course_id !== courseId) throw new UserFacingError("Video not found in this course.");
  return asset;
}

function providerErrors(err: unknown): never {
  if (err instanceof IntegrationNotConfiguredError) throw new UserFacingError(err.message);
  throw err;
}

/** Start a Mux or Bunny upload. The browser then sends the file directly to the provider. */
export async function createVideoUpload(input: {
  courseId: string;
  provider: "mux" | "bunny";
  title: string;
}): Promise<ActionResult<CreateUploadResult>> {
  return runAction(async () => {
    const courseId = uuid.parse(input.courseId);
    const provider = z.enum(["mux", "bunny"]).parse(input.provider);
    const title = z.string().trim().min(1, "Name the video").max(200).parse(input.title);
    const { user } = await assertCourseEditor(courseId);
    const result = await getVideoProvider(provider)
      .createUpload({ courseId, title, createdBy: user.id })
      .catch(providerErrors);
    return ok(result);
  });
}

/** Add an unlisted YouTube video by link (validated through YouTube oEmbed). */
export async function addYouTubeVideo(input: { courseId: string; url: string; title?: string }): Promise<ActionResult<VideoSummaryDTO>> {
  return runAction(async () => {
    const courseId = uuid.parse(input.courseId);
    const { user } = await assertCourseEditor(courseId);
    if (!(await getVideoProvider("youtube").isConfigured())) {
      throw new UserFacingError("YouTube videos are switched off. An administrator can enable them in Integrations.");
    }
    const meta = await lookupYouTubeVideo(z.string().trim().min(1).max(500).parse(input.url));
    const title = input.title?.trim() ? input.title.trim().slice(0, 200) : meta.title;
    const asset = await insertVideoAsset({
      provider: "youtube",
      title,
      courseId,
      createdBy: user.id,
      status: "ready",
      providerAssetId: meta.videoId,
      playbackId: meta.videoId,
      thumbnailUrl: meta.thumbnailUrl,
      metadata: { author: meta.authorName },
    });
    refreshBuilder(courseId);
    return ok(toDTO(asset), "YouTube video added");
  });
}

/** Check the provider for the latest processing status. */
export async function refreshVideo(input: { courseId: string; assetId: string }): Promise<ActionResult<VideoSummaryDTO>> {
  return runAction(async () => {
    const courseId = uuid.parse(input.courseId);
    const assetId = uuid.parse(input.assetId);
    await assertCourseEditor(courseId);
    await assertAssetInCourse(courseId, assetId);
    await refreshVideoAssetStatus(assetId).catch(providerErrors);
    const fresh = await loadVideoAsset(assetId);
    if (!fresh) throw new UserFacingError("Video not found.");
    return ok(toDTO(fresh));
  });
}

/** Called by the browser when an upload finishes so the status moves on without waiting for a webhook. */
export async function markVideoUploaded(input: { courseId: string; assetId: string }): Promise<ActionResult<VideoSummaryDTO>> {
  return runAction(async () => {
    const courseId = uuid.parse(input.courseId);
    const assetId = uuid.parse(input.assetId);
    await assertCourseEditor(courseId);
    const asset = await assertAssetInCourse(courseId, assetId);
    if (asset.status === "waiting") {
      await createAdminClient().from("video_assets").update({ status: "processing" }).eq("id", assetId).eq("status", "waiting");
    }
    await refreshVideoAssetStatus(assetId).catch(() => undefined);
    const fresh = await loadVideoAsset(assetId);
    refreshBuilder(courseId);
    return ok(toDTO(fresh!));
  });
}

export async function renameVideo(input: { courseId: string; assetId: string; title: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const courseId = uuid.parse(input.courseId);
    const assetId = uuid.parse(input.assetId);
    const title = z.string().trim().min(1, "Name the video").max(200).parse(input.title);
    await assertCourseEditor(courseId);
    await assertAssetInCourse(courseId, assetId);
    const { error } = await createAdminClient().from("video_assets").update({ title }).eq("id", assetId);
    throwDbError(error, "rename video");
    refreshBuilder(courseId);
    return ok(null, "Video renamed");
  });
}

/** Delete a video from the provider and the library. Blocks that used it become empty. */
export async function deleteVideo(input: { courseId: string; assetId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const courseId = uuid.parse(input.courseId);
    const assetId = uuid.parse(input.assetId);
    const { user } = await assertCourseEditor(courseId);
    const asset = await assertAssetInCourse(courseId, assetId);
    try {
      await getVideoProvider(asset.provider).remove(asset);
    } catch (err) {
      if (err instanceof IntegrationNotConfiguredError) throw new UserFacingError(err.message);
      console.error("[video] provider delete failed", err);
      throw new UserFacingError("The video provider couldn't delete this video. Try again later.");
    }
    const { error } = await createAdminClient().from("video_assets").delete().eq("id", assetId);
    throwDbError(error, "delete video");
    await audit({ actor: user, action: "video.deleted", entityType: "video_asset", entityId: assetId, metadata: { provider: asset.provider, courseId } });
    refreshBuilder(courseId);
    return ok(null, "Video deleted");
  });
}
