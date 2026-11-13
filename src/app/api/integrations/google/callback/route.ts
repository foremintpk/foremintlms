import { handleCallback } from "@/lib/services/live/oauth-routes";

/** OAuth redirect URI: verifies state, stores encrypted tokens, returns to settings. */
export async function GET(req: Request) {
  return handleCallback(req, "google_meet");
}
