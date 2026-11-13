import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl } from "@/lib/env";
import { enqueueEmail } from "@/lib/services/email/outbox";
import { getFirstName, logAuthEvent, postSignInDestination } from "@/lib/services/account";
import { isConfirmType, safeNextPath } from "@/components/auth/utils";

/**
 * Landing point for every emailed auth link (verification, magic link,
 * password recovery, email change). Verifies the single-use token hash and
 * establishes the session in cookies.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = safeNextPath(url.searchParams.get("next"), "");

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(reason)}`, appUrl()), { headers: { "Cache-Control": "no-store" } });

  if (!tokenHash || !isConfirmType(type) || tokenHash.length > 200) return fail("invalid_link");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error || !data.user) {
    return fail(type === "recovery" ? "reset_link_expired" : "link_expired");
  }

  const user = data.user;
  const email = user.email ?? null;

  if (type === "recovery") {
    return NextResponse.redirect(new URL("/reset-password", appUrl()), { headers: { "Cache-Control": "no-store" } });
  }

  if (type === "signup" || type === "magiclink" || type === "email") {
    const admin = createAdminClient();
    const { count } = await admin
      .from("auth_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("event", "email_verified");
    if ((count ?? 0) === 0) {
      await logAuthEvent({ userId: user.id, email, event: "email_verified" });
      if (email) {
        await enqueueEmail({
          templateKey: "auth.welcome",
          to: email,
          userId: user.id,
          idempotencyKey: `welcome:${user.id}`,
          payload: { first_name: await getFirstName(user.id), cta_url: appUrl("/courses") },
        });
      }
    }
    await logAuthEvent({ userId: user.id, email, event: "sign_in", metadata: { method: type } });
  }

  const aal = (await supabase.auth.getClaims()).data?.claims?.aal as string | undefined;
  const destination = await postSignInDestination(user.id, aal, next || null);
  return NextResponse.redirect(new URL(destination, appUrl()), { headers: { "Cache-Control": "no-store" } });
}
