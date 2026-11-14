import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, noStore } from "@/lib/api";
import { isSameOriginRequest } from "@/lib/security/request";
import { getSessionUser } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { couponCodeSchema, durationKeySchema, learnerEmailSchema } from "@/lib/domain/commerce";
import type { CartView } from "@/lib/domain/commerce-view";
import {
  addCoursesToCart,
  cartView,
  getOrCreateCart,
  loadCart,
  quoteCart,
  removeCourseFromCart,
  saveCart,
  setCartDuration,
} from "@/lib/services/commerce/cart";

/**
 * The shared course-package cart (course selector, checkout, advisor).
 * GET returns the server-priced cart; POST applies one operation. Requests
 * carry course ids, an access period, a coupon code or an email — never a
 * price. Every response is re-priced from the database.
 */

const opSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add"), courseIds: z.array(z.uuid()).min(1).max(50) }),
  z.object({ op: z.literal("remove"), courseId: z.uuid() }),
  z.object({ op: z.literal("set_duration"), duration: durationKeySchema }),
  z.object({ op: z.literal("apply_coupon"), code: couponCodeSchema }),
  z.object({ op: z.literal("remove_coupon") }),
  z.object({ op: z.literal("set_email"), email: learnerEmailSchema }),
  z.object({ op: z.literal("clear") }),
]);

async function accountEmail(): Promise<string | null> {
  const user = await getSessionUser().catch(() => null);
  return user && user.accountStatus === "active" ? user.email : null;
}

function respond(body: { ok: true; cart: CartView; message?: string } | { ok: false; error: string; cart?: CartView }, status = 200) {
  return NextResponse.json(body, { status, headers: noStore });
}

export async function GET() {
  try {
    await enforceRateLimit("cart-read", 300, 600);
    const [cart, email] = await Promise.all([loadCart(), accountEmail()]);
    return respond({ ok: true, cart: await cartView(cart, { accountEmail: email }) });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: Request) {
  try {
    if (!isSameOriginRequest(req)) return NextResponse.json({ ok: false, error: "Cross-site request refused." }, { status: 403, headers: noStore });
    await enforceRateLimit("cart-write", 120, 600);
    const body = opSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return respond({ ok: false, error: body.error.issues[0]?.message ?? "Invalid request." }, 400);
    const input = body.data;
    // Writes skip the session lookup: the account email is only a checkout prefill, kept by the browser from the first GET.

    if (input.op === "clear") {
      const existing = await loadCart();
      const cart = existing ? await saveCart(existing, { course_ids: [], coupon_code: null }) : null;
      return respond({ ok: true, cart: await cartView(cart), message: "Your learning package is empty." });
    }

    let cart = await getOrCreateCart();
    let message: string | undefined;
    switch (input.op) {
      case "add": {
        const res = await addCoursesToCart(cart, input.courseIds);
        cart = res.cart;
        if (res.rejected) {
          return respond({ ok: false, error: res.rejected, cart: await cartView(cart) }, 409);
        }
        message = res.added.length === 1 ? "Added to your learning package." : res.added.length > 1 ? `${res.added.length} courses added to your learning package.` : "Already in your learning package.";
        break;
      }
      case "remove":
        cart = await removeCourseFromCart(cart, input.courseId);
        message = "Removed from your learning package.";
        break;
      case "set_duration":
        cart = await setCartDuration(cart, input.duration);
        break;
      case "set_email":
        cart = await saveCart(cart, { learner_email: input.email });
        break;
      case "remove_coupon":
        cart = await saveCart(cart, { coupon_code: null });
        message = "Discount code removed.";
        break;
      case "apply_coupon": {
        // Extra limit on code attempts so codes can't be guessed by brute force.
        await enforceRateLimit("coupon-check", 20, 600);
        const candidate = { ...cart, coupon_code: input.code.toUpperCase() };
        const quote = await quoteCart(candidate);
        const evaluation = quote.coupon?.evaluation;
        if (!evaluation || !evaluation.ok) {
          return respond({ ok: false, error: evaluation && !evaluation.ok ? evaluation.message : "That code isn't valid.", cart: await cartView(cart) }, 422);
        }
        cart = await saveCart(cart, { coupon_code: input.code.toUpperCase() });
        message = `${evaluation.label} applied.`;
        break;
      }
    }
    return respond({ ok: true, cart: await cartView(cart), message });
  } catch (err) {
    return apiError(err);
  }
}
