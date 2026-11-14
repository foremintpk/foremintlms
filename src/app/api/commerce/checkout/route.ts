import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, noStore } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getRequestMeta, isSameOriginRequest } from "@/lib/security/request";
import type { CheckoutResponse } from "@/lib/domain/commerce-view";
import { cartView, loadCart, quoteToView } from "@/lib/services/commerce/cart";
import { checkoutCart } from "@/lib/services/commerce/orders";

/**
 * POST /api/commerce/checkout — create (or reuse) the order for the visitor's
 * cart and its real Whop payment link. Used by both "Proceed to secure
 * checkout" and "Generate & copy payment link". The body carries the learner
 * email and the total the visitor was shown; the server reprices the cart
 * and refuses to continue if the total changed. No sign-in required.
 */

const bodySchema = z.object({
  email: z.string().max(320),
  expectedTotalMinor: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
});

function respond(body: CheckoutResponse, status = 200) {
  return NextResponse.json(body, { status, headers: noStore });
}

export async function POST(req: Request) {
  try {
    if (!isSameOriginRequest(req)) return NextResponse.json({ ok: false, error: "Cross-site request refused." }, { status: 403, headers: noStore });
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return respond({ ok: false, code: "blocked", error: "Invalid request." }, 400);
    const { ip } = await getRequestMeta();
    const emailKey = parsed.data.email.trim().toLowerCase().slice(0, 254);
    if (!(await checkRateLimit(`order-create:${ip ?? "unknown"}`, 10, 600)) || !(await checkRateLimit(`order-create-email:${emailKey}`, 8, 3600))) {
      return respond({ ok: false, code: "rate_limited", error: "Too many attempts. Wait a few minutes and try again." }, 429);
    }

    const user = await getSessionUser().catch(() => null);
    const accountEmail = user && user.accountStatus === "active" ? user.email : null;
    const cart = await loadCart();
    if (!cart || cart.course_ids.length === 0) {
      return respond({ ok: false, code: "blocked", error: "Your learning package is empty.", cart: await cartView(cart, { accountEmail }) }, 409);
    }

    const outcome = await checkoutCart(cart, { email: parsed.data.email, expectedTotalMinor: parsed.data.expectedTotalMinor ?? null, source: "website" });
    const fresh = await loadCart();
    if (!outcome.ok) {
      const view = outcome.quote ? quoteToView(outcome.quote, { email: fresh?.learner_email ?? null, accountEmail, lastOrder: null, courseIds: fresh?.course_ids ?? [] }) : await cartView(fresh, { accountEmail });
      const status = outcome.code === "invalid_email" ? 422 : outcome.code === "price_changed" ? 409 : outcome.code === "provider_error" ? 502 : 409;
      return respond({ ok: false, code: outcome.code, error: outcome.error, cart: view }, status);
    }
    return respond({ ok: true, order: outcome.result, cart: await cartView(fresh, { accountEmail }) });
  } catch (err) {
    return apiError(err);
  }
}
