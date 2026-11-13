import { handleConnect } from "@/lib/services/live/oauth-routes";

/** Start connecting the signed-in instructor's google account (OAuth). */
export async function GET(req: Request) {
  return handleConnect(req, "google_meet");
}
