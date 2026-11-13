import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, RefreshCw, Repeat } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ListToolbar } from "@/components/common/list-toolbar";
import { PaginationBar } from "@/components/common/pagination-bar";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { LocalTime } from "@/components/common/local-time";
import { StatCard } from "@/components/common/stat-card";
import { ActionButton } from "@/components/billing/action-button";
import { WhopStatusBanner } from "@/components/billing/whop-status-banner";
import { requireAdmin } from "@/lib/auth/guards";
import { buildQueryString, parseListParams } from "@/lib/list-params";
import { listSubscriptions, subscriptionStatusCounts } from "@/lib/services/billing/queries";
import { billingPeriodLabel, formatMoney, formatNumber } from "@/lib/format";
import { syncSubscriptionAction } from "../payments/actions";

export const instant = false;

export const metadata: Metadata = { title: "Subscriptions" };

const STATUSES = ["trialing", "active", "past_due", "canceling", "canceled", "expired", "completed", "unresolved", "drafted"];

export default async function SubscriptionsPage({ searchParams }: PageProps<"/admin/subscriptions">) {
  await requireAdmin("/admin/subscriptions");
  const raw = await searchParams;
  const params = parseListParams(raw, { filterKeys: ["status"], sortable: ["created", "period_end"], defaultSort: "created" });
  const [{ rows, total }, counts] = await Promise.all([listSubscriptions(params), subscriptionStatusCounts()]);
  const live = (counts.active ?? 0) + (counts.trialing ?? 0) + (counts.canceling ?? 0);

  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Recurring Whop memberships. Access follows each membership's live status; reconciliation re-checks them daily."
      />
      <WhopStatusBanner />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active" value={formatNumber(live)} hint="Active, trialing or cancelling at period end" tone="brand" icon={Repeat} href="/admin/subscriptions?status=active" />
        <StatCard label="Trialing" value={formatNumber(counts.trialing ?? 0)} href="/admin/subscriptions?status=trialing" />
        <StatCard label="Past due" value={formatNumber(counts.past_due ?? 0)} tone={counts.past_due ? "warning" : "default"} href="/admin/subscriptions?status=past_due" hint="In grace period after a failed payment" />
        <StatCard label="Ended" value={formatNumber((counts.canceled ?? 0) + (counts.expired ?? 0))} href="/admin/subscriptions?status=canceled" />
      </div>
      <ListToolbar
        searchPlaceholder="Whop membership ID"
        filters={[{ key: "status", label: "Statuses", options: STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) })) }]}
      />
      {rows.length === 0 ? (
        <EmptyState icon={Repeat} title="No subscriptions found" description="Subscriptions appear when learners buy a recurring plan." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">
                  <Link href={`/admin/subscriptions${buildQueryString(raw, { sort: "period_end", dir: params.sort === "period_end" && params.dir === "asc" ? "desc" : "asc" })}`}>Period ends</Link>
                </th>
                <th className="px-4 py-3 font-medium">Last checked</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3">
                    {s.user_id ? (
                      <Link href={`/admin/students/${s.user_id}`} className="font-medium hover:text-primary">
                        {s.customerName || s.customerEmail || "Learner"}
                      </Link>
                    ) : (
                      <StatusBadge status="warning" tone="warning" label="Not matched" />
                    )}
                    <p className="font-mono text-[11px] text-muted-foreground">{s.whop_membership_id}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{s.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.planName}
                      {s.priceCents !== null ? ` — ${formatMoney(s.priceCents, s.currency)} / ${billingPeriodLabel(s.periodDays) || "period"}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
                    {s.cancel_at_period_end && s.status !== "canceled" ? <p className="mt-1 text-xs text-muted-foreground">Cancels at period end</p> : null}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <LocalTime value={s.current_period_end} format="date" />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <LocalTime value={s.last_synced_at} format="relative" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {s.manage_url ? (
                        <a href={s.manage_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                          Whop <ExternalLink className="size-3" aria-hidden />
                        </a>
                      ) : null}
                      <ActionButton action={syncSubscriptionAction} input={{ subscriptionId: s.id }} size="xs" pendingLabel="Checking…">
                        <RefreshCw className="size-3" /> Re-check
                      </ActionButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <PaginationBar basePath="/admin/subscriptions" searchParams={raw} page={params.page} pageSize={params.pageSize} total={total} />
    </>
  );
}
