import Link from "next/link";
import { BookOpenCheck, Download } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ListToolbar } from "@/components/common/list-toolbar";
import { PaginationBar } from "@/components/common/pagination-bar";
import { StatusBadge } from "@/components/common/status-badge";
import { LocalTime } from "@/components/common/local-time";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ManualEnrollDialog } from "@/components/admin/enrollments/manual-enroll-dialog";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { escapeLike, parseListParams } from "@/lib/list-params";
import { daysAgoIso } from "@/lib/services/admin/metrics";

export const instant = false;
export const metadata = { title: "Enrollments" };

const SINCE: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 };

interface Row {
  id: string;
  user_id: string;
  course_id: string;
  status: string;
  source: string;
  enrolled_at: string;
  completed_at: string | null;
  progress_percent: number;
  profiles: { full_name: string } | { full_name: string }[] | null;
  courses: { title: string } | { title: string }[] | null;
}

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export default async function EnrollmentsPage({ searchParams }: PageProps<"/admin/enrollments">) {
  await requireAdmin("/admin/enrollments");
  const sp = await searchParams;
  const lp = parseListParams(sp, { filterKeys: ["course", "status", "source", "since"], pageSize: 25 });
  const supabase = await createClient();
  let q = supabase
    .from("enrollments")
    .select("id, user_id, course_id, status, source, enrolled_at, completed_at, progress_percent, profiles!inner(full_name), courses!inner(title)", { count: "exact" })
    .order("enrolled_at", { ascending: false })
    .range(lp.from, lp.to);
  if (lp.filters.course) q = q.eq("course_id", lp.filters.course);
  if (lp.filters.status) q = q.eq("status", lp.filters.status);
  if (lp.filters.source) q = q.eq("source", lp.filters.source);
  if (lp.filters.since && SINCE[lp.filters.since]) {
    q = q.gte("enrolled_at", daysAgoIso(SINCE[lp.filters.since]));
  }
  if (lp.q) q = q.ilike("profiles.full_name", `%${escapeLike(lp.q)}%`);
  const [res, courses] = await Promise.all([q, supabase.from("courses").select("id, title, status").order("title")]);
  if (res.error) throw new Error(res.error.message);
  const rows = (res.data ?? []) as unknown as Row[];
  const courseRows = (courses.data ?? []) as { id: string; title: string; status: string }[];
  const grantable = courseRows.filter((c) => ["published", "unpublished", "archived"].includes(c.status));

  return (
    <>
      <PageHeader
        title="Enrollments"
        description="Who is enrolled in what, and how far they've got."
        actions={
          <>
            <Button asChild variant="outline">
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download from a route handler, not a page */}
              <a href="/api/exports/enrollments">
                <Download /> Export CSV
              </a>
            </Button>
            <ManualEnrollDialog courses={grantable} />
          </>
        }
      />
      <ListToolbar
        searchPlaceholder="Search student name"
        filters={[
          { key: "course", label: "Courses", options: courseRows.map((c) => ({ value: c.id, label: c.title })) },
          {
            key: "status",
            label: "Statuses",
            options: ["active", "completed", "expired", "revoked", "archived"].map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) })),
          },
          {
            key: "source",
            label: "Sources",
            options: ["purchase", "subscription", "membership", "bundle", "free", "manual"].map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) })),
          },
          {
            key: "since",
            label: "Time",
            options: [
              { value: "7d", label: "Last 7 days" },
              { value: "30d", label: "Last 30 days" },
              { value: "90d", label: "Last 90 days" },
              { value: "365d", label: "Last 12 months" },
            ],
          },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState icon={BookOpenCheck} title="No enrollments match" description="Enrollments are created by purchases, free enrollments and manual grants." />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead className="max-md:hidden">Progress</TableHead>
                  <TableHead className="max-lg:hidden">Enrolled</TableHead>
                  <TableHead className="max-sm:hidden">Source</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Link href={`/admin/students/${e.user_id}`} className="font-medium hover:underline">
                        {one(e.profiles)?.full_name || "No name"}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-56 truncate">{one(e.courses)?.title}</TableCell>
                    <TableCell className="max-md:hidden">
                      <div className="flex w-32 items-center gap-2">
                        <Progress value={Number(e.progress_percent)} className="h-1.5" aria-label="Progress" />
                        <span className="text-xs tabular-nums text-muted-foreground">{Math.round(Number(e.progress_percent))}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-lg:hidden">
                      <LocalTime value={e.enrolled_at} format="date" />
                    </TableCell>
                    <TableCell className="capitalize max-sm:hidden">{e.source}</TableCell>
                    <TableCell>
                      <StatusBadge status={e.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationBar basePath="/admin/enrollments" searchParams={sp} page={lp.page} pageSize={lp.pageSize} total={res.count ?? 0} />
        </>
      )}
    </>
  );
}
