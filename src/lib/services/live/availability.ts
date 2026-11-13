import "server-only";
import { isMeetingProviderConfigured, listConnectionSummaries } from "./providers";
import type { MeetingProviderId, ProviderAvailability } from "./types";

/** Can this user create Zoom / Google Meet meetings right now? */
export async function getMeetingAvailability(userId: string): Promise<Record<MeetingProviderId, ProviderAvailability>> {
  const [zoomConfigured, googleConfigured, connections] = await Promise.all([
    isMeetingProviderConfigured("zoom"),
    isMeetingProviderConfigured("google_meet"),
    listConnectionSummaries(userId),
  ]);
  const state = (provider: MeetingProviderId, configured: boolean): ProviderAvailability => {
    if (!configured) return "not_configured";
    const connection = connections.find((c) => c.provider === provider);
    if (!connection) return "not_connected";
    return connection.status === "connected" ? "connected" : "needs_reconnect";
  };
  return { zoom: state("zoom", zoomConfigured), google_meet: state("google_meet", googleConfigured) };
}
