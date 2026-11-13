import type { Metadata } from "next";
import { Webhook } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ListToolbar } from "@/components/common/list-toolbar";
import { PaginationBar } from "@/components/common/pagination-bar";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { LocalTime } from "@/components/common/local-time";
import { ActionButton } from "@/components/billing/action-button";
import { WhopStatusBanner } from "@/components/billing/whop-status-banner";
import { requireAdmin } from "@/lib/auth/guards";
import { parseListParams } from "@/lib/list-params";
import { listWebhookEvents } from "@/lib/services/billing/queries";
import { HANDLED_WHOP_EVENTS } from "@/lib/services/payments/mapping";
import { appUrl } from "@/lib/env";
import { retryWebhookEventAction } from "../actions";

export const instant = false;

export const metadata: Metadata = { title: "Whop webhook events" };

export default async function WebhookEventsPage({ searchParams }: PageProps<"/admin/payments/webhooks">) {
  await requireAdmin("/admin/payments");
  const raw = await searchParams;
  const params = parseListParams(raw, { filterKeys: ["status"], pageSize: 30 });
  const { rows, total } = await listWebhookEvents(params);

  return (
    <>
      <PageHeader
        back={{ href: "/admin/payments", label: "Payments" }}
        title="Webhook events"
        description="Every notification Whop has sent. Failed events are retried automatically with increasing delays; you can also retry one now."
      />
      <WhopStatusBanner />
      <div className="mb-6 rounded-2xl border bg-card p-4 text-sm">
        <p className="font-medium">Endpoint</p>
        <p className="mt-1 font-mono text-xs break-all text-muted-foreground">{appUrl("/api/webhooks/whop")}</p>
        <p className="mt-3 font-medium">Events Foremint acts on</p>
        <p className="mt-1 font-mono text-xs leading-relaxed text-muted-foreground">{HANDLED_WHOP_EVENTS.join(", ")}</p>
      </div>
      <ListToolbar
        searchPlaceholder="Event type or id"
        filters={[
          {
            key: "status",
            label: "Statuses",
            options: [
              { value: "processed", label: "Processed" },
              { value: "failed", label: "Failed" },
              { value: "processing", label: "Processing" },
              { value: "ignored", label: "Ignored" },
            ],
          },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState icon={Webhook} title="No webhook events" description="Events appear here once Whop starts sending them to the endpoint above." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Received</th>
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Attempts</th>
                <th className="px-4 py-3 font-medium">Details</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((ev) => (
                <tr key={ev.id}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <LocalTime value={ev.received_at} format="datetime" />
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs font-medium">{ev.event_type}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{ev.event_id}</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={ev.status === "processed" ? "sent" : ev.status === "processing" ? "sending" : ev.status} label={ev.status.charAt(0).toUpperCase() + ev.status.slice(1)} />
                  </td>
                  <td className="px-4 py-3 tabular-nums">{ev.attempts}</td>
                  <td className="px-4 py-3 text-xs">
                    {ev.last_error ? <span className="text-destructive">{ev.last_error}</span> : null}
                    {ev.status === "failed" && ev.next_attempt_at ? (
                      <span className="block text-muted-foreground">
                        Next retry <LocalTime value={ev.next_attempt_at} format="relative" />
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {ev.status === "failed" ? (
                      <ActionButton action={retryWebhookEventAction} input={{ eventId: ev.id }} size="xs" pendingLabel="Retrying…">
                        Retry now
                      </ActionButton>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <PaginationBar basePath="/admin/payments/webhooks" searchParams={raw} page={params.page} pageSize={params.pageSize} total={total} />
    </>
  );
}
