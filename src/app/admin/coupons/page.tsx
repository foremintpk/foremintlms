import type { Metadata } from "next";
import { RefreshCw, TicketPercent, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { LocalTime } from "@/components/common/local-time";
import { ConfirmAction } from "@/components/common/confirm-action";
import { ActionButton } from "@/components/billing/action-button";
import { CreateCouponDialog } from "@/components/billing/coupon-form";
import { WhopStatusBanner } from "@/components/billing/whop-status-banner";
import { WhopSyncBadge } from "@/components/billing/whop-sync-badge";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/guards";
import { listCoupons, listPaidPlansForSelect } from "@/lib/services/billing/queries";
import { getSetting } from "@/lib/settings";
import { formatMoney } from "@/lib/format";
import { createCouponAction, deleteCouponAction, setCouponStatusAction, syncCouponAction } from "./actions";

export const instant = false;

export const metadata: Metadata = { title: "Coupons" };

export default async function CouponsPage() {
  await requireAdmin("/admin/coupons");
  const [coupons, plans, currency] = await Promise.all([listCoupons(), listPaidPlansForSelect(), getSetting<string>("billing.default_currency", "usd")]);
  const planLabel = new Map(plans.map((p) => [p.id, p.label]));

  return (
    <>
      <PageHeader
        title="Coupons"
        description="Discount codes are created as Whop promo codes, so buyers enter them on the Whop checkout page."
        actions={<CreateCouponDialog plans={plans} create={createCouponAction} defaultCurrency={currency} />}
      />
      <WhopStatusBanner />
      {coupons.length === 0 ? (
        <EmptyState icon={TicketPercent} title="No coupons yet" description="Create a code for a launch, a partner or a returning-student offer." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Discount</th>
                <th className="px-4 py-3 font-medium">Applies to</th>
                <th className="px-4 py-3 font-medium">Used</th>
                <th className="px-4 py-3 font-medium">Expires</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Whop</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {coupons.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <p className="font-mono font-semibold">{c.code}</p>
                    {c.description ? <p className="text-xs text-muted-foreground">{c.description}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    {c.discount_type === "percent" ? `${Number(c.amount)}% off` : `${formatMoney(Math.round(Number(c.amount) * 100), c.currency ?? currency)} off`}
                    {c.new_customers_only ? <p className="text-xs text-muted-foreground">New customers only</p> : null}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.plan_ids.length ? c.plan_ids.map((id) => planLabel.get(id) ?? "Archived plan").join(", ") : "All plans"}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {c.redemptions_count}
                    {c.max_redemptions ? ` / ${c.max_redemptions}` : ""}
                  </td>
                  <td className="px-4 py-3">{c.expires_at ? <LocalTime value={c.expires_at} format="date" /> : "Never"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status === "disabled" ? "hidden" : c.status} label={c.status === "disabled" ? "Paused" : undefined} />
                  </td>
                  <td className="px-4 py-3">
                    <WhopSyncBadge whopId={c.whop_promo_code_id} error={c.whop_sync_error} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {!c.whop_promo_code_id ? (
                        <ActionButton action={syncCouponAction} input={{ couponId: c.id }} size="xs" pendingLabel="Syncing…">
                          <RefreshCw className="size-3" /> Sync
                        </ActionButton>
                      ) : null}
                      {c.status === "active" ? (
                        <ActionButton action={setCouponStatusAction} input={{ couponId: c.id, status: "disabled" as const }} size="xs">
                          Pause
                        </ActionButton>
                      ) : c.status === "disabled" ? (
                        <ActionButton action={setCouponStatusAction} input={{ couponId: c.id, status: "active" as const }} size="xs">
                          Activate
                        </ActionButton>
                      ) : null}
                      {c.status !== "archived" ? (
                        <ActionButton action={setCouponStatusAction} input={{ couponId: c.id, status: "archived" as const }} size="xs" variant="ghost">
                          Archive
                        </ActionButton>
                      ) : null}
                      {!c.whop_promo_code_id && c.redemptions_count === 0 ? (
                        <ConfirmAction
                          title={`Delete ${c.code}?`}
                          description="The code was never synced to Whop or used, so it can be removed."
                          confirmLabel="Delete coupon"
                          destructive
                          action={deleteCouponAction.bind(null, c.id)}
                          trigger={
                            <Button variant="ghost" size="icon-xs" title="Delete coupon">
                              <Trash2 className="size-3.5" />
                              <span className="sr-only">Delete coupon</span>
                            </Button>
                          }
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        Whop promo codes can&apos;t be edited after they are created. To change a discount, archive the code and create a new one.
      </p>
    </>
  );
}
