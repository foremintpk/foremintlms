import "server-only";
import { appUrl } from "@/lib/env";
import { getPublicSettings } from "@/lib/settings";
import { durationAccessLabel, durationKeyFromDays, isOrderPayable } from "@/lib/domain/commerce";
import type { OrderInvoiceModel, OrderInvoiceStatus } from "@/lib/pdf/order-invoice";
import type { OrderItemRow, OrderRow } from "./store";
import { orderAccessToken } from "./tokens";

/** Paid / Unpaid / … as shown on the order's invoice. */
export function invoiceStatusOf(order: Pick<OrderRow, "status" | "expires_at" | "whop_checkout_url">, now = new Date()): OrderInvoiceStatus {
  switch (order.status) {
    case "paid":
    case "fulfillment_pending":
    case "fulfilled":
      return "paid";
    case "refunded":
      return "refunded";
    case "partially_refunded":
      return "partially_refunded";
    case "cancelled":
      return "cancelled";
    case "expired":
      return "expired";
    case "under_review":
      return "under_review";
    default:
      return isOrderPayable(order, now) || order.status === "draft" ? "unpaid" : "expired";
  }
}

/** Public, token-authorised URL of the order's invoice PDF (same secret as the order page). */
export function orderInvoiceUrl(orderId: string, opts: { download?: boolean } = {}): string {
  return appUrl(`/api/commerce/orders/${orderAccessToken(orderId)}/invoice${opts.download ? "?download=1" : ""}`);
}

export async function buildOrderInvoiceModel(order: OrderRow, items: OrderItemRow[]): Promise<OrderInvoiceModel> {
  const settings = await getPublicSettings();
  const status = invoiceStatusOf(order);
  return {
    number: order.order_number,
    status,
    issuedAt: order.created_at,
    dueAt: order.expires_at,
    paidAt: order.paid_at,
    paymentReference: order.whop_payment_id,
    currency: order.currency,
    learnerEmail: order.learner_email,
    payerEmail: order.payer_email,
    accessLabel: durationAccessLabel(durationKeyFromDays(order.duration_days)),
    items: items.map((i) => ({ title: i.course_title_snapshot, category: i.category_snapshot, amountMinor: Number(i.course_price_minor) })),
    subtotalMinor: Number(order.subtotal_minor),
    discountMinor: Number(order.discount_minor),
    couponCode: order.coupon_code_snapshot,
    taxMinor: order.paid_tax_minor !== null ? Number(order.paid_tax_minor) : null,
    totalMinor: Number(order.total_minor),
    payUrl: status === "unpaid" ? order.whop_checkout_url : null,
    seller: {
      brandName: settings.brandName,
      legalEntityName: settings.legalEntityName,
      addressLines: settings.businessAddress ? settings.businessAddress.split(/\n|,\s*/).map((l) => l.trim()).filter(Boolean) : [],
      registrationNumber: settings.registrationNumber,
      supportEmail: settings.supportEmail,
    },
  };
}
