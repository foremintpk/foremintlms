import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { LocalTime } from "@/components/common/local-time";
import { StatusBadge } from "@/components/common/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/auth/guards";
import { getLearnerCourses, getPendingAssignments } from "@/lib/services/learner";

export const instant = false;

export const metadata: Metadata = { title: "Assignments" };

const LABEL: Record<string, string> = {
  not_started: "To do",
  overdue: "Overdue",
  submitted: "Submitted",
  under_review: "In review",
  resubmission_requested: "Resubmit",
  graded: "Graded",
  approved: "Approved",
};

export default function AssignmentsPage() {
  return (
    <>
      <PageHeader title="Assignments" description="Practical work across all your courses, sorted by due date." />
      <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
        <AssignmentList />
      </Suspense>
    </>
  );
}

async function AssignmentList() {
  const user = await requireUser("/learn/assignments");
  const { cards } = await getLearnerCourses(user);
  const items = await getPendingAssignments(user.id, cards, 500);
  if (items.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No assignments yet"
        description="Assignments from your courses appear here with their due dates and grades."
      />
    );
  }
  const order = ["overdue", "resubmission_requested", "not_started", "submitted", "under_review", "graded", "approved"];
  const sorted = [...items].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || (a.dueAt ?? "9").localeCompare(b.dueAt ?? "9"));
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Assignment</TableHead>
            <TableHead className="max-md:hidden">Course</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="max-w-64">
                <Link href={`/learn/courses/${a.courseSlug}/assignments/${a.id}`} className="font-medium hover:text-primary hover:underline">
                  {a.title}
                </Link>
                <span className="block text-xs text-muted-foreground md:hidden">{a.courseTitle}</span>
              </TableCell>
              <TableCell className="text-muted-foreground max-md:hidden">{a.courseTitle}</TableCell>
              <TableCell className="whitespace-nowrap">{a.dueAt ? <LocalTime value={a.dueAt} format="date" /> : "—"}</TableCell>
              <TableCell>
                <StatusBadge status={a.status === "not_started" ? "pending" : a.status} label={LABEL[a.status]} tone={a.status === "overdue" ? "danger" : undefined} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
