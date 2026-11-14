import type { Metadata } from "next";
import Link from "next/link";
import { Repeat } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { LocalTime } from "@/components/common/local-time";
import { StatusBadge } from "@/components/common/status-badge";
import { InvoiceStatusBadge, PackageStatusBadge } from "@/components/invoicing/invoice-status-badge";
import { requireAdmin } from "@/lib/auth/guards";
import { listInvoiceSubscriptions } from "@/lib/services/invoicing/queries";
import { billingIntervalLabel, formatMinor } from "@/lib/domain/invoicing";

export const instant = false;

export const metadata: Metadata = { title: "Invoice subscriptions" };

export default async function InvoiceSubscriptionsPage() {
  await requireAdmin("/admin/billing/subscriptions");
  const rows = await listInvoiceSubscriptions();

  return (
    <>
      <PageHeader
        title="Invoice subscriptions"
        description={
          <>
            Recurring custom invoices. Access follows Whop&rsquo;s live billing period. Plan subscriptions bought through checkout are under{" "}
            <Link href="/admin/subscriptions" className="font-medium text-primary hover:underline">
              Subscriptions
            </Link>
            .
          </>
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon={Repeat} title="No recurring invoices yet" description="Create a custom invoice with recurring billing to start one." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 text-right font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Subscription</th>
                <th className="px-4 py-3 font-medium">Access</th>
                <th className="px-4 py-3 font-medium">Paid through</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => {
                const ent = Array.isArray(r.invoice_entitlements) ? r.invoice_entitlements[0] : r.invoice_entitlements;
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-3">
                      <Link href={`/admin/billing/invoices/${r.id}`} className="font-mono text-xs text-primary hover:underline">
                        {r.invoice_number}
                      </Link>
                      <span className="mt-1 block">
                        <InvoiceStatusBadge status={r.status} />
                      </span>
                    </td>
                    <td className="px-4 py-3">{r.company_name ?? r.customer_name}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatMinor(r.amount_minor, r.currency)}
                      <span className="block text-xs text-muted-foreground">
                        {billingIntervalLabel(r.billing_interval_days)}
                        {r.billing_cycles ? ` × ${r.billing_cycles}` : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3">{ent?.subscription_status ? <StatusBadge status={ent.subscription_status} /> : <span className="text-xs text-muted-foreground">Not started</span>}</td>
                    <td className="px-4 py-3">{ent ? <PackageStatusBadge status={ent.status} expiresAt={ent.expires_at} /> : "—"}</td>
                    <td className="px-4 py-3 text-xs">
                      {ent?.expires_at ? <LocalTime value={ent.expires_at} format="date" /> : "—"}
                      {ent?.contract_ends_at ? (
                        <span className="block text-muted-foreground">
                          Contract ends <LocalTime value={ent.contract_ends_at} format="date" />
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
