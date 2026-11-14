import type { Metadata } from "next";
import Link from "next/link";
import { Download, History, Webhook, Wallet } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ListToolbar } from "@/components/common/list-toolbar";
import { PaginationBar } from "@/components/common/pagination-bar";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { LocalTime } from "@/components/common/local-time";
import { StatCard } from "@/components/common/stat-card";
import { DateRangeFilter } from "@/components/billing/date-range-filter";
import { WhopStatusBanner } from "@/components/billing/whop-status-banner";
import { buttonVariants } from "@/components/ui/button-variants";
import { requireAdmin } from "@/lib/auth/guards";
import { buildQueryString, parseListParams } from "@/lib/list-params";
import { listPayments } from "@/lib/services/billing/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoney, formatNumber } from "@/lib/format";

export const instant = false;

export const metadata: Metadata = { title: "Payments" };

const STATUS_OPTIONS = [
  { value: "succeeded", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
  { value: "partially_refunded", label: "Partially refunded" },
  { value: "disputed", label: "Disputed" },
  { value: "voided", label: "Voided" },
  { value: "unmatched", label: "Not matched to a learner" },
];
const REASON_OPTIONS = [
  { value: "initial", label: "First subscription payment" },
  { value: "renewal", label: "Renewal" },
  { value: "one_time", label: "One-time" },
  { value: "other", label: "Other" },
];

async function revenueSummary() {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data } = await createAdminClient()
    .from("payment_transactions")
    .select("status, total_cents, refunded_cents, currency")
    .gte("paid_at", since)
    .in("status", ["succeeded", "partially_refunded", "refunded", "disputed"]);
  const byCurrency = new Map<string, number>();
  let count = 0;
  for (const r of data ?? []) {
    count++;
    byCurrency.set(r.currency as string, (byCurrency.get(r.currency as string) ?? 0) + Number(r.total_cents) - Number(r.refunded_cents));
  }
  const failed = await createAdminClient().from("payment_transactions").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", since);
  const unmatched = await createAdminClient().from("payment_transactions").select("id", { count: "exact", head: true }).is("user_id", null);
  return { byCurrency, count, failed: failed.count ?? 0, unmatched: unmatched.count ?? 0 };
}

export default async function AdminPaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  await requireAdmin("/admin/payments");
  const raw = await searchParams;
  const params = parseListParams(raw, { filterKeys: ["status", "reason", "from", "to"], sortable: ["created", "total", "paid"], defaultSort: "created" });
  const [{ rows, total }, summary] = await Promise.all([listPayments(params), revenueSummary()]);
  const net = [...summary.byCurrency.entries()].map(([cur, cents]) => formatMoney(cents, cur)).join(" + ") || formatMoney(0, "usd");

  return (
    <>
      <PageHeader
        title="Payments"
        description="Every Whop payment recorded by Foremint, matched to the learner and the plan they bought."
        actions={
          <>
            <Link href="/admin/payments/reconciliation" className={buttonVariants({ variant: "outline" })}>
              <History className="size-4" /> Reconciliation
            </Link>
            <Link href="/admin/payments/webhooks" className={buttonVariants({ variant: "outline" })}>
              <Webhook className="size-4" /> Webhook events
            </Link>
          </>
        }
      />
      <WhopStatusBanner />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Net revenue, last 30 days" value={net} hint="Paid minus refunds, from verified Whop payments" icon={Wallet} tone="brand" />
        <StatCard label="Paid payments, last 30 days" value={formatNumber(summary.count)} />
        <StatCard label="Failed, last 30 days" value={formatNumber(summary.failed)} tone={summary.failed ? "warning" : "default"} href="/admin/payments?status=failed" />
        <StatCard label="Not matched to a learner" value={formatNumber(summary.unmatched)} tone={summary.unmatched ? "warning" : "default"} href="/admin/payments?status=unmatched" hint="Bought outside Foremint checkout" />
      </div>

      <ListToolbar
        searchPlaceholder="Payment ID, membership ID or email"
        filters={[
          { key: "status", label: "Statuses", options: STATUS_OPTIONS },
          { key: "reason", label: "Types", options: REASON_OPTIONS },
        ]}
      >
        <DateRangeFilter />
        <a href={`/api/billing/exports/payments${buildQueryString(raw, { page: null })}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          <Download className="size-3.5" /> Export CSV
        </a>
      </ListToolbar>

      {rows.length === 0 ? (
        <EmptyState icon={Wallet} title="No payments found" description="Payments appear here as soon as Whop confirms them. Adjust the filters if you expected results." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">
                  <Link href={`/admin/payments${buildQueryString(raw, { sort: "created", dir: params.sort === "created" && params.dir === "desc" ? "asc" : "desc" })}`}>Date</Link>
                </th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 text-right font-medium">
                  <Link href={`/admin/payments${buildQueryString(raw, { sort: "total", dir: params.sort === "total" && params.dir === "desc" ? "asc" : "desc" })}`}>Amount</Link>
                </th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link href={`/admin/payments/${p.id}`} className="font-medium hover:text-primary">
                      <LocalTime value={p.paid_at ?? p.created_at} format="datetime" />
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {p.user_id ? (
                      <>
                        <p className="font-medium">{p.customerName || "—"}</p>
                        <p className="text-xs text-muted-foreground">{p.customerEmail}</p>
                      </>
                    ) : (
                      <StatusBadge status="warning" tone="warning" label="Not matched" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p>{p.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {[p.planName, p.billing_reason === "renewal" ? "Renewal" : null].filter(Boolean).join(" — ")}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums whitespace-nowrap">
                    {formatMoney(p.total_cents, p.currency)}
                    {p.refunded_cents > 0 ? <span className="block text-xs font-normal text-muted-foreground">−{formatMoney(p.refunded_cents, p.currency)}</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} label={p.status === "succeeded" ? "Paid" : undefined} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.whop_payment_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <PaginationBar basePath="/admin/payments" searchParams={raw} page={params.page} pageSize={params.pageSize} total={total} />
    </>
  );
}
