import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { LocalTime } from "@/components/common/local-time";
import { ExtendAccessDialog } from "@/components/invoicing/package-controls";
import { requireAdmin } from "@/lib/auth/guards";
import { listExpiringPackages } from "@/lib/services/invoicing/queries";
import { remainingDays } from "@/lib/domain/invoicing";
import { cn } from "@/lib/utils";

export const instant = false;

export const metadata: Metadata = { title: "Expiring access" };

const WINDOWS = [7, 30, 60, 90];

type Row = Awaited<ReturnType<typeof listExpiringPackages>>["expiring"][number];

function PackageTable({ rows, ended }: { rows: Row[]; ended?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Customer</th>
            <th className="px-4 py-3 font-medium">Package</th>
            <th className="px-4 py-3 font-medium">{ended ? "Ended" : "Ends"}</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => {
            const inv = r.custom_invoices as unknown as { id: string; invoice_number: string; invoice_description: string; company_name: string | null; customer_name: string; customer_email: string; billing_type: string };
            const company = r.companies as unknown as { id: string; name: string } | null;
            const left = remainingDays(r.expires_at);
            return (
              <tr key={r.id}>
                <td className="px-4 py-3">
                  {company ? (
                    <Link href={`/admin/billing/companies/${company.id}`} className="font-medium text-primary hover:underline">
                      {company.name}
                    </Link>
                  ) : (
                    <span className="font-medium">{inv.customer_name}</span>
                  )}
                  <span className="block text-xs text-muted-foreground">{inv.customer_email}</span>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/billing/invoices/${inv.id}`} className="font-mono text-xs text-primary hover:underline">
                    {inv.invoice_number}
                  </Link>
                  <span className="block">{inv.invoice_description}</span>
                </td>
                <td className="px-4 py-3">
                  <LocalTime value={r.expires_at!} format="date" />
                  {!ended ? <span className={cn("block text-xs", left !== null && left <= 7 ? "text-warning" : "text-muted-foreground")}>in {left} day{left === 1 ? "" : "s"}</span> : null}
                </td>
                <td className="px-4 py-3 text-right">
                  <ExtendAccessDialog entitlementId={r.id} currentExpiry={r.expires_at} triggerLabel={ended ? "Extend / reactivate" : "Extend"} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function ExpiringAccessPage({ searchParams }: PageProps<"/admin/billing/expiring">) {
  await requireAdmin("/admin/billing/expiring");
  const sp = await searchParams;
  const days = WINDOWS.includes(Number(sp.days)) ? Number(sp.days) : 30;
  const { expiring, recentlyExpired } = await listExpiringPackages(days);

  return (
    <>
      <PageHeader title="Expiring access" description="Company and individual packages approaching their end date. Customers are reminded automatically before access ends.">
        <nav aria-label="Time window" className="flex gap-2">
          {WINDOWS.map((w) => (
            <Link key={w} href={`/admin/billing/expiring?days=${w}`} aria-current={w === days ? "page" : undefined} className={cn("rounded-full border px-3 py-1 text-xs font-medium", w === days ? "border-primary bg-brand-soft text-primary" : "text-muted-foreground hover:text-foreground")}>
              Next {w} days
            </Link>
          ))}
        </nav>
      </PageHeader>
      {expiring.length === 0 ? <EmptyState icon={CalendarClock} title={`Nothing ends in the next ${days} days`} /> : <PackageTable rows={expiring} />}
      {recentlyExpired.length ? (
        <section className="mt-8">
          <SectionHeader title="Ended in the last 30 days" />
          <PackageTable rows={recentlyExpired} ended />
        </section>
      ) : null}
    </>
  );
}
