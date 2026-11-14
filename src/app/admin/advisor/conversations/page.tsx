import type { Metadata } from "next";
import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ListToolbar } from "@/components/common/list-toolbar";
import { LocalTime } from "@/components/common/local-time";
import { PaginationBar } from "@/components/common/pagination-bar";
import { StatusBadge } from "@/components/common/status-badge";
import { AdvisorNav } from "@/components/admin/advisor/advisor-nav";
import { requireAdmin } from "@/lib/auth/guards";
import { parseListParams } from "@/lib/list-params";
import { getAdvisorAdminSettings, intentTitles, listSessions } from "@/lib/services/advisor/admin";

export const instant = false;
export const metadata: Metadata = { title: "Advisor conversations" };

const STATUS_LABEL: Record<string, string> = { active: "Active", ended: "Ended", expired: "Expired", limited: "Limit reached" };

export default async function AdvisorConversationsPage({ searchParams }: PageProps<"/admin/advisor/conversations">) {
  await requireAdmin("/admin/advisor/conversations");
  const raw = await searchParams;
  const params = parseListParams(raw, { pageSize: 25, filterKeys: ["status"] });
  const status = params.filters.status && STATUS_LABEL[params.filters.status] ? params.filters.status : null;
  const [{ rows, total }, titles, settings] = await Promise.all([listSessions({ from: params.from, to: params.to, status, q: params.q }), intentTitles(), getAdvisorAdminSettings()]);

  return (
    <>
      <PageHeader
        title="Course advisor"
        description={`Anonymous conversation logs: what was matched, recommended and added — no names, and emails or phone numbers are redacted. Logs older than ${settings.retentionDays} days are deleted daily.`}
      />
      <AdvisorNav active="conversations" />
      <ListToolbar
        searchPlaceholder="Search by intent key"
        filters={[{ key: "status", label: "Statuses", options: Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })) }]}
      />
      {rows.length === 0 ? (
        <EmptyState icon={MessagesSquare} title="No conversations" description={params.q || status ? "Nothing matches these filters." : "Conversations appear here once visitors use the advisor."} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Started</th>
                <th className="px-4 py-3 font-medium">Last activity</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last goal</th>
                <th className="px-4 py-3 font-medium">Messages</th>
                <th className="px-4 py-3 font-medium">Fallbacks</th>
                <th className="px-4 py-3 font-medium">Order</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/advisor/conversations/${s.id}`} className="font-medium hover:underline">
                      <LocalTime value={s.started_at} />
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <LocalTime value={s.last_activity_at} format="relative" />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.session_status === "limited" ? "pending" : s.session_status} label={STATUS_LABEL[s.session_status] ?? s.session_status} />
                  </td>
                  <td className="px-4 py-3">{s.current_intent ? titles.get(s.current_intent) ?? s.current_intent : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3 tabular-nums">{s.message_count}</td>
                  <td className="px-4 py-3 tabular-nums">{s.fallback_count}</td>
                  <td className="px-4 py-3">
                    {s.order ? (
                      <Link href={`/admin/orders/${s.order.id}`} className="font-mono text-xs text-primary hover:underline">
                        {s.order.order_number}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <PaginationBar basePath="/admin/advisor/conversations" searchParams={raw} page={params.page} pageSize={params.pageSize} total={total} />
    </>
  );
}
