import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl } from "@/lib/env";
import { logAuthEvent, postSignInDestination } from "@/lib/services/account";
import { safeNextPath } from "@/components/auth/utils";

/** OAuth (Google) PKCE code exchange. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"), "");
  const noStore = { headers: { "Cache-Control": "no-store" } };

  if (!code) {
    const providerError = url.searchParams.get("error_description") ? "oauth_denied" : "invalid_link";
    return NextResponse.redirect(new URL(`/login?error=${providerError}`, appUrl()), noStore);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", appUrl()), noStore);
  }

  const { data: account } = await createAdminClient().from("profile_private").select("status").eq("user_id", data.user.id).maybeSingle();
  if (account?.status !== "active") {
    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.redirect(new URL("/account-suspended", appUrl()), noStore);
  }

  await logAuthEvent({ userId: data.user.id, email: data.user.email ?? null, event: "sign_in", metadata: { method: "google" } });
  const aal = (await supabase.auth.getClaims()).data?.claims?.aal as string | undefined;
  return NextResponse.redirect(new URL(await postSignInDestination(data.user.id, aal, next || null), appUrl()), noStore);
}
