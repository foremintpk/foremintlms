import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { assertTeacherOrAdmin, AuthError } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { appUrl } from "@/lib/env";
import { IntegrationNotConfiguredError } from "@/lib/services/integrations";
import { createOAuthState, oauthStateCookieName, OAUTH_STATE_MAX_AGE_SECONDS, safeReturnPath, verifyOAuthState } from "./oauth-state";
import { exchangeGoogleCode, getGoogleUser, googleAuthorizeUrl } from "./google-meet";
import { getConnection, saveConnection } from "./providers";
import { exchangeZoomCode, getZoomUser, zoomAuthorizeUrl } from "./zoom";
import type { MeetingProviderId } from "./types";

/** Shared OAuth connect/callback handlers for Zoom and Google Meet. */

const noStore = { "Cache-Control": "private, no-store" };

function backTo(returnTo: string, provider: MeetingProviderId, status: "connected" | "error" | "not_configured" | "denied", reason?: string) {
  const url = new URL(appUrl(returnTo));
  url.searchParams.set("meeting", provider);
  url.searchParams.set("status", status);
  if (reason) url.searchParams.set("reason", reason.slice(0, 120));
  return NextResponse.redirect(url, { status: 303, headers: noStore });
}

export async function handleConnect(req: Request, provider: MeetingProviderId) {
  const returnTo = safeReturnPath(new URL(req.url).searchParams.get("returnTo"));
  try {
    await assertTeacherOrAdmin();
  } catch (err) {
    if (err instanceof AuthError) {
      const next = encodeURIComponent(`/teach/settings?section=meetings`);
      return NextResponse.redirect(new URL(`/login?next=${next}`, appUrl()), { status: 303, headers: noStore });
    }
    throw err;
  }
  const { state, cookieValue } = createOAuthState(returnTo);
  let authorizeUrl: string;
  try {
    authorizeUrl = provider === "zoom" ? await zoomAuthorizeUrl(state) : await googleAuthorizeUrl(state);
  } catch (err) {
    if (err instanceof IntegrationNotConfiguredError) return backTo(returnTo, provider, "not_configured");
    throw err;
  }
  const res = NextResponse.redirect(authorizeUrl, { status: 303, headers: noStore });
  res.cookies.set(oauthStateCookieName(provider), cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/integrations",
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  });
  return res;
}

export async function handleCallback(req: Request, provider: MeetingProviderId) {
  const url = new URL(req.url);
  const jar = await cookies();
  const cookieName = oauthStateCookieName(provider);
  const verdict = verifyOAuthState(jar.get(cookieName)?.value, url.searchParams.get("state"));
  const fallback = "/teach/settings?section=meetings";

  const finish = (res: NextResponse) => {
    res.cookies.set(cookieName, "", { path: "/api/integrations", maxAge: 0 });
    return res;
  };

  if (!verdict.ok) return finish(backTo(fallback, provider, "error", "The connection request expired or didn't match. Try again."));
  const returnTo = verdict.returnTo;

  if (url.searchParams.get("error")) return finish(backTo(returnTo, provider, "denied"));
  const code = url.searchParams.get("code");
  if (!code) return finish(backTo(returnTo, provider, "error", "No authorization code was returned."));

  let user;
  try {
    user = await assertTeacherOrAdmin();
  } catch {
    return finish(NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(fallback)}`, appUrl()), { status: 303, headers: noStore }));
  }

  try {
    const existing = await getConnection(user.id, provider);
    if (provider === "zoom") {
      const tokens = await exchangeZoomCode(code);
      const account = await getZoomUser(tokens.accessToken);
      await saveConnection(user.id, "zoom", tokens, account, null);
    } else {
      const tokens = await exchangeGoogleCode(code);
      if (tokens.scope && !tokens.scope.includes("meetings.space.created")) {
        return finish(backTo(returnTo, provider, "error", "Allow Google Meet access when asked, then try again."));
      }
      const account = await getGoogleUser(tokens.accessToken);
      await saveConnection(user.id, "google_meet", tokens, account, null);
    }
    await audit({
      actor: user,
      action: existing ? "meeting_account.reconnected" : "meeting_account.connected",
      entityType: "meeting_provider_connection",
      summary: provider,
    });
    return finish(backTo(returnTo, provider, "connected"));
  } catch (err) {
    if (err instanceof IntegrationNotConfiguredError) return finish(backTo(returnTo, provider, "not_configured"));
    console.error(`[live] ${provider} OAuth callback failed`, err);
    return finish(backTo(returnTo, provider, "error", "The provider rejected the connection. Try again."));
  }
}
