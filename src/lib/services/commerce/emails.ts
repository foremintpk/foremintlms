import "server-only";
import { enqueueEmail } from "@/lib/services/email/outbox";
import { appUrl } from "@/lib/env";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatMinor } from "@/lib/domain/invoicing";
import { courseTitlesText, durationKeyFromDays, durationLabel, orderAccessSummary } from "@/lib/domain/commerce";
import type { OrderItemRow, OrderRow } from "./store";
import { orderInvoiceUrl } from "./invoice";
import { orderStatusPath } from "./tokens";

/**
 * Course-package emails (templates `order.*`, editable in Admin → Email
 * templates). Each has an idempotency key, so webhook retries, reconciliation
 * and double clicks never send the same message twice. The emailed payment
 * link is the official Whop purchase URL; passwords are never emailed.
 */

function basePayload(order: OrderRow, items: OrderItemRow[]) {
  const titles = items.map((i) => i.course_title_snapshot);
  return {
    order_number: order.order_number,
    course_list: courseTitlesText(titles, 12),
    course_count: String(items.length),
    access_period: durationLabel(durationKeyFromDays(order.duration_days)),
    amount: formatMinor(order.total_minor, order.currency),
    learner_email: order.learner_email,
    line_items: [
      ...items.map((i) => ({ description: i.course_title_snapshot, amount: formatMinor(i.course_price_minor, i.currency) })),
      ...(order.discount_minor > 0
        ? [{ description: `Discount${order.coupon_code_snapshot ? ` (${order.coupon_code_snapshot})` : ""}`, amount: `−${formatMinor(order.discount_minor, order.currency)}` }]
        : []),
    ],
    total: formatMinor(order.total_minor, order.currency),
  };
}

export async function sendPaymentLinkEmail(order: OrderRow, items: OrderItemRow[]) {
  if (!order.whop_checkout_url) return;
  await enqueueEmail({
    templateKey: "order.payment_link",
    to: order.learner_email,
    userId: order.learner_user_id,
    idempotencyKey: `order-payment-link:${order.id}`,
    payload: {
      ...basePayload(order, items),
      link_expires_at: `${formatDateTime(order.expires_at)} UTC`,
      cta_url: order.whop_checkout_url,
      details: [
        { label: "Invoice", value: order.order_number },
        { label: "Status", value: "Unpaid" },
        { label: "Invoice date", value: formatDate(order.created_at) },
        { label: "Student email", value: order.learner_email },
        { label: "Pay by", value: `${formatDateTime(order.expires_at)} UTC` },
      ],
      secondary_label: "Download invoice (PDF)",
      secondary_url: orderInvoiceUrl(order.id),
    },
  });
}

export async function sendPaymentConfirmedEmail(order: OrderRow, items: OrderItemRow[], opts: { hasAccount: boolean }) {
  const paidAt = order.paid_at ? new Date(order.paid_at) : null;
  await enqueueEmail({
    templateKey: "order.payment_confirmed",
    to: order.learner_email,
    userId: order.learner_user_id,
    idempotencyKey: `order-payment-confirmed:${order.id}`,
    payload: {
      ...basePayload(order, items),
      first_name: "there",
      access_summary: orderAccessSummary(order.duration_days, paidAt),
      next_steps: opts.hasAccount
        ? "The courses are already in your account — sign in and open My courses."
        : "We've sent a separate email with a secure link to activate your account and create your password.",
      cta_url: appUrl(opts.hasAccount ? "/learn/courses" : orderStatusPath(order.id)),
      details: [
        { label: "Invoice", value: order.order_number },
        { label: "Status", value: "Paid" },
        ...(order.paid_at ? [{ label: "Paid", value: `${formatDateTime(order.paid_at)} UTC` }] : []),
        ...(order.whop_payment_id ? [{ label: "Payment reference", value: order.whop_payment_id }] : []),
      ],
      secondary_label: "Download paid invoice (PDF)",
      secondary_url: orderInvoiceUrl(order.id),
    },
  });
}

export async function sendCoursesAddedEmail(order: OrderRow, items: OrderItemRow[], opts: { firstName: string; userId: string }) {
  const paidAt = order.paid_at ? new Date(order.paid_at) : null;
  await enqueueEmail({
    templateKey: "order.courses_added",
    to: order.learner_email,
    userId: opts.userId,
    idempotencyKey: `order-courses-added:${order.id}`,
    payload: {
      ...basePayload(order, items),
      first_name: opts.firstName,
      access_summary: orderAccessSummary(order.duration_days, paidAt),
      cta_url: appUrl("/learn/courses"),
    },
  });
}
