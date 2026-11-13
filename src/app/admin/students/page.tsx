import Link from "next/link";
import { Download, GraduationCap } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ListToolbar } from "@/components/common/list-toolbar";
import { PaginationBar } from "@/components/common/pagination-bar";
import { StatusBadge } from "@/components/common/status-badge";
import { LocalTime } from "@/components/common/local-time";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth/guards";
import { parseListParams } from "@/lib/list-params";
import { initials } from "@/lib/format";
import { searchUsers } from "@/lib/services/admin/users";

export const instant = false;
export const metadata = { title: "Students" };

const SORTS = ["created_desc", "created_asc", "name_asc", "last_sign_in_desc"] as const;

export default async function StudentsPage({ searchParams }: PageProps<"/admin/students">) {
  await requireAdmin("/admin/students");
  const sp = await searchParams;
  const lp = parseListParams(sp, { filterKeys: ["status", "sort"], pageSize: 25 });
  const sort = (SORTS as readonly string[]).includes(lp.filters.sort ?? "") ? (lp.filters.sort as (typeof SORTS)[number]) : "created_desc";
  const { rows, total } = await searchUsers({
    role: "student",
    q: lp.q,
    status: lp.filters.status ?? null,
    sort,
    limit: lp.pageSize,
    offset: lp.from,
  });

  return (
    <>
      <PageHeader
        title="Students"
        description="Everyone with a student account, including instructors who also learn."
        actions={
          <Button asChild variant="outline">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download from a route handler, not a page */}
            <a href="/api/exports/students">
              <Download /> Export CSV
            </a>
          </Button>
        }
      />
      <ListToolbar
        searchPlaceholder="Search name, email or ID"
        filters={[
          {
            key: "status",
            label: "Accounts",
            options: [
              { value: "active", label: "Active" },
              { value: "suspended", label: "Suspended" },
              { value: "deletion_requested", label: "Deletion requested" },
            ],
          },
          {
            key: "sort",
            label: "Sort order",
            options: [
              { value: "created_asc", label: "Oldest first" },
              { value: "name_asc", label: "Name A–Z" },
              { value: "last_sign_in_desc", label: "Recently active" },
            ],
          },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState icon={GraduationCap} title={lp.q || lp.filters.status ? "No students match" : "No students yet"} description="Students appear here once they register." />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead className="max-sm:hidden">Enrollments</TableHead>
                  <TableHead className="max-md:hidden">Joined</TableHead>
                  <TableHead className="max-lg:hidden">Last sign-in</TableHead>
                  <TableHead>Account</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link href={`/admin/students/${s.id}`} className="flex items-center gap-3">
                        <Avatar className="size-8 max-sm:hidden">
                          {s.avatar_url ? <AvatarImage src={s.avatar_url} alt="" /> : null}
                          <AvatarFallback className="bg-brand-soft text-xs text-primary">{initials(s.full_name || s.email)}</AvatarFallback>
                        </Avatar>
                        <span className="min-w-0">
                          <span className="block truncate font-medium hover:underline">{s.full_name || "No name"}</span>
                          <span className="block truncate text-xs text-muted-foreground">{s.email}</span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums max-sm:hidden">{s.enrollments_count}</TableCell>
                    <TableCell className="max-md:hidden">
                      <LocalTime value={s.created_at} format="date" />
                    </TableCell>
                    <TableCell className="max-lg:hidden">{s.last_sign_in_at ? <LocalTime value={s.last_sign_in_at} format="relative" /> : "Never"}</TableCell>
                    <TableCell>
                      <StatusBadge status={s.status} />
                      {s.deletion_requested_at ? <StatusBadge status="pending" label="Deletion requested" className="ml-1" /> : null}
                      {s.roles.includes("teacher") ? <span className="ml-2 text-xs text-muted-foreground">Instructor</span> : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationBar basePath="/admin/students" searchParams={sp} page={lp.page} pageSize={lp.pageSize} total={total} />
        </>
      )}
    </>
  );
}
