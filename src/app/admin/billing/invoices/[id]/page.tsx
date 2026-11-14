import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AlertTriangle, Building2, CircleUserRound, Clock, Hourglass, ShieldAlert } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/app-shell/page-header";
import { LocalTime } from "@/components/common/local-time";
import { StatusBadge } from "@/components/common/status-badge";
import { InvoiceStatusBadge, PackageStatusBadge } from "@/components/invoicing/invoice-status-badge";
import { ApproveReviewButton, GenerateButton, InvoiceActionsMenu, PaymentLinkCard, ResendInvitationButton } from "@/components/invoicing/invoice-actions";
import { ExtendAccessDialog, PackageStatusControls } from "@/components/invoicing/package-controls";
import { requireAdmin } from "@/lib/auth/guards";
import { getInvoiceDetail } from "@/lib/services/invoicing/queries";
import { getInvoicingSettings } from "@/lib/services/invoicing/settings";
import { accessTermsLabel, billingIntervalLabel, canVoid, formatMinor, expectedFirstPaymentMinor, isPayable, type InvoiceStatus } from "@/lib/domain/invoicing";
import { formatMoney } from "@/lib/format";

export const instant = false;

export const metadata: Metadata = { title: "Invoice" };

const EVENT_LABEL: Record<string, string> = {
  created: "Invoice created",
  edited: "Draft edited",
  issued: "Whop invoice issued",
  link_created: "Payment link created",
  generation_failed: "Whop generation failed",
  email_link: "Invoice email sent",
  email_reminder: "Payment reminder sent",
  email_past_due: "Past-due email sent",
  paid: "Payment verified",
  renewed: "Subscription renewed",
  renewal_failed: "Renewal payment failed",
  voided: "Invoice voided",
  refreshed: "Status refreshed from Whop",
  summary_generated: "Service summary generated",
  access_extended: "Access extended",
  activation_invited: "Account activation emailed",
  contact_invited: "Company contact invited",
  account_activated: "Customer activated their account",
  payment_pending: "Payment in progress",
  review_approved: "Approved after review",
  subscription_cancelled: "Subscription cancelling",
  subscription_cancel_requested: "Cancellation requested",
  subscription_past_due: "Subscription past due",
  package_ended: "Package ended",
  package_expired: "Package expired",
  disputed: "Payment disputed",
  dispute_lost: "Chargeback lost",
  membership_seen: "Whop membership update",
};

function eventLabel(type: string) {
  if (EVENT_LABEL[type]) return EVENT_LABEL[type];
  if (type.startsWith("status_")) return `Status: ${type.slice(7).replace(/_/g, " ")}`;
  return type.replace(/_/g, " ");
}

