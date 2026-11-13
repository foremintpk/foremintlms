import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/app-shell/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { LocalTime } from "@/components/common/local-time";
import { ActionButton } from "@/components/billing/action-button";
import { DocumentLinks } from "@/components/billing/document-links";
import { RefundDialog } from "@/components/billing/refund-dialog";
import { requireAdmin } from "@/lib/auth/guards";
import { getPaymentDetail } from "@/lib/services/billing/queries";
import { formatMoney } from "@/lib/format";
import { refundPaymentAction, resyncPaymentAction } from "../actions";

export const instant = false;

export const metadata: Metadata = { title: "Payment" };

const MATCH_LABEL: Record<string, string> = {
  metadata: "Foremint checkout (verified session)",
  checkout: "Foremint checkout link",
  existing: "Previously matched record",
  customer: "Known Whop customer",
  email: "Email address match",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export default async function PaymentDetailPage({ params }: PageProps<"/admin/payments/[id]">) {
  await requireAdmin("/admin/payments");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await getPaymentDetail(id);
  if (!detail) notFound();
  const { tx } = detail;
  const raw = tx.raw as { whop?: Record<string, unknown>; matched_by?: string | null };
  const refundable = tx.total_cents - tx.refunded_cents;
  const canRefund = (tx.status === "succeeded" || tx.status === "partially_refunded") && refundable > 0;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/payments", label: "Payments" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {formatMoney(tx.total_cents, tx.currency)}
            <StatusBadge status={tx.status} label={tx.status === "succeeded" ? "Paid" : undefined} />
          </span>
        }
        description={`${detail.productName}${detail.planName !== "—" ? ` — ${detail.planName}` : ""}`}
        actions={
          <>
            <ActionButton action={resyncPaymentAction} input={{ transactionId: tx.id }} size="default" pendingLabel="Refreshing…">
              <RefreshCw className="size-4" /> Refresh from Whop
            </ActionButton>
            {canRefund ? <RefundDialog refundableCents={refundable} currency={tx.currency} refund={refundPaymentAction.bind(null, tx.id)} /> : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <section className="rounded-2xl border bg-card p-5">
            <SectionHeader title="Summary" />
            <dl className="divide-y">
              <Row label="Customer">
                {tx.user_id && detail.customer ? (
                  <Link href={`/admin/students/${tx.user_id}`} className="font-medium text-primary hover:underline">
                    {detail.customer.name || detail.customer.email}
                  </Link>
                ) : (
                  <span className="text-warning">
                    Not matched to a learner. This usually means the purchase was made outside Foremint checkout with an email that has no account.
                  </span>
                )}
                {detail.customer?.email ? <span className="block text-xs text-muted-foreground">{detail.customer.email}</span> : null}
              </Row>
              <Row label="Matched by">{tx.user_id ? MATCH_LABEL[raw.matched_by ?? ""] ?? "—" : "—"}</Row>
              <Row label="Created">
                <LocalTime value={tx.created_at} />
              </Row>
              <Row label="Paid">
                <LocalTime value={tx.paid_at} />
              </Row>
              {tx.refunded_at ? (
                <Row label="Refunded">
                  <LocalTime value={tx.refunded_at} />
                </Row>
              ) : null}
              <Row label="Type">{tx.billing_reason === "renewal" ? "Subscription renewal" : tx.billing_reason === "initial" ? "First subscription payment" : tx.billing_reason === "one_time" ? "One-time payment" : "Other"}</Row>
              <Row label="Payment method">{tx.card_brand && tx.card_last4 ? `${tx.card_brand} •••• ${tx.card_last4}` : "—"}</Row>
              {tx.failure_reason ? <Row label="Failure reason">{tx.failure_reason}</Row> : null}
              <Row label="Whop payment">
                <span className="font-mono text-xs">{tx.whop_payment_id}</span>
              </Row>
              {tx.whop_membership_id ? (
                <Row label="Whop membership">
                  <span className="font-mono text-xs">{tx.whop_membership_id}</span>
                </Row>
              ) : null}
              {detail.session ? (
                <Row label="Checkout">
                  Started <LocalTime value={detail.session.created_at} /> — <StatusBadge status={detail.session.status === "created" ? "pending" : detail.session.status} />
                </Row>
              ) : null}
              <Row label="Last synced">
                <LocalTime value={tx.last_synced_at} format="relative" />
              </Row>
            </dl>
          </section>

          <section className="rounded-2xl border bg-card p-5">
            <SectionHeader title="Access granted" description="Entitlements created from this payment or its subscription." />
            {detail.entitlements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No access is linked to this payment.</p>
            ) : (
              <ul className="divide-y text-sm">
                {detail.entitlements.map((e) => (
                  <li key={e.id} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-medium">{e.courseTitle}</span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      {e.expires_at ? (
                        <>
                          until <LocalTime value={e.expires_at} format="date" />
                        </>
                      ) : (
                        "no end date"
                      )}
                      <StatusBadge status={e.status} />
                    </span>
                    {e.revoke_reason ? <span className="text-xs text-muted-foreground sm:basis-full">{e.revoke_reason}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border bg-card p-5">
            <SectionHeader title="Webhook events" description="Deliveries from Whop about this payment." />
            {detail.events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No webhook deliveries recorded for this payment.</p>
            ) : (
              <ul className="divide-y text-sm">
                {detail.events.map((ev) => (
                  <li key={ev.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="font-mono text-xs">{ev.event_type}</span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <LocalTime value={ev.received_at} format="datetime" />
                      <StatusBadge status={ev.status === "processed" ? "sent" : ev.status} label={ev.status === "processed" ? "Processed" : undefined} />
                    </span>
                    {ev.last_error ? <span className="basis-full text-xs text-destructive">{ev.last_error}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <details className="rounded-2xl border bg-card p-5">
            <summary className="cursor-pointer font-semibold">Raw Whop payment data</summary>
            <pre className="mt-4 max-h-[480px] overflow-auto rounded-xl bg-muted p-4 font-mono text-xs leading-relaxed">
              {JSON.stringify(raw.whop ?? {}, null, 2)}
            </pre>
          </details>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="mb-3 font-semibold">Amounts</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">{tx.subtotal_cents !== null ? formatMoney(tx.subtotal_cents, tx.currency) : "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Discount{tx.promo_code ? " (promo)" : ""}</dt>
                <dd className="tabular-nums">{tx.discount_cents ? `−${formatMoney(tx.discount_cents, tx.currency)}` : "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tax</dt>
                <dd className="tabular-nums">{tx.tax_cents !== null ? formatMoney(tx.tax_cents, tx.currency) : "None reported"}</dd>
              </div>
              <div className="flex justify-between border-t pt-2 font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatMoney(tx.total_cents, tx.currency)}</dd>
              </div>
              {tx.refunded_cents > 0 ? (
                <div className="flex justify-between text-muted-foreground">
                  <dt>Refunded</dt>
                  <dd className="tabular-nums">−{formatMoney(tx.refunded_cents, tx.currency)}</dd>
                </div>
              ) : null}
            </dl>
          </section>
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="mb-3 font-semibold">Documents</h2>
            <DocumentLinks documents={detail.documents} />
          </section>
          {detail.subscription ? (
            <section className="rounded-2xl border bg-card p-5 text-sm">
              <h2 className="mb-3 font-semibold">Subscription</h2>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs">{detail.subscription.whop_membership_id}</span>
                <StatusBadge status={detail.subscription.status} />
              </div>
              {detail.subscription.current_period_end ? (
                <p className="mt-2 text-muted-foreground">
                  {detail.subscription.cancel_at_period_end ? "Ends" : "Renews"} <LocalTime value={detail.subscription.current_period_end} format="date" />
                </p>
              ) : null}
              <Link href={`/admin/subscriptions?q=${detail.subscription.whop_membership_id}`} className="mt-3 inline-block font-medium text-primary hover:underline">
                View in subscriptions
              </Link>
            </section>
          ) : null}
        </aside>
      </div>
    </>
  );
}
