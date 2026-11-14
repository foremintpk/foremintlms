"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/guards";
import { ok, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/domain/commerce";
import {
  approveOrderUnderReview,
  cancelOrder,
  refreshOrderFromWhop,
  resendOrderActivation,
  retryOrderFulfillment,
} from "@/lib/services/commerce/orders";
import { loadOrder } from "@/lib/services/commerce/store";

/**
 * Admin operations on course-package orders. Every one is idempotent on the
 * service side (claims, dedupe keys), audited, and reports UserFacingError
 * messages to the admin as-is.
 */

const orderIdSchema = z.object({ orderId: z.uuid() });
const reasonSchema = orderIdSchema.extend({ reason: z.string().trim().min(3, "Give a reason for the audit log").max(500) });

function refresh(orderId: string) {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
}

export async function refreshOrderStatusAction(input: { orderId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const { orderId } = orderIdSchema.parse(input);
    const order = await loadOrder(orderId);
    if (!order) throw new UserFacingError("Order not found.");
    if (!order.whop_plan_id) throw new UserFacingError("This order has no Whop checkout yet, so there is nothing to check.");
    const before = order.status;
    const next = await refreshOrderFromWhop(order);
    await audit({ actor, action: "order.refresh_status", entityType: "public_course_order", entityId: orderId, summary: `${order.order_number}: ${before} → ${next.status}` });
    refresh(orderId);
    return ok(null, next.status === before ? `No change — Whop still reports this order as ${ORDER_STATUS_LABEL[next.status as OrderStatus]?.toLowerCase() ?? next.status}` : `Order is now ${ORDER_STATUS_LABEL[next.status as OrderStatus]?.toLowerCase() ?? next.status}`);
  });
}

export async function retryFulfillmentAction(input: { orderId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const { orderId } = orderIdSchema.parse(input);
    const next = await retryOrderFulfillment(orderId, actor.id);
    await audit({ actor, action: "order.retry_fulfillment", entityType: "public_course_order", entityId: orderId, summary: `${next.order_number}: ${next.status} / ${next.fulfillment_status}` });
    refresh(orderId);
    return ok(null, next.fulfillment_status === "fulfilled" ? "Access is set up" : next.fulfillment_status === "awaiting_activation" ? "Activation invitation is in place" : next.whop_checkout_url ? "Payment link ready" : "Retried");
  });
}

export async function resendActivationAction(input: { orderId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const { orderId } = orderIdSchema.parse(input);
    await resendOrderActivation(orderId, actor.id);
    await audit({ actor, action: "order.resend_activation", entityType: "public_course_order", entityId: orderId, summary: "Resent the account activation email" });
    refresh(orderId);
    return ok(null, "Activation email sent — the previous link no longer works");
  });
}

export async function cancelOrderAction(orderId: string, input: { reason?: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const data = reasonSchema.parse({ orderId, reason: input.reason ?? "" });
    const order = await cancelOrder(data.orderId, actor.id, data.reason);
    await audit({ actor, action: "order.cancel", entityType: "public_course_order", entityId: data.orderId, summary: `${order.order_number} cancelled: ${data.reason}` });
    refresh(data.orderId);
    return ok(null, "Order cancelled and its payment link closed");
  });
}

export async function approveOrderAction(orderId: string, input: { reason?: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const data = reasonSchema.parse({ orderId, reason: input.reason ?? "" });
    const order = await approveOrderUnderReview(data.orderId, actor.id, data.reason);
    await audit({ actor, action: "order.approve_review", entityType: "public_course_order", entityId: data.orderId, summary: `${order.order_number} approved after review: ${data.reason}` });
    refresh(data.orderId);
    return ok(null, "Order approved and access set up");
  });
}
