import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { LocalTime } from "@/components/common/local-time";
import { StatusBadge } from "@/components/common/status-badge";
import { PersonAvatar } from "@/components/communication/person";
import { requireAdmin } from "@/lib/auth/guards";
import { listReportedConversations } from "@/lib/services/moderation";

export const instant = false;
export const metadata = { title: "Reported conversations" };

export default async function ReportedConversationsPage() {
  await requireAdmin("/admin/messages/reported");
  const conversations = await listReportedConversations();

  return (
    <>
      <PageHeader
        title="Reported conversations"
        description="Private conversations that contain reported messages. Opening one doesn't notify the participants; resolve the reports from Discussions → Reports."
        back={{ href: "/admin/messages", label: "Messages" }}
      />
      {conversations.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No reported messages" description="When someone reports a private message, the conversation appears here." />
      ) : (
        <ul className="divide-y rounded-2xl border bg-card shadow-card">
          {conversations.map((c) => (
            <li key={c.conversationId}>
              <Link href={`/admin/messages/${c.conversationId}`} className="flex flex-wrap items-center gap-4 p-4 hover:bg-muted/50">
                <div className="flex -space-x-2">
                  {c.participants.slice(0, 3).map((p) => (
                    <PersonAvatar key={p.id} person={p} className="size-9 ring-2 ring-card" />
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.participants.map((p) => p.name).join(" and ")}</p>
                  <p className="text-xs text-muted-foreground">
                    Last reported <LocalTime value={c.lastReportedAt} format="relative" />
                  </p>
                </div>
                {c.openReports > 0 ? (
                  <StatusBadge status="open" label={`${c.openReports} open report${c.openReports === 1 ? "" : "s"}`} tone="warning" />
                ) : (
                  <StatusBadge status="resolved" label="Reports resolved" />
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
