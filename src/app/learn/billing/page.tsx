import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CreditCard, ExternalLink, Infinity as InfinityIcon, Receipt, Repeat } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { LocalTime } from "@/components/common/local-time";
import { DocumentLinks } from "@/components/billing/document-links";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guards";
import { getLearnerBilling } from "@/lib/services/billing/queries";
import { billingPeriodLabel, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export const instant = false;

export const metadata: Metadata = { title: "Billing" };

const ACTIVE_SUB = new Set(["trialing", "active", "past_due", "canceling"]);

export default async function LearnBillingPage({ searchParams }: PageProps<"/learn/billing">) {
  const user = await requireUser("/learn/billing");
  const params = await searchParams;
  const billing = await getLearnerBilling(user.id);
  const activeSubs = billing.subscriptions.filter((s) => ACTIVE_SUB.has(s.status));
  const pastSubs = billing.subscriptions.filter((s) => !ACTIVE_SUB.has(s.status));

  return (
    <>
      <PageHeader
        title="Billing"
        description="Your subscriptions, current access, payments and receipts. Payments are processed securely by Whop."
      />

      {params.notice === "already-enrolled" ? (
        <Alert className="mb-6">
          <AlertTitle>You already have this</AlertTitle>
          <AlertDescription>Your current access already covers that plan, so nothing new was charged.</AlertDescription>
        </Alert>
      ) : null}

      <section className="mb-10">
        <SectionHeader title="Subscriptions" description="Recurring plans renew automatically until you cancel." />
        {activeSubs.length === 0 && pastSubs.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-card/60 px-5 py-6 text-sm text-muted-foreground">
            You don&apos;t have any subscriptions. Memberships and monthly plans you start will appear here.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {[...activeSubs, ...pastSubs].map((sub) => {
              const ends = sub.current_period_end;
              const canceling = sub.cancel_at_period_end || sub.status === "canceling";
              return (
                <article key={sub.id} className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-heading text-lg font-semibold">{sub.productName}</h3>
                      <p className="text-sm text-muted-foreground">
                        {sub.planName}
                        {sub.priceCents !== null ? ` — ${formatMoney(sub.priceCents, sub.currency)} per ${billingPeriodLabel(sub.periodDays) || "period"}` : ""}
                      </p>
                    </div>
                    <StatusBadge status={canceling && sub.status === "active" ? "canceling" : sub.status} />
                  </div>
                  {sub.status === "past_due" ? (
                    <p className="flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                      Your last payment failed. Update your payment method to keep your access.
                    </p>
                  ) : null}
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-muted-foreground">{ACTIVE_SUB.has(sub.status) ? (canceling ? "Access ends" : "Renews") : "Ended"}</dt>
                      <dd className="font-medium">
                        <LocalTime value={ends ?? sub.canceled_at} format="date" />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Started</dt>
                      <dd className="font-medium">
                        <LocalTime value={sub.created_at} format="date" />
                      </dd>
                    </div>
                  </dl>
                  {canceling && ACTIVE_SUB.has(sub.status) ? (
                    <p className="text-sm text-muted-foreground">Cancelled — you keep access until the end of the paid period and won&apos;t be charged again.</p>
                  ) : null}
                  {sub.manage_url && ACTIVE_SUB.has(sub.status) ? (
                    <a
                      href={sub.manage_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
                    >
                      Manage on Whop <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  ) : ACTIVE_SUB.has(sub.status) ? (
                    <p className="text-xs text-muted-foreground">
                      To change or cancel, sign in to Whop with the email you paid with, or{" "}
                      <Link href="/learn/support/new" className="font-medium text-primary hover:underline">
                        contact support
                      </Link>
                      .
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="mb-10">
        <SectionHeader title="Your access" description="Courses you can open right now and when that access ends." />
        {billing.access.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-card/60 px-5 py-6 text-sm text-muted-foreground">
            No active course access.{" "}
            <Link href="/courses" className="font-medium text-primary hover:underline">
              Browse courses
            </Link>
          </p>
        ) : (
          <ul className="divide-y rounded-2xl border bg-card">
            {billing.access.map((a) => (
              <li key={a.id} className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  {a.courseSlug ? (
                    <Link href={`/learn/courses/${a.courseSlug}`} className="truncate font-medium hover:text-primary">
                      {a.courseTitle}
                    </Link>
                  ) : (
                    <span className="font-medium">{a.courseTitle}</span>
                  )}
                  {a.status === "suspended" ? <StatusBadge status="suspended" label="On hold" /> : null}
                </div>
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  {a.source === "subscription" || a.source === "membership" ? (
                    <>
                      <Repeat className="size-3.5" aria-hidden />
                      {a.expiresAt ? (
                        <>
                          Renews or ends <LocalTime value={a.expiresAt} format="date" />
                        </>
                      ) : (
                        "While subscribed"
                      )}
                    </>
                  ) : a.expiresAt ? (
                    <>
                      Until <LocalTime value={a.expiresAt} format="date" />
                    </>
                  ) : (
                    <>
                      <InfinityIcon className="size-3.5" aria-hidden /> Lifetime access
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {billing.access.some((a) => a.status === "suspended") ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Access on hold usually means a payment is being disputed with your bank. It&apos;s restored automatically once the dispute is resolved.
          </p>
        ) : null}
      </section>

      <section>
        <SectionHeader title="Payment history" description="Download receipts for your records." />
        {billing.payments.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No payments yet"
            description="When you buy a course or plan, the payment and its receipts appear here."
            action={
              <Link href="/pricing" className={buttonVariants()}>
                <CreditCard className="size-4" /> See plans
              </Link>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-card">
            <table className="w-full text-sm max-md:hidden">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Description</th>
                  <th className="px-5 py-3 text-right font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Documents</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {billing.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <LocalTime value={p.paid_at ?? p.created_at} format="date" />
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium">{p.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {[p.planName, p.billing_reason === "renewal" ? "Renewal" : null, p.card_brand && p.card_last4 ? `${p.card_brand} •••• ${p.card_last4}` : null]
                          .filter(Boolean)
                          .join(" — ")}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-right font-medium tabular-nums whitespace-nowrap">
                      {formatMoney(p.total_cents, p.currency)}
                      {p.refunded_cents > 0 ? (
                        <span className="block text-xs font-normal text-muted-foreground">−{formatMoney(p.refunded_cents, p.currency)} refunded</span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={p.status} label={p.status === "succeeded" ? "Paid" : undefined} />
                    </td>
                    <td className="px-5 py-3.5">
                      <DocumentLinks documents={p.documents} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y md:hidden">
              {billing.payments.map((p) => (
                <li key={p.id} className="space-y-2 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        <LocalTime value={p.paid_at ?? p.created_at} format="date" />
                        {p.planName ? ` — ${p.planName}` : ""}
                      </p>
                    </div>
                    <p className="font-medium tabular-nums">{formatMoney(p.total_cents, p.currency)}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <StatusBadge status={p.status} label={p.status === "succeeded" ? "Paid" : undefined} />
                    <DocumentLinks documents={p.documents} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </>
  );
}
