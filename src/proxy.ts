import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static assets, images, webhooks and cron endpoints
    // (those authenticate themselves and must not have cookies rewritten).
    "/((?!_next/static|_next/image|images/|brand/|fonts/|api/webhooks|api/cron|icon.svg|apple-icon.png|robots.txt|sitemap.xml|.*\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)",
  ],
};
