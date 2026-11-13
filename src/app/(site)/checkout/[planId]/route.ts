import { NextResponse, connection } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { startCheckout } from "@/lib/services/payments/checkout";

const noStore = { "Cache-Control": "private, no-store" };

/**
 * GET /checkout/:planId — starts a purchase. Signed-out visitors are sent
 * to sign in first. Paid plans redirect to Whop's hosted checkout; access is
 * granted later by the verified payment webhook, never by this request.
 */
export async function GET(req: Request, ctx: RouteContext<"/checkout/[planId]">) {
  await connection();
  const { planId } = await ctx.params;
  const url = new URL(req.url);
  const to = (path: string) => NextResponse.redirect(new URL(path, url.origin), { status: 303, headers: noStore });

  if (!z.uuid().safeParse(planId).success) return to("/checkout/unavailable?reason=not_found");

  const user = await getSessionUser();
  if (!user) return to(`/login?next=${encodeURIComponent(`/checkout/${planId}`)}`);
  if (user.accountStatus !== "active") return to("/account-suspended");

  if (!(await checkRateLimit(`checkout:${user.id}`, 20, 600))) {
    return to("/checkout/unavailable?reason=rate_limited");
  }

  try {
    const outcome = await startCheckout(user, planId);
    switch (outcome.kind) {
      case "redirect":
        return NextResponse.redirect(outcome.url, { status: 303, headers: noStore });
      case "granted":
        return to(`${outcome.path}?enrolled=1`);
      case "owned":
        return to(`${outcome.path}${outcome.path.includes("?") ? "&" : "?"}notice=already-enrolled`);
      case "unavailable":
        return to(`/checkout/unavailable?reason=${outcome.reason}&plan=${planId}`);
    }
  } catch (err) {
    console.error("[checkout] failed", err);
    return to(`/checkout/unavailable?reason=provider_error&plan=${planId}`);
  }
}
