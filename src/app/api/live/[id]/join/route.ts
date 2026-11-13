import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { appUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSafeExternalUrl, liveJoinState } from "@/components/learning/lib";

/**
 * Join a live class: re-checks access (RLS on live_sessions), the join window
 * (15 minutes before start until the end) and the URL, records attendance
 * ("join_click") and redirects to Zoom / Google Meet / the external link.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/live/[id]/join">) {
  const back = (reason: string) => NextResponse.redirect(appUrl(`/learn/live?join=${reason}`), { status: 303 });
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(appUrl(`/login?next=${encodeURIComponent("/learn/live")}`), { status: 303 });
  if (user.accountStatus !== "active") return NextResponse.redirect(appUrl("/account-suspended"), { status: 303 });

  const { id } = await ctx.params;
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return back("not_found");

  const supabase = await createClient();
  const { data } = await supabase
    .from("live_sessions")
    .select("id, starts_at, duration_minutes, status, join_url")
    .eq("id", parsed.data)
    .maybeSingle();
  const session = data as { id: string; starts_at: string; duration_minutes: number; status: string; join_url: string | null } | null;
  if (!session) return back("not_found");

  const state = liveJoinState(session.starts_at, session.duration_minutes, session.status);
  if (state === "canceled") return back("canceled");
  if (state === "ended") return back("ended");
  if (state === "upcoming") return back("early");
  if (!isSafeExternalUrl(session.join_url)) return back("no_link");

  const { error } = await createAdminClient().from("live_session_attendance").insert({
    session_id: session.id,
    user_id: user.id,
    participant_name: user.fullName || user.displayName,
    participant_email: user.email,
    joined_at: new Date().toISOString(),
    source: "join_click",
  });
  if (error && error.code !== "23505") console.error("[live] attendance insert failed", error.message);

  return NextResponse.redirect(session.join_url, { status: 303, headers: { "Cache-Control": "private, no-store" } });
}
