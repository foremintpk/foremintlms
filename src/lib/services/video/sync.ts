import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { toAssetRow, updateVideoAsset, VIDEO_ASSET_COLUMNS } from "./assets";
import { getVideoProvider } from "./index";
import { IntegrationNotConfiguredError } from "@/lib/services/integrations";

const STALE_UPLOAD_HOURS = 48;

/**
 * Cron: refresh Mux/Bunny assets still waiting or processing (in case a
 * webhook was missed) and expire uploads that never arrived.
 */
export async function syncProcessingVideos(): Promise<number> {
  const admin = createAdminClient();
  const settleBefore = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data } = await admin
    .from("video_assets")
    .select(`${VIDEO_ASSET_COLUMNS}, created_at`)
    .in("status", ["waiting", "processing"])
    .in("provider", ["mux", "bunny"])
    .lt("updated_at", settleBefore)
    .order("updated_at", { ascending: true })
    .limit(50);

  let updated = 0;
  for (const raw of data ?? []) {
    const asset = toAssetRow(raw as Record<string, unknown>);
    const createdAt = new Date(String((raw as { created_at: string }).created_at));
    try {
      const patch = await getVideoProvider(asset.provider).refresh(asset);
      const stillWaiting = (patch.status ?? asset.status) === "waiting";
      if (stillWaiting && Date.now() - createdAt.getTime() > STALE_UPLOAD_HOURS * 3600_000) {
        patch.status = "errored";
        patch.error_message = "The upload never finished. Upload the video again.";
      }
      await updateVideoAsset(asset.id, patch);
      updated++;
    } catch (err) {
      if (err instanceof IntegrationNotConfiguredError) continue;
      console.error(`[video-sync] refresh failed for ${asset.id}`, err);
    }
  }
  return updated;
}
