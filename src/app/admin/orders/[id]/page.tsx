import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ExternalLink, RefreshCw, RotateCcw, Send, ShieldCheck, XCircle } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/app-shell/page-header";
import { LocalTime } from "@/components/common/local-time";
import { StatusBadge } from "@/components/common/status-badge";
import { ConfirmAction } from "@/components/common/confirm-action";
import { ActionButton } from "@/components/billing/action-button";
import { CopyField } from "@/components/admin/copy-button";
import { CopyButton } from "@/components/invoicing/copy-button";
import { FulfillmentStatusBadge, OrderStatusBadge, PaymentStatusBadge, SourceBadge } from "@/components/admin/commerce/order-badges";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/guards";
import { appUrl } from "@/lib/env";
import { formatMinor } from "@/lib/domain/invoicing";
import { durationAccessLabel, durationKeyFromDays, isOrderPayable, orderAccessSummary } from "@/lib/domain/commerce";
import { getOrderDetail } from "@/lib/services/commerce/admin";
import { orderStatusPath } from "@/lib/services/commerce/tokens";
import { approveOrderAction, cancelOrderAction, refreshOrderStatusAction, resendActivationAction, retryFulfillmentAction } from "../actions";

export const instant = false;

export const metadata: Metadata = { title: "Course order" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium break-words">{children}</dd>
    </div>
  );
}

