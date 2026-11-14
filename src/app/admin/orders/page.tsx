import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ClipboardList, MailCheck, ShoppingBag, Wallet } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ListToolbar } from "@/components/common/list-toolbar";
import { PaginationBar } from "@/components/common/pagination-bar";
import { EmptyState } from "@/components/common/empty-state";
import { LocalTime } from "@/components/common/local-time";
import { StatCard } from "@/components/common/stat-card";
import { Button } from "@/components/ui/button";
import { FulfillmentStatusBadge, OrderStatusBadge, PAYMENT_STATUS_OPTIONS, PaymentStatusBadge, SourceBadge } from "@/components/admin/commerce/order-badges";
import { requireAdmin } from "@/lib/auth/guards";
import { parseListParams } from "@/lib/list-params";
import { formatMinor } from "@/lib/domain/invoicing";
import { ORDER_STATUS_LABEL, courseTitlesText } from "@/lib/domain/commerce";
import { formatNumber } from "@/lib/format";
import { getOrderKpis, listOrders } from "@/lib/services/commerce/admin";

export const instant = false;

export const metadata: Metadata = { title: "Course orders" };

function accessEnd(paidAt: string | null, durationDays: number | null): string | null {
  if (!paidAt || durationDays === null) return null;
  return new Date(new Date(paidAt).getTime() + durationDays * 86_400_000).toISOString();
}

export default async function CourseOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  await requireAdmin("/admin/orders");
  const raw = await searchParams;
  const params = parseListParams(raw, { filterKeys: ["status", "source", "payment"], pageSize: 25 });
  const [{ rows, total }, kpis] = await Promise.all([
    listOrders({ page: params.page, pageSize: params.pageSize, q: params.q, status: params.filters.status ?? null, source: params.filters.source ?? null, payment: params.filters.payment ?? null }),
    getOrderKpis(),
  ]);
  const filtered = Boolean(params.q || Object.keys(params.filters).length);

  return (
    <>
      <PageHeader
        title="Course orders"
        description="Guest orders from Build your learning plan and the course advisor. Each order has its own single-use Whop payment link; access is set up only after Whop confirms the payment."
        actions={
          <Button asChild variant="outline">
            <Link href="/admin/pricing/public">
              <ShoppingBag aria-hidden /> Public course pricing
            </Link>
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Orders (30 days)" value={formatNumber(kpis.orders30d)} icon={ClipboardList} tone="brand" />
        <StatCard label="Paid (30 days)" value={formatNumber(kpis.paid30d)} hint={`${formatMinor(kpis.revenue30dMinor, kpis.revenueCurrency)} collected`} icon={Wallet} tone="success" />
        <StatCard
          label="Awaiting account activation"
          value={formatNumber(kpis.awaitingActivation)}
          hint="Paid; the learner hasn't set a password yet"
          icon={MailCheck}
          href="/admin/orders?status=paid"
        />
        <StatCard
          label="Needs attention"
          value={formatNumber(kpis.needsAttention)}
          hint="Under review or access setup pending"
          icon={AlertTriangle}
          tone={kpis.needsAttention ? "warning" : "default"}
          href="/admin/orders?status=under_review"
        />
      </div>

      <ListToolbar
        searchPlaceholder="Order number, student or payer email"
        filters={[
          { key: "status", label: "Statuses", options: Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => ({ value, label })) },
          { key: "payment", label: "Payment", options: PAYMENT_STATUS_OPTIONS },
          { key: "source", label: "Sources", options: [{ value: "website", label: "Website" }, { value: "advisor", label: "Course advisor" }] },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title={filtered ? "No orders match" : "No course orders yet"}
          description={filtered ? "Try another search or clear the filters." : "Orders appear here as soon as a visitor generates a payment link on Build your learning plan or in the course advisor."}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[1240px] text-sm" data-testid="orders-table">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Student / payer</th>
                <th className="px-4 py-3 font-medium">Courses</th>
                <th className="px-4 py-3 font-medium">Coupon</th>
                <th className="px-4 py-3 text-right font-medium">Subtotal</th>
                <th className="px-4 py-3 text-right font-medium">Discount</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Dates</th>
                <th className="px-4 py-3 font-medium">Access until</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((o) => {
                const end = accessEnd(o.paid_at, o.duration_days);
                return (
                  <tr key={o.id} className="align-top">
                    <td className="px-4 py-3">
                      <Link href={`/admin/orders/${o.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
                        {o.order_number}
                      </Link>
                      <div className="mt-1">
                        <SourceBadge source={o.source} />
                      </div>
                    </td>
                    <td className="max-w-[220px] px-4 py-3">
                      <p className="truncate font-medium" title={o.learner_email}>
                        {o.learner_email}
                      </p>
                      {o.payer_email && o.payer_email !== o.learner_email ? (
                        <p className="truncate text-xs text-muted-foreground" title={o.payer_email}>
                          Paid by {o.payer_email}
                        </p>
                      ) : null}
                    </td>
                    <td className="max-w-[260px] px-4 py-3">
                      <p className="font-medium">
                        {o.itemCount} {o.itemCount === 1 ? "course" : "courses"}
                      </p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{courseTitlesText(o.courseTitles, 3)}</p>
                    </td>
                    <td className="px-4 py-3">{o.coupon_code_snapshot ? <span className="font-mono text-xs">{o.coupon_code_snapshot}</span> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{formatMinor(o.subtotal_minor, o.currency)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{o.discount_minor ? `−${formatMinor(o.discount_minor, o.currency)}` : "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap tabular-nums">{formatMinor(o.total_minor, o.currency)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <OrderStatusBadge status={o.status} />
                        <PaymentStatusBadge status={o.payment_status} />
                        <FulfillmentStatusBadge status={o.fulfillment_status} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap text-muted-foreground">
                      <p>
                        Created <LocalTime value={o.created_at} format="date" />
                      </p>
                      {o.paid_at ? (
                        <p className="text-success">
                          Paid <LocalTime value={o.paid_at} format="date" />
                        </p>
                      ) : (
                        <p>
                          Link until <LocalTime value={o.expires_at} format="date" />
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {o.duration_days === null ? "Lifetime" : end ? <LocalTime value={end} format="date" /> : <span className="text-muted-foreground">{o.duration_days} days from payment</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <PaginationBar basePath="/admin/orders" searchParams={raw} page={params.page} pageSize={params.pageSize} total={total} />
    </>
  );
}
