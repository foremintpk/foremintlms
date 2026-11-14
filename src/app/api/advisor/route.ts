import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, noStore } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { isSameOriginRequest } from "@/lib/security/request";
import { couponCodeSchema } from "@/lib/domain/commerce";
import { handleAdvisorTurn } from "@/lib/services/advisor/service";

/**
 * POST /api/advisor — one turn of the rule-based course advisor (no AI).
 * Accepts a typed message or a button action and returns the reply blocks
 * plus the shared, server-priced cart.
 */
const bodySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("message"), text: z.string().trim().min(1).max(500) }),
  z.object({ type: z.literal("option"), intent: z.string().regex(/^[a-z0-9_]{2,60}$/), label: z.string().trim().min(1).max(120) }),
  z.object({ type: z.literal("add"), courseIds: z.array(z.uuid()).min(1).max(10) }),
  z.object({ type: z.literal("remove"), courseId: z.uuid() }),
  z.object({ type: z.literal("view_cart") }),
  z.object({ type: z.literal("coupon"), code: couponCodeSchema.optional() }),
  z.object({ type: z.literal("email"), email: z.string().trim().min(3).max(254) }),
  z.object({ type: z.literal("request_link") }),
  z.object({ type: z.literal("checkout_opened") }),
  z.object({ type: z.literal("reset") }),
]);

export async function POST(req: Request) {
  try {
    if (!isSameOriginRequest(req)) return NextResponse.json({ error: "Cross-site request refused." }, { status: 403, headers: noStore });
    await enforceRateLimit("advisor", 60, 600);
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "I couldn't read that message. Try again." }, { status: 400, headers: noStore });
    const user = await getSessionUser().catch(() => null);
    const reply = await handleAdvisorTurn(parsed.data, { accountEmail: user && user.accountStatus === "active" ? user.email : null });
    return NextResponse.json(reply, { headers: noStore });
  } catch (err) {
    return apiError(err);
  }
}
