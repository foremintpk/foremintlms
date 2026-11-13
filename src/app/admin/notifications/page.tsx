import { Megaphone } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { LocalTime } from "@/components/common/local-time";
import { PaginationBar } from "@/components/common/pagination-bar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AnnouncementDialog, AnnouncementRowActions, type AnnouncementRow } from "@/components/admin/announcements/announcement-form";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { parseListParams } from "@/lib/list-params";

export const instant = false;
export const metadata = { title: "Announcements" };

const AUDIENCE: Record<string, string> = { all: "Everyone", students: "All students", teachers: "All instructors", course: "Course learners" };

export default async function AnnouncementsPage({ searchParams }: PageProps<"/admin/notifications">) {
  await requireAdmin("/admin/notifications");
  const sp = await searchParams;
  const lp = parseListParams(sp, { pageSize: 20 });
  const supabase = await createClient();
  const [res, courses] = await Promise.all([
    supabase
      .from("announcements")
      .select("id, title, body, audience, course_id, send_email, published_at, created_at, courses(title)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(lp.from, lp.to),
    supabase.from("courses").select("id, title").in("status", ["published", "unpublished"]).order("title"),
  ]);
  if (res.error) throw new Error(res.error.message);
  const nowIso = new Date().toISOString();
  const rows: AnnouncementRow[] = ((res.data ?? []) as unknown as (Omit<AnnouncementRow, "course_title" | "state"> & {
    courses: { title: string } | { title: string }[] | null;
  })[]).map((r) => ({
    ...r,
    course_title: Array.isArray(r.courses) ? (r.courses[0]?.title ?? null) : (r.courses?.title ?? null),
    state: !r.published_at ? "draft" : r.published_at > nowIso ? "scheduled" : "published",
  }));
  const courseOptions = (courses.data ?? []) as { id: string; title: string }[];

  return (
    <>
      <PageHeader
        title="Announcements"
        description="Messages shown on learner and instructor dashboards, with optional email."
        actions={<AnnouncementDialog courses={courseOptions} />}
      />
      {rows.length === 0 ? (
        <EmptyState icon={Megaphone} title="No announcements yet" description="Share news, schedule changes or new courses with your learners." action={<AnnouncementDialog courses={courseOptions} />} />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Announcement</TableHead>
                  <TableHead className="max-sm:hidden">Audience</TableHead>
                  <TableHead className="max-md:hidden">Goes live</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="max-w-sm">
                      <p className="truncate font-medium">{a.title}</p>
                      <p className="line-clamp-1 text-xs text-muted-foreground">{a.body}</p>
                    </TableCell>
                    <TableCell className="max-sm:hidden">
                      {a.audience === "course" ? a.course_title ?? "Course" : AUDIENCE[a.audience]}
                      {a.send_email ? <span className="block text-xs text-muted-foreground">+ email</span> : null}
                    </TableCell>
                    <TableCell className="max-md:hidden">{a.published_at ? <LocalTime value={a.published_at} /> : "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={a.state} />
                    </TableCell>
                    <TableCell>
                      <AnnouncementRowActions announcement={a} courses={courseOptions} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationBar basePath="/admin/notifications" searchParams={sp} page={lp.page} pageSize={lp.pageSize} total={res.count ?? 0} />
        </>
      )}
    </>
  );
}
