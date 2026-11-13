import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ListToolbar } from "@/components/common/list-toolbar";
import { LocalTime } from "@/components/common/local-time";
import { PaginationBar } from "@/components/common/pagination-bar";
import { StatusBadge } from "@/components/common/status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireTeacher } from "@/lib/auth/guards";
import { initials } from "@/lib/format";
import { parseListParams } from "@/lib/list-params";
import { getTeacherCourses, listTeacherStudents } from "@/lib/services/teacher-analytics";

export const instant = false;
export const metadata = { title: "Students" };

export default async function TeachStudentsPage({ searchParams }: PageProps<"/teach/students">) {
  const user = await requireTeacher("/teach/students");
  const raw = await searchParams;
  const params = parseListParams(raw, { pageSize: 25, filterKeys: ["course", "status", "progress"] });
  const [courses, { rows, total }] = await Promise.all([
    getTeacherCourses(user.id),
    listTeacherStudents(user, {
      q: params.q,
      courseId: params.filters.course,
      status: params.filters.status,
      progress: params.filters.progress,
      from: params.from,
      to: params.to,
    }),
  ]);

  return (
    <>
      <PageHeader title="Students" description="Learners enrolled in the courses you teach." />
      <ListToolbar
        searchPlaceholder="Search by name or email"
        filters={[
          { key: "course", label: "Courses", options: courses.map((c) => ({ value: c.id, label: c.title })) },
          {
            key: "status",
            label: "Statuses",
            options: [
              { value: "active", label: "Active" },
              { value: "completed", label: "Completed" },
              { value: "expired", label: "Access expired" },
              { value: "revoked", label: "Access revoked" },
            ],
          },
          {
            key: "progress",
            label: "Progress",
            options: [
              { value: "not_started", label: "Not started" },
              { value: "in_progress", label: "In progress" },
              { value: "finished", label: "All lessons done" },
            ],
          },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title={params.q || Object.keys(params.filters).length ? "No students match these filters" : "No students yet"}
          description={
            params.q || Object.keys(params.filters).length
              ? "Try a different search or clear the filters."
              : "Students appear here as soon as they enroll in one of your courses."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead className="max-md:hidden">Course</TableHead>
                <TableHead className="w-40">Progress</TableHead>
                <TableHead className="max-sm:hidden">Status</TableHead>
                <TableHead className="text-right max-lg:hidden">Last active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.enrollment_id}>
                  <TableCell>
                    <Link href={`/teach/students/${r.user_id}`} className="flex items-center gap-3 hover:text-primary">
                      <Avatar className="size-8">
                        {r.avatar_url ? <AvatarImage src={r.avatar_url} alt="" /> : null}
                        <AvatarFallback className="bg-brand-soft text-xs text-primary">{initials(r.full_name)}</AvatarFallback>
                      </Avatar>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{r.full_name}</span>
                        {r.email ? <span className="block truncate text-xs text-muted-foreground">{r.email}</span> : null}
                        <span className="block truncate text-xs text-muted-foreground md:hidden">{r.course_title}</span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-56 truncate text-sm max-md:hidden">{r.course_title}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={r.progress_percent} className="h-1.5 [&>[data-slot=progress-indicator]]:bg-mint-strong" aria-label={`${r.progress_percent}% complete`} />
                      <span className="w-10 text-right text-xs tabular-nums">{Math.round(r.progress_percent)}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="max-sm:hidden">
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground max-lg:hidden">
                    {r.last_accessed_at ? <LocalTime value={r.last_accessed_at} format="relative" /> : "Not started"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <PaginationBar basePath="/teach/students" searchParams={raw} page={params.page} pageSize={params.pageSize} total={total} />
    </>
  );
}
