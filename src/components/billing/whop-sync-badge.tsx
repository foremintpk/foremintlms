import { StatusBadge } from "@/components/common/status-badge";

/** Whether a product/plan/coupon exists on Whop, and the last sync error if any. */
export function WhopSyncBadge({ whopId, error, notNeeded }: { whopId: string | null; error: string | null; notNeeded?: boolean }) {
  if (notNeeded) return <span className="text-xs text-muted-foreground">Not needed</span>;
  if (error) {
    return (
      <span className="flex flex-col gap-1">
        <StatusBadge status="error" label="Sync failed" />
        <span className="max-w-[260px] text-xs text-destructive">{error}</span>
      </span>
    );
  }
  if (whopId) return <StatusBadge status="connected" label="Synced" />;
  return <StatusBadge status="not_configured" label="Not synced" />;
}
