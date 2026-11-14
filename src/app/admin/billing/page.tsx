import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Building2, CalendarClock, CheckCircle2, FilePlus2, FileText, Hourglass, Users } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/app-shell/page-header";
import { StatCard } from "@/components/common/stat-card";
import { Button } from "@/components/ui/button";
import { BarList } from "@/components/admin/charts/bar-list";
import { TimeSeriesChart } from "@/components/admin/charts/time-series-chart";
import { WhopStatusBanner } from "@/components/billing/whop-status-banner";
import { requireAdmin } from "@/lib/auth/guards";
import { getBillingOverview } from "@/lib/services/invoicing/queries";
import { formatMinor } from "@/lib/domain/invoicing";
import { formatNumber, formatPercent } from "@/lib/format";

export const instant = false;

export const metadata: Metadata = { title: "Billing overview" };

export default async function BillingOverviewPage() {
  await requireAdmin("/admin/billing");
  const o = await getBillingOverview();
  const primary = o.revenue[0];

  return (
    <>
      <PageHeader
        title="Billing & invoicing"
        description="Custom invoices, company packages and the payments Whop has verified. Revenue counts only payments Whop confirmed, net of refunds."
        actions={
          <Button asChild>
            <Link href="/admin/billing/invoices/new">
              <FilePlus2 aria-hidden />
              Create custom invoice
            </Link>
          </Button>
        }
      />
      <WhopStatusBanner />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Custom invoices" value={formatNumber(o.total)} hint={`${o.drafts} draft or generating`} icon={FileText} href="/admin/billing/invoices" />
        <StatCard label="Paid" value={formatNumber(o.paid)} hint={o.conversion === null ? "No invoices issued yet" : `${formatPercent(o.conversion * 100)} of issued invoices`} icon={CheckCircle2} tone="success" href="/admin/billing/invoices?status=paid" />
        <StatCard label="Awaiting payment" value={formatNumber(o.pending)} hint="Payment link sent" icon={Hourglass} tone="brand" href="/admin/billing/invoices?status=awaiting_payment" />
        <StatCard
          label="Overdue or needs review"
          value={formatNumber(o.overdue + o.underReview)}
          hint={`${o.overdue} past due · ${o.underReview} under review`}
          icon={AlertTriangle}
          tone="warning"
          href={o.underReview ? "/admin/billing/invoices?status=under_review" : "/admin/billing/invoices?status=past_due"}
        />
        <StatCard
          label="Collected (net)"
          value={primary ? formatMinor(primary.net, primary.currency) : formatMinor(0, "usd")}
          hint={o.revenue.length > 1 ? `Plus ${o.revenue.length - 1} other currenc${o.revenue.length === 2 ? "y" : "ies"}` : "Verified Whop payments"}
        />
        <StatCard label="Active companies" value={formatNumber(o.activeCompanies)} hint={`${o.companies} in total`} icon={Building2} href="/admin/billing/companies?status=active" />
        <StatCard label="Active company learners" value={formatNumber(o.activeCompanyLearners)} hint="Members of companies with live access" icon={Users} href="/admin/billing/members" />
        <StatCard label="Packages ending in 30 days" value={formatNumber(o.expiringPackages)} hint="Company and individual" icon={CalendarClock} href="/admin/billing/expiring" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5 shadow-card">
          <SectionHeader title="Invoices paid per month" description="Last six months, by date Whop confirmed payment." />
          <TimeSeriesChart data={o.months.map((m) => ({ bucket: `${m.month}-01`, value: m.paid }))} label="Paid invoices" bucket="month" />
        </section>
        <section className="rounded-2xl border bg-card p-5 shadow-card">
          <SectionHeader title="Revenue by currency" description="Net of refunds. One-time and recurring split below each bar." />
          <BarList
            items={o.revenue.map((r) => ({
              key: r.currency,
              label: r.currency.toUpperCase(),
              value: Math.max(r.net, 0),
              display: formatMinor(r.net, r.currency),
              sub: `One-time ${formatMinor(r.oneTime, r.currency)} · Recurring ${formatMinor(r.recurring, r.currency)}${r.refunded ? ` · Refunded ${formatMinor(r.refunded, r.currency)}` : ""}`,
            }))}
            emptyLabel="No custom invoice payments yet."
          />
        </section>
      </div>
    </>
  );
}