function humanEvent(type: string): string {
  const s = type.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default async function CourseOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;
  await requireAdmin(`/admin/orders/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await getOrderDetail(id);
  if (!detail) notFound();
  const { order, items, events, transaction, entitlements, invitations, learner } = detail;

  const payable = isOrderPayable(order);
  const unpaid = ["draft", "pending_payment", "payment_processing", "failed"].includes(order.status);
  const canRetry = ["paid", "fulfillment_pending"].includes(order.status) || order.status === "draft";
  const paidAt = order.paid_at ? new Date(order.paid_at) : null;
  const statusUrl = appUrl(orderStatusPath(order.id));
  const coupon = (order.coupon_snapshot ?? null) as { code?: string; discount_type?: string; amount?: number; currency?: string | null } | null;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/orders", label: "Course orders" }}
        title={<span className="font-mono">{order.order_number}</span>}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.payment_status} />
            <FulfillmentStatusBadge status={order.fulfillment_status} />
            <SourceBadge source={order.source} />
            {order.environment ? <StatusBadge status={order.environment} label={order.environment === "sandbox" ? "Whop sandbox" : "Whop live"} tone={order.environment === "sandbox" ? "warning" : "neutral"} /> : null}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2" data-testid="order-actions">
            {payable && order.whop_checkout_url ? (
              <>
                <CopyButton value={order.whop_checkout_url} label="Copy payment link" />
                <Button asChild size="sm" variant="outline">
                  <a href={order.whop_checkout_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink aria-hidden /> Open checkout
                  </a>
                </Button>
              </>
            ) : null}
            {order.whop_plan_id ? (
              <ActionButton action={refreshOrderStatusAction} input={{ orderId: order.id }} pendingLabel="Checking Whop…">
                <RefreshCw className="size-3.5" aria-hidden /> Refresh payment status
              </ActionButton>
            ) : null}
            {canRetry ? (
              <ActionButton action={retryFulfillmentAction} input={{ orderId: order.id }} pendingLabel="Retrying…">
                <RotateCcw className="size-3.5" aria-hidden /> {order.status === "draft" ? "Retry payment link" : "Retry fulfilment"}
              </ActionButton>
            ) : null}
            {order.fulfillment_status === "awaiting_activation" ? (
              <ActionButton action={resendActivationAction} input={{ orderId: order.id }} pendingLabel="Sending…">
                <Send className="size-3.5" aria-hidden /> Resend activation email
              </ActionButton>
            ) : null}
            {order.status === "under_review" ? (
              <ConfirmAction
                title={`Approve ${order.order_number}?`}
                description="Whop must still report the payment as paid. Access is set up for the student email exactly as if the payment had matched, and your reason is audit-logged."
                confirmLabel="Approve and set up access"
                requireReason
                reasonLabel="Why is this payment acceptable?"
                action={approveOrderAction.bind(null, order.id)}
                trigger={
                  <Button size="sm">
                    <ShieldCheck aria-hidden /> Approve after review
                  </Button>
                }
              />
            ) : null}
            {unpaid ? (
              <ConfirmAction
                title={`Cancel ${order.order_number}?`}
                description="The Whop payment link stops working immediately. Nothing has been charged. The student can start a new checkout later."
                confirmLabel="Cancel order"
                destructive
                requireReason
                action={cancelOrderAction.bind(null, order.id)}
                trigger={
                  <Button size="sm" variant="outline">
                    <XCircle aria-hidden /> Cancel order
                  </Button>
                }
              />
            ) : null}
          </div>
        }
      />

      {order.status_reason ? (
        <p className="mb-6 rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm" role="status">
          {order.status_reason}
        </p>
      ) : null}
      {order.link_generation_error && order.status === "draft" ? (
        <p className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm" role="alert">
          Whop link error: {order.link_generation_error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid min-w-0 gap-6">
          <section className="rounded-2xl border bg-card p-5">
            <SectionHeader title="Summary" />
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Row label="Student email">{order.learner_email}</Row>
              <Row label="Student account">
                {learner ? (
                  <Link href={`/admin/students/${learner.id}`} className="text-primary hover:underline">
                    {learner.full_name || learner.email || "View student"}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">Not activated yet</span>
                )}
              </Row>
              <Row label="Paid by">{order.payer_email ? `${order.payer_name ? `${order.payer_name} · ` : ""}${order.payer_email}` : <span className="text-muted-foreground">—</span>}</Row>
              <Row label="Access period">{durationAccessLabel(durationKeyFromDays(order.duration_days))}</Row>
              <Row label="Access">{paidAt ? orderAccessSummary(order.duration_days, paidAt) : "Starts when the payment is confirmed"}</Row>
              <Row label="Coupon">
                {order.coupon_code_snapshot ? (
                  <span>
                    <span className="font-mono">{order.coupon_code_snapshot}</span>
                    {coupon?.discount_type ? <span className="text-muted-foreground"> · {coupon.discount_type === "percent" ? `${coupon.amount}%` : `${coupon.amount} ${(coupon.currency ?? order.currency).toUpperCase()}`} off</span> : null}
                  </span>
                ) : (
                  <span className="text-muted-foreground">None</span>
                )}
              </Row>
              <Row label="Created">
                <LocalTime value={order.created_at} />
              </Row>
              <Row label="Link valid until">
                <LocalTime value={order.expires_at} />
              </Row>
              <Row label="Paid">{order.paid_at ? <LocalTime value={order.paid_at} /> : <span className="text-muted-foreground">—</span>}</Row>
              <Row label="Fulfilled">{order.fulfilled_at ? <LocalTime value={order.fulfilled_at} /> : <span className="text-muted-foreground">—</span>}</Row>
              <Row label="Activation emails sent">{order.activation_sent_count}</Row>
              <Row label="Last checked with Whop">{order.last_synced_at ? <LocalTime value={order.last_synced_at} format="relative" /> : <span className="text-muted-foreground">Never</span>}</Row>
            </dl>
          </section>

          <section className="rounded-2xl border bg-card">
            <div className="p-5 pb-0">
              <SectionHeader title={`Courses (${items.length})`} description="Prices are the snapshot taken when the order was created." />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">Course</th>
                    <th className="px-5 py-2.5 text-right font-medium">Price</th>
                    <th className="px-5 py-2.5 text-right font-medium">Discount share</th>
                    <th className="px-5 py-2.5 text-right font-medium">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((i) => (
                    <tr key={i.id}>
                      <td className="px-5 py-3">
                        <p className="font-medium">{i.course_title_snapshot}</p>
                        <p className="text-xs text-muted-foreground">{[i.category_snapshot, i.course_slug_snapshot].filter(Boolean).join(" · ")}</p>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">{formatMinor(i.course_price_minor, i.currency)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{i.discount_minor ? `−${formatMinor(i.discount_minor, i.currency)}` : "—"}</td>
                      <td className="px-5 py-3 text-right font-medium tabular-nums">{formatMinor(i.course_price_minor - i.discount_minor, i.currency)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t text-sm">
                  <tr>
                    <td className="px-5 py-2 text-muted-foreground">Subtotal</td>
                    <td colSpan={3} className="px-5 py-2 text-right tabular-nums">{formatMinor(order.subtotal_minor, order.currency)}</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-2 text-muted-foreground">Discount</td>
                    <td colSpan={3} className="px-5 py-2 text-right tabular-nums">{order.discount_minor ? `−${formatMinor(order.discount_minor, order.currency)}` : "—"}</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-2 font-semibold">Total charged on Whop</td>
                    <td colSpan={3} className="px-5 py-2 text-right font-semibold tabular-nums" data-testid="order-total">
                      {formatMinor(order.total_minor, order.currency)}
                    </td>
                  </tr>
                  {order.paid_amount_minor !== null && order.paid_amount_minor !== order.total_minor ? (
                    <tr>
                      <td className="px-5 py-2 text-muted-foreground">Paid incl. tax</td>
                      <td colSpan={3} className="px-5 py-2 text-right tabular-nums">{formatMinor(order.paid_amount_minor, order.currency)}</td>
                    </tr>
                  ) : null}
                </tfoot>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-5">
            <SectionHeader title="Access" description="One entitlement per course, created only after a verified payment." />
            {entitlements.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {order.fulfillment_status === "awaiting_activation"
                  ? "Access is created as soon as the student activates their account."
                  : order.paid_at
                    ? "No access rows yet."
                    : "No access until the payment is confirmed."}
              </p>
            ) : (
              <ul className="divide-y rounded-xl border">
                {entitlements.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <span className="font-medium">{e.course_title ?? "Deleted course"}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {e.expires_at ? (
                        <>
                          until <LocalTime value={e.expires_at} format="date" />
                        </>
                      ) : (
                        "Lifetime"
                      )}
                      <StatusBadge status={e.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {invitations.length ? (
              <div className="mt-4">
                <p className="text-xs font-medium text-muted-foreground">Activation invitations</p>
                <ul className="mt-2 divide-y rounded-xl border">
                  {invitations.map((inv) => (
                    <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                      <span>
                        {inv.email} <span className="text-xs text-muted-foreground">· sent {inv.send_count}×, last <LocalTime value={inv.last_sent_at} format="relative" /></span>
                      </span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        {inv.accepted_at ? (
                          <>
                            accepted <LocalTime value={inv.accepted_at} format="date" />
                          </>
                        ) : (
                          <>
                            expires <LocalTime value={inv.expires_at} format="date" />
                          </>
                        )}
                        <StatusBadge status={inv.status} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border bg-card p-5">
            <SectionHeader title="Timeline" />
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events yet.</p>
            ) : (
              <ol className="grid gap-3">
                {events.map((ev) => (
                  <li key={ev.id} className="flex gap-3 text-sm">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0">
                      <p className="font-medium">
                        {humanEvent(ev.event_type)}
                        {ev.new_status ? <span className="text-muted-foreground"> → {ev.new_status.replace(/_/g, " ")}</span> : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <LocalTime value={ev.created_at} />
                        {ev.actor_id ? " · by an administrator" : ""}
                        {(ev.event_data as { reason?: string } | null)?.reason ? ` · ${(ev.event_data as { reason: string }).reason}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="grid content-start gap-6">
          <section className="rounded-2xl border bg-card p-5">
            <SectionHeader title="Payment" />
            {transaction ? (
              <dl className="mb-4 grid gap-3">
                <Row label="Whop payment status">
                  <StatusBadge status={transaction.status} />
                </Row>
                <Row label="Charged">
                  {formatMinor(transaction.total_cents, transaction.currency)}
                  {transaction.tax_cents ? <span className="text-muted-foreground"> incl. {formatMinor(transaction.tax_cents, transaction.currency)} tax</span> : null}
                </Row>
                {transaction.refunded_cents ? <Row label="Refunded">{formatMinor(transaction.refunded_cents, transaction.currency)}</Row> : null}
                {transaction.card_brand ? (
                  <Row label="Method">
                    {transaction.card_brand} •••• {transaction.card_last4}
                  </Row>
                ) : null}
                {transaction.promo_code ? <Row label="Whop promo code">{transaction.promo_code}</Row> : null}
                <Row label="Payment record">
                  <Link href={`/admin/payments/${transaction.id}`} className="text-primary hover:underline">
                    View in Payment history
                  </Link>
                </Row>
              </dl>
            ) : (
              <p className="mb-4 text-sm text-muted-foreground">{order.checkout_provider === "none" ? "Free order (100% discount) — nothing to charge." : "No payment recorded yet."}</p>
            )}
            <div className="grid gap-3">
              {order.whop_payment_id ? <CopyField label="Whop payment" value={order.whop_payment_id} /> : null}
              {order.whop_checkout_configuration_id ? <CopyField label="Whop checkout configuration" value={order.whop_checkout_configuration_id} /> : null}
              {order.whop_plan_id ? <CopyField label="Whop variant (plan)" value={order.whop_plan_id} /> : null}
              {order.whop_product_id ? <CopyField label="Whop product (shared course package)" value={order.whop_product_id} /> : null}
              {order.whop_checkout_url ? <CopyField label={payable ? "Payment link" : "Payment link (no longer payable)"} value={order.whop_checkout_url} /> : null}
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-5">
            <SectionHeader title="Student's order page" description="Shows the order's status without signing in. Share it only with the student or payer." />
            <CopyField label="Order status link" value={statusUrl} />
          </section>
        </aside>
      </div>
    </>
  );
}
