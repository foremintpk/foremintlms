import type { Metadata } from "next";
import Link from "next/link";
import { GitBranch, Target } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { AdvisorNav } from "@/components/admin/advisor/advisor-nav";
import { CreateIntentDialog, IntentActiveSwitch, TestMessageBox } from "@/components/admin/advisor/intent-editor";
import { requireAdmin } from "@/lib/auth/guards";
import { listIntents } from "@/lib/services/advisor/admin";

export const instant = false;
export const metadata: Metadata = { title: "Advisor intents" };

export default async function AdvisorIntentsPage() {
  await requireAdmin("/admin/advisor/intents");
  const intents = await listIntents();

  return (
    <>
      <PageHeader
        title="Course advisor"
        description="Intents are the goals visitors express. Each one has keywords that recognise it, a reply, optional follow-up answers, and the courses to recommend."
        actions={<CreateIntentDialog />}
      />
      <AdvisorNav active="intents" />

      {intents.length === 0 ? (
        <EmptyState icon={Target} title="No intents yet" description="Create an intent for each goal visitors come with, like “build websites” or “sell on Amazon”." action={<CreateIntentDialog />} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Intent</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Keywords</th>
                <th className="px-4 py-3 font-medium">Courses</th>
                <th className="px-4 py-3 font-medium">Follow-up</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {intents.map((i) => (
                <tr key={i.id} className={i.is_active ? "" : "opacity-70"}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/advisor/intents/${i.id}`} className="font-medium hover:underline">
                      {i.title}
                    </Link>
                    <p className="font-mono text-xs text-muted-foreground">{i.intent_key}</p>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{i.priority}</td>
                  <td className="px-4 py-3 tabular-nums">{i.keywordCount === 0 ? <span className="text-warning">None</span> : i.keywordCount}</td>
                  <td className="px-4 py-3 tabular-nums">{i.courseCount}</td>
                  <td className="px-4 py-3">
                    {i.follow_up ? (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <GitBranch className="size-3.5" aria-hidden /> Yes
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={i.is_active ? "active" : "hidden"} label={i.is_active ? "Active" : "Disabled"} />
                  </td>
                  <td className="px-4 py-3">
                    <IntentActiveSwitch id={i.id} active={i.is_active} label={i.title} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6">
        <TestMessageBox />
      </div>
    </>
  );
}