export default async function InvoiceDetailPage({ params }: PageProps<"/admin/billing/invoices/[id]">) {
  const { id } = await params;
  await requireAdmin(`/admin/billing/invoices/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();
  const [d, settings] = await Promise.all([getInvoiceDetail(id), getInvoicingSettings()]);
  if (!d) notFound();
  const { invoice: inv, mapping, entitlement: ent } = d;
  const status = inv.status as InvoiceStatus;
  const payable = isPayable(status);
  const recurring = inv.billing_type === "recurring";
  const firstPayment = expectedFirstPaymentMinor(inv as never);
  const nowMs = new Date().getTime();

  return (
    <>
      <PageHeader
        back={{ href: "/admin/billing/invoices", label: "Custom invoices" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{inv.invoice_number}</span>
            <InvoiceStatusBadge status={inv.status} />
          </span>
        }
        description={inv.invoice_description}
        actions={
          <InvoiceActionsMenu
            invoiceId={inv.id}
            canVoid={canVoid(status)}
            isDraft={status === "draft" && !mapping}
            canRefresh={Boolean(mapping?.whop_invoice_id || mapping?.whop_variant_id)}
            whopPdfLabel={mapping?.whop_invoice_id ? "View Whop invoice (PDF)" : mapping?.whop_payment_id ? "View Whop receipt (PDF)" : null}
            canCancelSubscription={recurring && Boolean(mapping?.whop_membership_id) && status === "paid" && ent?.status === "active" && ent?.subscription_status !== "canceling" && ent?.subscription_status !== "canceled"}
          />
        }
      />

      <div className="space-y-6">
        {payable && mapping?.payment_url ? <PaymentLinkCard invoiceId={inv.id} url={mapping.payment_url} deliveryChannel={settings.delivery} method={inv.collection_method === "whop_invoice" ? "whop_invoice" : "payment_link"} /> : null}

        {status === "pending_generation" || status === "draft" ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-4 text-sm text-warning sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2">
              {inv.generation_error ? <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> : <Hourglass className="mt-0.5 size-4 shrink-0" aria-hidden />}
              <span>
                {inv.generation_error ?? (status === "draft" ? (inv.collection_method === "whop_invoice" ? "This invoice is a draft. Generate it to create the Whop invoice and its payment link." : "This invoice is a draft. Create its Whop payment link to send to your client.") : "Waiting for Whop.")}
                {mapping?.whop_invoice_id ? <span className="block text-xs opacity-80">Whop draft {mapping.whop_invoice_id} is saved and will be reused.</span> : null}
              </span>
            </p>
            <GenerateButton invoiceId={inv.id} label={status === "draft" ? (inv.collection_method === "whop_invoice" ? "Generate Whop invoice" : "Create payment link") : "Retry"} />
          </div>
        ) : null}

        {status === "under_review" ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-destructive">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <span className="font-medium">No access was granted.</span> {inv.status_reason ?? "This payment needs a manual check."}
              </span>
            </p>
            {inv.status_reason !== "Payment disputed" && inv.status_reason !== "Chargeback lost" ? <ApproveReviewButton invoiceId={inv.id} /> : null}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-6">
            <section className="rounded-2xl border bg-card p-5 shadow-card">
              <SectionHeader title="Commercial terms" />
              <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">{inv.invoice_type === "company" ? "Company" : "Customer"}</dt>
                  <dd className="mt-0.5 flex items-center gap-2 font-medium">
                    {inv.invoice_type === "company" ? <Building2 className="size-4 text-muted-foreground" aria-hidden /> : <CircleUserRound className="size-4 text-muted-foreground" aria-hidden />}
                    {d.company ? (
                      <Link href={`/admin/billing/companies/${d.company.id}`} className="text-primary hover:underline">
                        {d.company.name}
                      </Link>
                    ) : (
                      (inv.company_name ?? inv.customer_name)
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{inv.invoice_type === "company" ? "Primary contact" : "Email"}</dt>
                  <dd className="mt-0.5 font-medium break-all">
                    {inv.invoice_type === "company" ? `${inv.customer_name} · ` : ""}
                    {inv.customer_email}
                  </dd>
                  {d.customerAccount ? <dd className="text-xs text-muted-foreground">Linked to account {d.customerAccount.email}</dd> : null}
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{recurring ? "Recurring price" : "Amount"}</dt>
                  <dd className="mt-0.5 text-lg font-semibold tabular-nums">
                    {formatMinor(inv.amount_minor, inv.currency)} <span className="text-xs font-normal text-muted-foreground">{inv.currency.toUpperCase()}</span>
                  </dd>
                  {recurring ? (
                    <dd className="text-xs text-muted-foreground">
                      {billingIntervalLabel(inv.billing_interval_days)} · first payment {formatMinor(firstPayment, inv.currency)}
                      {inv.upfront_fee_minor ? ` (incl. ${formatMinor(inv.upfront_fee_minor, inv.currency)} upfront fee)` : ""}
                    </dd>
                  ) : null}
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Access</dt>
                  <dd className="mt-0.5 font-medium">{accessTermsLabel(inv as never)}</dd>
                  {recurring ? <dd className="text-xs text-muted-foreground">{inv.grace_period_days}-day grace period after a failed renewal</dd> : null}
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Due</dt>
                  <dd className="mt-0.5 font-medium">{inv.due_at ? <LocalTime value={inv.due_at} format="date" /> : "On receipt"}</dd>
                  {inv.link_expires_at ? (
                    <dd className="text-xs text-muted-foreground">
                      Link expires <LocalTime value={inv.link_expires_at} format="date" />
                    </dd>
                  ) : null}
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Created</dt>
                  <dd className="mt-0.5 font-medium">
                    <LocalTime value={inv.created_at} format="datetime" />
                  </dd>
                  <dd className="text-xs text-muted-foreground">by {d.creator?.name || d.creator?.email || "an administrator"}</dd>
                </div>
                {inv.customer_reference || inv.internal_reference ? (
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-muted-foreground">References</dt>
                    <dd className="mt-0.5">{[inv.customer_reference && `Customer: ${inv.customer_reference}`, inv.internal_reference && `Internal: ${inv.internal_reference}`].filter(Boolean).join(" · ")}</dd>
                  </div>
                ) : null}
                {inv.invoice_type === "company" ? (
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-muted-foreground">Team</dt>
                    <dd className="mt-0.5">
                      {inv.seat_limit ? `Up to ${inv.seat_limit} people` : "Unlimited seats"} · {inv.allow_contact_invites ? "Company contact can invite employees" : "Only Foremint admins invite employees"}
                    </dd>
                  </div>
                ) : null}
              </dl>
              {inv.internal_notes ? (
                <div className="mt-5 rounded-xl border border-dashed bg-muted/30 p-3 text-sm">
                  <p className="text-xs font-medium text-muted-foreground">Internal notes · never shown to the customer</p>
                  <p className="mt-1 whitespace-pre-wrap">{inv.internal_notes}</p>
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border bg-card p-5 shadow-card">
              <SectionHeader
                title="Courses"
                description={
                  inv.course_selection_mode === "all_including_future"
                    ? "All published courses, plus courses published while access lasts."
                    : inv.course_selection_mode === "all_published"
                      ? "Snapshot of every course published when the invoice was created."
                      : "Selected courses (snapshot)."
                }
              />
              <ul className="grid gap-2 sm:grid-cols-2">
                {d.courses.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{c.title}</span>
                      <span className="block text-xs text-muted-foreground">{c.category ?? "Uncategorised"}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl border bg-card p-5 shadow-card">
              <SectionHeader title="Payments" description="Verified from Whop. The invoice's first payment shares its pay_ id; renewals have their own." />
              {d.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="py-2 font-medium">Whop payment</th>
                        <th className="py-2 font-medium">Type</th>
                        <th className="py-2 text-right font-medium">Total</th>
                        <th className="py-2 font-medium">Status</th>
                        <th className="py-2 font-medium">Paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {d.payments.map((p) => (
                        <tr key={p.id}>
                          <td className="py-2">
                            <Link href={`/admin/payments/${p.id}`} className="font-mono text-xs text-primary hover:underline">
                              {p.whop_payment_id}
                            </Link>
                          </td>
                          <td className="py-2 text-xs">{p.billing_reason === "renewal" ? "Renewal" : "Invoice payment"}</td>
                          <td className="py-2 text-right tabular-nums">
                            {formatMoney(p.total_cents, p.currency)}
                            {p.tax_cents ? <span className="block text-xs text-muted-foreground">incl. tax {formatMoney(p.tax_cents, p.currency)}</span> : null}
                            {p.refunded_cents ? <span className="block text-xs text-warning">refunded {formatMoney(p.refunded_cents, p.currency)}</span> : null}
                          </td>
                          <td className="py-2">
                            <StatusBadge status={p.status} />
                          </td>
                          <td className="py-2 text-xs">{p.paid_at ? <LocalTime value={p.paid_at} format="datetime" /> : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-2xl border bg-card p-5 shadow-card">
              <SectionHeader title="Activity" />
              <ol className="relative space-y-4 border-l pl-5">
                {d.events.map((e) => (
                  <li key={e.id} className="relative text-sm">
                    <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-card bg-primary" aria-hidden />
                    <p className="font-medium">{eventLabel(e.event_type)}</p>
                    <p className="text-xs text-muted-foreground">
                      <LocalTime value={e.created_at} format="datetime" /> · {e.actorName}
                      {(e.event_data as { reason?: string; error?: string }).reason ? ` · ${(e.event_data as { reason: string }).reason}` : ""}
                      {(e.event_data as { error?: string }).error ? ` · ${(e.event_data as { error: string }).error}` : ""}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-2xl border bg-card p-5 shadow-card">
              <SectionHeader title="Whop" description="The financial record and payment state." />
              {mapping ? (
                <dl className="grid gap-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Environment</dt>
                    <dd>
                      <StatusBadge status={mapping.environment} label={mapping.environment === "sandbox" ? "Sandbox (test)" : "Production"} tone={mapping.environment === "sandbox" ? "info" : "success"} />
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Method</dt>
                    <dd className="text-right text-xs">{inv.collection_method === "whop_invoice" ? "Whop invoice" : "Direct payment link"}</dd>
                  </div>
                  {mapping.whop_invoice_id ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Whop invoice</dt>
                      <dd className="text-right font-mono text-xs">
                        {mapping.whop_invoice_number ?? "—"}
                        <span className="block text-muted-foreground">{mapping.whop_invoice_id}</span>
                      </dd>
                    </div>
                  ) : (
                    <>
                      {mapping.whop_checkout_configuration_id ? (
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">Checkout</dt>
                          <dd className="font-mono text-xs">{mapping.whop_checkout_configuration_id}</dd>
                        </div>
                      ) : null}
                      {mapping.whop_payment_id ? (
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">Payment</dt>
                          <dd className="font-mono text-xs">{mapping.whop_payment_id}</dd>
                        </div>
                      ) : null}
                    </>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Provider status</dt>
                    <dd>{mapping.provider_status ? <StatusBadge status={mapping.provider_status} /> : "—"}</dd>
                  </div>
                  {mapping.provider_total_minor !== null ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Whop total</dt>
                      <dd className="text-right tabular-nums">
                        {formatMinor(mapping.provider_total_minor, mapping.provider_currency ?? inv.currency)}
                        <span className="block text-xs text-muted-foreground">
                          {mapping.totals_status === "final" ? "Final" : "Estimated"}
                          {mapping.provider_tax_minor ? ` · tax ${formatMinor(mapping.provider_tax_minor, mapping.provider_currency ?? inv.currency)}` : ""}
                        </span>
                      </dd>
                    </div>
                  ) : null}
                  {mapping.whop_membership_id ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Subscription</dt>
                      <dd className="font-mono text-xs">{mapping.whop_membership_id}</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Last checked</dt>
                    <dd className="text-xs">{mapping.last_synced_at ? <LocalTime value={mapping.last_synced_at} format="relative" /> : "—"}</dd>
                  </div>
                  {mapping.cleanup_status !== "retained" ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Whop product</dt>
                      <dd className="text-xs">{mapping.cleanup_status === "archived" ? "Archived" : "Archive failed"}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">No Whop invoice yet.</p>
              )}
            </section>

            <section className="rounded-2xl border bg-card p-5 shadow-card">
              <SectionHeader title="Access package" description="Learner access granted by this invoice." />
              {ent ? (
                <div className="space-y-4 text-sm">
                  <PackageStatusBadge status={ent.status} expiresAt={ent.expires_at} />
                  <dl className="grid gap-2">
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Started</dt>
                      <dd>
                        <LocalTime value={ent.starts_at} format="date" />
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Ends</dt>
                      <dd>{ent.expires_at ? <LocalTime value={ent.expires_at} format="date" /> : recurring ? "While subscribed" : "Never"}</dd>
                    </div>
                    {ent.contract_ends_at ? (
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Contract ends</dt>
                        <dd>
                          <LocalTime value={ent.contract_ends_at} format="date" />
                        </dd>
                      </div>
                    ) : null}
                    {ent.subscription_status ? (
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Subscription</dt>
                        <dd>
                          <StatusBadge status={ent.subscription_status} />
                        </dd>
                      </div>
                    ) : null}
                    {ent.status_reason ? <p className="text-xs text-muted-foreground">{ent.status_reason}</p> : null}
                  </dl>
                  <div className="flex flex-wrap gap-2">
                    <ExtendAccessDialog entitlementId={ent.id} currentExpiry={ent.expires_at} />
                    <PackageStatusControls entitlementId={ent.id} status={ent.status} />
                  </div>
                  {ent.company_id ? (
                    <Link href={`/admin/billing/companies/${ent.company_id}`} className="inline-flex text-sm font-medium text-primary hover:underline">
                      Manage company members →
                    </Link>
                  ) : null}
                </div>
              ) : (
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
                  Access is created when Whop confirms the payment.
                </p>
              )}
            </section>

            {d.invitations.length ? (
              <section className="rounded-2xl border bg-card p-5 shadow-card">
                <SectionHeader title="Account set-up" />
                <ul className="space-y-3 text-sm">
                  {d.invitations.map((i) => {
                    const expired = i.status === "pending" && new Date(i.expires_at).getTime() <= nowMs;
                    return (
                      <li key={i.id} className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{i.email}</span>
                          <span className="block text-xs text-muted-foreground">
                            {i.kind === "company_contact" ? "Company contact" : "Account activation"} · sent {i.send_count}×
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <StatusBadge status={expired ? "expired" : i.status} />
                          {i.status === "pending" || expired ? <ResendInvitationButton invitationId={i.id} /> : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

            {d.related.length ? (
              <section className="rounded-2xl border bg-card p-5 shadow-card">
                <SectionHeader title="Related invoices" />
                <ul className="space-y-2 text-sm">
                  {d.related.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3">
                      <Link href={`/admin/billing/invoices/${r.id}`} className="font-mono text-xs text-primary hover:underline">
                        {r.invoice_number}
                      </Link>
                      <InvoiceStatusBadge status={r.status} />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
