import { NextResponse } from "next/server";
import { z } from "zod";
import { assertUser } from "@/lib/auth/guards";
import { apiError, noStore } from "@/lib/api";
import { appUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { buildIcs } from "@/components/learning/lib";

/** "Add to calendar" file for a live class the learner can access (RLS). */
export async function GET(_req: Request, ctx: RouteContext<"/api/live/[id]/ics">) {
  try {
    await assertUser();
    const { id } = await ctx.params;
    const sessionId = z.uuid().parse(id);
    const supabase = await createClient();
    const { data } = await supabase
      .from("live_sessions")
      .select("id, title, description, starts_at, duration_minutes, status, courses(title)")
      .eq("id", sessionId)
      .maybeSingle();
    const session = data as unknown as {
      id: string;
      title: string;
      description: string | null;
      starts_at: string;
      duration_minutes: number;
      status: string;
      courses: { title: string } | null;
    } | null;
    if (!session) return NextResponse.json({ error: "Live class not found." }, { status: 404, headers: noStore });
    if (session.status === "canceled") return NextResponse.json({ error: "This live class was cancelled." }, { status: 410, headers: noStore });

    const ics = buildIcs({
      uid: `${session.id}@foremint-academy`,
      title: `${session.title}${session.courses?.title ? ` · ${session.courses.title}` : ""}`,
      description: [session.description, `Join from your dashboard: ${appUrl("/learn/live")}`].filter(Boolean).join("\n\n"),
      url: appUrl("/learn/live"),
      start: new Date(session.starts_at),
      durationMinutes: session.duration_minutes,
      stamp: new Date(),
    });
    return new NextResponse(ics, {
      headers: {
        ...noStore,
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="foremint-live-${session.id.slice(0, 8)}.ics"`,
      },
    });
  } catch (err) {
    return apiError(err);
  }
}
