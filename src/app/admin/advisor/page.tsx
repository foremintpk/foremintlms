import type { Metadata } from "next";
import Link from "next/link";
import { Bot, CircleHelp, MessageSquareText, MessagesSquare, ShoppingBag, Sparkles, Wallet } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatCard } from "@/components/common/stat-card";
import { EmptyState } from "@/components/common/empty-state";
import { LocalTime } from "@/components/common/local-time";
import { AdvisorNav } from "@/components/admin/advisor/advisor-nav";
import { requireAdmin } from "@/lib/auth/guards";
import { formatMinor } from "@/lib/domain/invoicing";
import { formatNumber } from "@/lib/format";
import { getAdvisorAnalytics, getAdvisorAdminSettings, intentTitles } from "@/lib/services/advisor/admin";
import { getSelectorSettings } from "@/lib/services/commerce/settings";
import { cn } from "@/lib/utils";

export const instant = false;
export const metadata: Metadata = { title: "Course advisor" };

const RANGES = [7, 30, 90] as const;

function RankedList({ title, rows, empty }: { title: string; rows: { label: string; count: number }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-card">
      <h2 className="text-base font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ol className="mt-4 grid gap-3">
          {rows.map((r) => (
            <li key={r.label} className="grid gap-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{r.label}</span>
                <span className="tabular-nums text-muted-foreground">{formatNumber(r.count)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (r.count / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default async function AdvisorOverviewPage({ searchParams }: PageProps<"/admin/advisor">) {
  await requireAdmin("/admin/advisor");
  const params = await searchParams;
  const daysParam = Number(typeof params.days === "string" ? params.days : 30);
  const days = (RANGES as readonly number[]).includes(daysParam) ? daysParam : 30;
  const [stats, titles, selector, settings] = await Promise.all([getAdvisorAnalytics(days), intentTitles(), getSelectorSettings(), getAdvisorAdminSettings()]);
  const fallbackRate = stats.questions ? Math.round((stats.fallbacks / stats.questions) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Course advisor"
        description="A rule-based assistant (no AI) that recommends courses from your intents, keywords and FAQs, and uses the same cart and checkout as the website."
      />
      <AdvisorNav active="overview" />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {settings.config.enabled ? "The advisor is live on every public page." : "The advisor is switched off."}{" "}
          <Link href="/admin/advisor/settings" className="font-medium text-primary hover:underline">
            Behaviour settings
          </Link>
        </p>
        <nav aria-label="Date range" className="inline-flex rounded-xl bg-muted p-1">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/admin/advisor?days=${r}`}
              aria-current={r === days ? "page" : undefined}
              className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", r === days ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground")}
            >
              Last {r} days
            </Link>
          ))}
        </nav>
      </div>

      {stats.sessions === 0 && stats.questions === 0 ? (
        <EmptyState
          icon={Bot}
          title="No conversations yet"
          description={`Nobody has used the advisor in the last ${days} days. Analytics appear here as soon as visitors start chatting.`}
          action={
            <Link href="/admin/advisor/intents" className="text-sm font-semibold text-primary hover:underline">
              Review intents and test messages
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard label="Conversations" value={formatNumber(stats.sessions)} icon={MessagesSquare} tone="brand" href="/admin/advisor/conversations" />
            <StatCard label="Questions asked" value={formatNumber(stats.questions)} icon={MessageSquareText} hint={`${formatNumber(stats.faq_answers)} answered from FAQs`} />
            <StatCard
              label="Fallback rate"
              value={`${fallbackRate}%`}
              icon={CircleHelp}
              tone={fallbackRate > 30 ? "warning" : "default"}
              hint={`${formatNumber(stats.fallbacks)} messages no rule could answer`}
            />
            <StatCard label="Orders started via the advisor" value={formatNumber(stats.orders)} icon={ShoppingBag} href="/admin/orders" />
            <StatCard label="Paid orders from the advisor" value={formatNumber(stats.paid_orders)} icon={Sparkles} tone="success" />
            <StatCard label="Paid through the advisor" value={formatMinor(stats.paid_total_minor, selector.currency)} icon={Wallet} hint="Excludes fully refunded orders" />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <RankedList title="Most matched intents" rows={stats.top_intents.map((i) => ({ label: titles.get(i.key) ?? i.key, count: i.count }))} empty="No intents matched yet." />
            <RankedList title="Most recommended courses" rows={stats.recommended_courses.map((c) => ({ label: c.title, count: c.count }))} empty="No courses recommended yet." />
            <RankedList title="Most added to the cart" rows={stats.selected_courses.map((c) => ({ label: c.title, count: c.count }))} empty="No courses added from the chat yet." />
          </div>

          <section className="mt-6 rounded-2xl border bg-card shadow-card">
            <div className="border-b p-5">
              <h2 className="text-base font-semibold">Common unanswered questions</h2>
              <p className="mt-1 text-sm text-muted-foreground">Messages that fell back. Add keywords to an intent, a synonym, or an FAQ so they&apos;re answered next time. Emails and numbers are redacted before logging.</p>
            </div>
            {stats.unanswered.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">Nothing unanswered in this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-5 py-2.5 font-medium">Question</th>
                      <th className="px-5 py-2.5 font-medium">Times asked</th>
                      <th className="px-5 py-2.5 font-medium">Last asked</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {stats.unanswered.map((u) => (
                      <tr key={u.question}>
                        <td className="px-5 py-3">{u.question}</td>
                        <td className="px-5 py-3 tabular-nums">{formatNumber(u.count)}</td>
                        <td className="px-5 py-3 text-muted-foreground">
                          <LocalTime value={u.last_asked} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
