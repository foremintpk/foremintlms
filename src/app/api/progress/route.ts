import { NextResponse } from "next/server";
import { z } from "zod";
import { assertUser } from "@/lib/auth/guards";
import { apiError, noStore } from "@/lib/api";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { recordVideoProgress } from "@/lib/services/progress";

const schema = z.object({
  lessonId: z.uuid(),
  positionSeconds: z.number().min(0).max(60 * 60 * 24),
  durationSeconds: z.number().min(0).max(60 * 60 * 24).nullable().optional(),
});

/**
 * Video progress beacon (player heartbeat, pause and page unload via
 * navigator.sendBeacon). Access to the lesson is re-verified on every call.
 */
export async function POST(req: Request) {
  try {
    const user = await assertUser();
    // ~1 request every 3s sustained per learner is plenty for a heartbeat.
    if (!(await checkRateLimit(`progress:${user.id}`, 120, 300))) {
      return NextResponse.json({ error: "Too many updates." }, { status: 429, headers: noStore });
    }
    const raw = await req.text();
    const input = schema.parse(JSON.parse(raw || "{}"));
    const result = await recordVideoProgress(user, {
      lessonId: input.lessonId,
      positionSeconds: input.positionSeconds,
      durationSeconds: input.durationSeconds ?? null,
    });
    return NextResponse.json(result, { headers: noStore });
  } catch (err) {
    if (err instanceof SyntaxError) return NextResponse.json({ error: "Invalid request." }, { status: 400, headers: noStore });
    return apiError(err);
  }
}
