import Link from "next/link";
import { Flag, MessagesSquare, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ListToolbar } from "@/components/common/list-toolbar";
import { LocalTime } from "@/components/common/local-time";
import { PaginationBar } from "@/components/common/pagination-bar";
import { StatusBadge } from "@/components/common/status-badge";
import { DiscussionModerationButtons, ReportDecisionButtons } from "@/components/communication/moderation/controls";
import { PersonAvatar } from "@/components/communication/person";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth/guards";
import { parseListParams } from "@/lib/list-params";
import { cn } from "@/lib/utils";
import { listAllDiscussions, listReports, openReportCount, type ReportStatus } from "@/lib/services/moderation";

export const instant = false;
export const metadata = { title: "Discussions & reports" };

const REASON_LABEL: Record<string, string> = {
  spam: "Spam",
  harassment: "Harassment",
  inappropriate: "Inappropriate",
  off_topic: "Off topic",
  other: "Other",
};

export default async function AdminDiscussionsPage({ searchParams }: PageProps<"/admin/discussions">) {
  await requireAdmin("/admin/discussions");
  const sp = await searchParams;
  const tab = (Array.isArray(sp.tab) ? sp.tab[0] : sp.tab) === "all" ? "all" : "reports";
  const openCount = await openReportCount();

  const tabs = (
    <nav className="mb-5 flex gap-1 border-b" aria-label="Moderation views">
      {[
        { key: "reports", label: "Reports", count: openCount },
        { key: "all", label: "All discussions" },
      ].map((t) => (
        <Link
          key={t.key}
          href={`/admin/discussions${t.key === "all" ? "?tab=all" : ""}`}
          aria-current={tab === t.key ? "page" : undefined}
          className={cn(
            "-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            tab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
          {t.count ? <span className="rounded-full bg-primary/10 px-1.5 text-xs text-primary tabular-nums">{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );

  if (tab === "reports") {
    const lp = parseListParams(sp, { pageSize: 15, filterKeys: ["status"] });
    const status = (["open", "dismissed", "actioned", "all"].includes(lp.filters.status ?? "") ? lp.filters.status : "open") as ReportStatus | "all";
    const { items, total } = await listReports({ status, from: lp.from, to: lp.to });
    return (
      <>
        <PageHeader title="Discussions & reports" description="Review reported posts, replies, messages and reviews, and moderate course discussions." />
        {tabs}
        <ListToolbar
          filters={[
            {
              key: "status",
              label: "Reports",
              options: [
                { value: "open", label: "Open" },
                { value: "actioned", label: "Actioned" },
                { value: "dismissed", label: "Dismissed" },
                { value: "all", label: "Everything" },
              ],
            },
          ]}
        />
        {items.length === 0 ? (
          <EmptyState
            icon={status === "open" ? ShieldCheck : Flag}
            title={status === "open" ? "No open reports" : "No reports here"}
            description={status === "open" ? "When someone reports content, it appears here for review." : "Try another filter."}
          />
        ) : (
          <ul className="space-y-4">
            {items.map((r) => (
              <li key={r.id} className="rounded-2xl border bg-card p-4 shadow-card sm:p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <StatusBadge status={r.status} />
                  <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground capitalize">{r.targetType}</span>
                  <span className="font-medium text-destructive">{REASON_LABEL[r.reason] ?? r.reason}</span>
                  {r.course ? <span>· {r.course.title}</span> : null}
                  <span className="ml-auto">
                    Reported <LocalTime value={r.createdAt} format="relative" />
                    {r.reporter ? ` by ${r.reporter.name}` : ""}
                  </span>
                </div>
                {r.details ? <p className="mt-2 text-sm text-muted-foreground">“{r.details}”</p> : null}
                <div className="mt-3 rounded-xl border bg-muted/30 p-3">
                  {r.target.exists ? (
                    <>
                      <div className="flex items-center gap-2 text-sm">
                        {r.target.author ? <PersonAvatar person={r.target.author} className="size-6" /> : null}
                        <span className="font-medium">{r.target.author?.name ?? "Unknown author"}</span>
                        {r.target.status && r.target.status !== "visible" && r.target.status !== "published" ? <StatusBadge status={r.target.status} /> : null}
                      </div>
                      {r.target.title ? <p className="mt-2 font-medium">{r.target.title}</p> : null}
                      <p className="mt-1 text-sm whitespace-pre-line">{r.target.excerpt || "(empty)"}</p>
                      {r.target.href ? (
                        <Link href={r.target.href} className="mt-2 inline-block text-sm font-medium text-primary hover:underline">
                          View in context
                        </Link>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">The reported content has already been deleted.</p>
                  )}
                </div>
                {r.status === "open" ? (
                  <div className="mt-3">
                    <ReportDecisionButtons reportId={r.id} targetExists={r.target.exists} targetType={r.targetType} />
                  </div>
                ) : r.reviewer ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {r.status === "dismissed" ? "Dismissed" : "Actioned"} by {r.reviewer.name}
                    {r.reviewedAt ? (
                      <>
                        {" "}
                        <LocalTime value={r.reviewedAt} format="relative" />
                      </>
                    ) : null}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <PaginationBar basePath="/admin/discussions" searchParams={sp} page={lp.page} pageSize={lp.pageSize} total={total} />
      </>
    );
  }

  const lp = parseListParams(sp, { pageSize: 25, filterKeys: ["status", "course"] });
  const { items, total, courses } = await listAllDiscussions({ q: lp.q, status: lp.filters.status, course: lp.filters.course, from: lp.from, to: lp.to });

  return (
    <>
      <PageHeader title="Discussions & reports" description="Review reported posts, replies, messages and reviews, and moderate course discussions." />
      {tabs}
      <ListToolbar
        searchPlaceholder="Search titles"
        filters={[
          {
            key: "status",
            label: "Statuses",
            options: [
              { value: "visible", label: "Visible" },
              { value: "hidden", label: "Hidden" },
              { value: "removed", label: "Removed" },
            ],
          },
          { key: "course", label: "Courses", options: courses.map((c) => ({ value: c.id, label: c.title })) },
        ]}
      />
      {items.length === 0 ? (
        <EmptyState icon={MessagesSquare} title="No discussions match" description="Course discussions appear here as students start them." />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Discussion</TableHead>
                <TableHead className="max-md:hidden">Course</TableHead>
                <TableHead className="max-sm:hidden">Status</TableHead>
                <TableHead className="text-right max-sm:hidden">Replies</TableHead>
                <TableHead className="text-right max-lg:hidden">Last activity</TableHead>
                <TableHead className="w-20 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="max-w-96">
                    {d.course && d.status !== "removed" ? (
                      <Link href={`/learn/courses/${d.course.slug}/discussions/${d.id}`} className="block truncate font-medium hover:underline">
                        {d.title}
                      </Link>
                    ) : (
                      <span className="block truncate font-medium">{d.title}</span>
                    )}
                    <span className="block text-xs text-muted-foreground">
                      {d.author.name} · {d.kind}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-56 truncate text-sm max-md:hidden">{d.course?.title ?? "—"}</TableCell>
                  <TableCell className="max-sm:hidden">
                    <StatusBadge status={d.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums max-sm:hidden">{d.replyCount}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground max-lg:hidden">
                    <LocalTime value={d.lastActivityAt} format="relative" />
                  </TableCell>
                  <TableCell className="text-right">
                    <DiscussionModerationButtons discussionId={d.id} status={d.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <PaginationBar basePath="/admin/discussions" searchParams={{ ...sp, tab: "all" }} page={lp.page} pageSize={lp.pageSize} total={total} />
    </>
  );
}
