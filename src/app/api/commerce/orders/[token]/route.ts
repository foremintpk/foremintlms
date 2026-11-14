import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, noStore } from "@/lib/api";
import { checkRateLimit, enforceRateLimit } from "@/lib/security/rate-limit";
import { isSameOriginRequest } from "@/lib/security/request";
import { resendAccessInvitation } from "@/lib/services/invoicing/invitations";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateOrderLink } from "@/lib/services/commerce/orders";
import { loadOrderByToken, logOrderEvent, updateOrder } from "@/lib/services/commerce/store";

/**
 * Self-service actions on an order, authorised by its unguessable access
 * token (the same one in the status page URL):
 * - resend_activation: email a fresh single-use activation link (rate-limited)
 * - retry_link: try again to create the Whop payment link when it failed
 */
const bodySchema = z.object({ action: z.enum(["resend_activation", "retry_link"]) });

export async function POST(req: Request, ctx: RouteContext<"/api/commerce/orders/[token]">) {
  try {
    if (!isSameOriginRequest(req)) return NextResponse.json({ ok: false, error: "Cross-site request refused." }, { status: 403, headers: noStore });
    await enforceRateLimit("order-action", 20, 600);
    const { token } = await ctx.params;
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400, headers: noStore });
    const order = await loadOrderByToken(token);
    if (!order) return NextResponse.json({ ok: false, error: "We couldn't find that order." }, { status: 404, headers: noStore });

    if (parsed.data.action === "resend_activation") {
      if (order.fulfillment_status !== "awaiting_activation") {
        return NextResponse.json({ ok: false, error: "This order doesn't need an activation email." }, { status: 409, headers: noStore });
      }
      if (!(await checkRateLimit(`order-activation-resend:${order.id}`, 3, 3600))) {
        return NextResponse.json({ ok: false, error: "We've already re-sent this email several times. Check your spam folder, or contact support." }, { status: 429, headers: noStore });
      }
      const { data: invite } = await createAdminClient()
        .from("access_invitations")
        .select("id")
        .eq("public_order_id", order.id)
        .in("status", ["pending", "expired"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!invite) return NextResponse.json({ ok: false, error: "No activation is pending for this order." }, { status: 409, headers: noStore });
      await resendAccessInvitation(invite.id);
      await updateOrder(order.id, { activation_sent_count: order.activation_sent_count + 1 });
      await logOrderEvent({ orderId: order.id, type: "activation_resent", data: { by: "learner" } });
      return NextResponse.json({ ok: true, message: "We've sent a new activation link. It replaces the previous one." }, { headers: noStore });
    }

    // retry_link
    if (order.status !== "draft" || new Date(order.expires_at) <= new Date()) {
      return NextResponse.json({ ok: false, error: "This order's link can't be regenerated. Start a new checkout instead." }, { status: 409, headers: noStore });
    }
    const { order: next, error } = await generateOrderLink(order);
    if (error || !next.whop_checkout_url) return NextResponse.json({ ok: false, error: "We still couldn't create the payment link. Please try again later." }, { status: 502, headers: noStore });
    return NextResponse.json({ ok: true, paymentUrl: next.whop_checkout_url, message: "Your payment link is ready." }, { headers: noStore });
  } catch (err) {
    return apiError(err);
  }
}
