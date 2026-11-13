import Link from "next/link";
import { Route } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NewProgramDialog } from "@/components/admin/programs/program-editor";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

export const instant = false;
export const metadata = { title: "Learning programs" };

interface ProgramRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  level: string;
  is_featured: boolean;
  updated_at: string;
  learning_path_courses: { course_id: string }[];
}

export default async function ProgramsPage() {
  await requireAdmin("/admin/programs");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("learning_paths")
    .select("id, title, slug, status, level, is_featured, updated_at, learning_path_courses(course_id)")
    .order("sort_order")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const programs = (data ?? []) as ProgramRow[];

  return (
    <>
      <PageHeader
        title="Learning programs"
        description="Ordered sequences of courses that lead to a bigger outcome, shown on the Programs page."
        actions={<NewProgramDialog />}
      />
      {programs.length === 0 ? (
        <EmptyState
          icon={Route}
          title="No programs yet"
          description="Create a program, then add courses in the order learners should take them."
          action={<NewProgramDialog />}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Program</TableHead>
                <TableHead className="max-sm:hidden">Courses</TableHead>
                <TableHead className="max-md:hidden">Level</TableHead>
                <TableHead className="max-md:hidden">Updated</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {programs.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link href={`/admin/programs/${p.id}`} className="font-medium hover:underline">
                      {p.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      /programs/{p.slug}
                      {p.is_featured ? " · Featured" : ""}
                    </p>
                  </TableCell>
                  <TableCell className="tabular-nums max-sm:hidden">{p.learning_path_courses.length}</TableCell>
                  <TableCell className="capitalize max-md:hidden">{p.level.replace("_", " ")}</TableCell>
                  <TableCell className="max-md:hidden">{formatDate(p.updated_at)}</TableCell>
                  <TableCell>
                    <StatusBadge status={p.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
