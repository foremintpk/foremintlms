import type { Metadata } from "next";
import { History, Play } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { LocalTime } from "@/components/common/local-time";
import { ActionButton } from "@/components/billing/action-button";
import { WhopStatusBanner } from "@/components/billing/whop-status-banner";
import { requireAdmin } from "@/lib/auth/guards";
import { listReconciliationLogs } from "@/lib/services/billing/queries";
import { runReconciliationAction } from "../actions";

export const instant = false;

export const metadata: Metadata = { title: "Payment reconciliation" };

export default async function ReconciliationPage() {
  await requireAdmin("/admin/payments");
  const logs = await listReconciliationLogs(30);

  return (
    <>
      <PageHeader
        back={{ href: "/admin/payments", label: "Payments" }}
        title="Reconciliation"
        description="Compares Foremint's payment and subscription records with Whop's live state and fixes any drift — for example a missed webhook or a change made in the Whop dashboard. It runs every day automatically."
        actions={
          <ActionButton action={runReconciliationAction} input={{}} variant="default" size="default" pendingLabel="Reconciling…">
            <Play className="size-4" /> Run reconciliation now
          </ActionButton>
        }
      />
      <WhopStatusBanner />
      {logs.length === 0 ? (
        <EmptyState icon={History} title="No reconciliation runs yet" description="The first scheduled run happens within a day, or start one now." />
      ) : (
        <ul className="space-y-3">
          {logs.map((log) => (
            <li key={log.id} className="rounded-2xl border bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">
                    <LocalTime value={log.started_at} format="datetime" />
                  </p>
                  <p className="text-xs text-muted-foreground">{log.trigger === "manual" ? "Started by an administrator" : "Scheduled run"}</p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">
                    Checked <span className="font-medium text-foreground tabular-nums">{log.checked_count}</span>
                  </span>
                  <span className="text-muted-foreground">
                    Fixed <span className="font-medium text-foreground tabular-nums">{log.updated_count}</span>
                  </span>
                  <StatusBadge status={log.status === "completed" ? "sent" : log.status === "running" ? "sending" : log.status === "skipped" ? "skipped" : "failed"} label={log.status.charAt(0).toUpperCase() + log.status.slice(1)} />
                </div>
              </div>
              {log.error ? <p className="mt-2 text-sm text-destructive">{log.error}</p> : null}
              {log.mismatches?.length ? (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-medium text-primary">
                    {log.mismatches.length} difference{log.mismatches.length === 1 ? "" : "s"}
                  </summary>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[600px] text-xs">
                      <thead className="text-left text-muted-foreground">
                        <tr>
                          <th className="py-1.5 pr-3 font-medium">Record</th>
                          <th className="py-1.5 pr-3 font-medium">Field</th>
                          <th className="py-1.5 pr-3 font-medium">Foremint had</th>
                          <th className="py-1.5 pr-3 font-medium">Whop has</th>
                          <th className="py-1.5 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {log.mismatches.map((m, i) => (
                          <tr key={`${m.whopId}-${m.field}-${i}`}>
                            <td className="py-1.5 pr-3 font-mono">{m.whopId}</td>
                            <td className="py-1.5 pr-3">{m.field}</td>
                            <td className="py-1.5 pr-3">{m.local ?? "—"}</td>
                            <td className="py-1.5 pr-3">{m.remote ?? "—"}</td>
                            <td className="py-1.5">{m.action}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
