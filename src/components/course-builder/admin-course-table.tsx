"use client";

import Link from "next/link";
import { useState } from "react";
import { Archive, BookOpen, EyeOff, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmAction } from "@/components/common/confirm-action";
import { EmptyState } from "@/components/common/empty-state";
import { LocalTime } from "@/components/common/local-time";
import { StatusBadge } from "@/components/common/status-badge";
import { bulkChangeCourseStatus } from "@/lib/services/courses/actions/review";
import type { CourseListRow } from "@/lib/services/courses/lists";

export function AdminCourseTable({ rows, reviewTab }: { rows: CourseListRow[]; reviewTab: boolean }) {
  const [selected, setSelected] = useState<string[]>([]);
  const allSelected = rows.length > 0 && selected.length === rows.length;

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title={reviewTab ? "Nothing waiting for review" : "No courses match"}
        description={reviewTab ? "Courses instructors submit for publication appear here." : "Try a different search or filter, or create a course."}
      />
    );
  }

  return (
    <div className="grid gap-3">
      {selected.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-brand-soft/50 px-3 py-2 text-sm">
          <span className="font-medium">{selected.length} selected</span>
          <div className="ml-auto flex gap-2">
            <ConfirmAction
              trigger={
                <Button size="sm" variant="outline">
                  <EyeOff /> Unpublish
                </Button>
              }
              title={`Unpublish ${selected.length} course${selected.length === 1 ? "" : "s"}?`}
              description="Only published or in-review courses change. Enrolled students keep access."
              confirmLabel="Unpublish"
              action={() => bulkChangeCourseStatus({ courseIds: selected, action: "unpublish" })}
              onDone={() => setSelected([])}
            />
            <ConfirmAction
              trigger={
                <Button size="sm" variant="outline">
                  <Archive /> Archive
                </Button>
              }
              title={`Archive ${selected.length} course${selected.length === 1 ? "" : "s"}?`}
              description="They stop accepting enrollments. Student records are kept."
              confirmLabel="Archive"
              destructive
              action={() => bulkChangeCourseStatus({ courseIds: selected, action: "archive" })}
              onDone={() => setSelected([])}
            />
          </div>
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  aria-label="Select all courses on this page"
                  onCheckedChange={(v) => setSelected(v === true ? rows.map((r) => r.id) : [])}
                />
              </TableHead>
              <TableHead>Course</TableHead>
              <TableHead className="max-md:hidden">Instructors</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right max-sm:hidden">Lessons</TableHead>
              <TableHead className="text-right max-sm:hidden">Students</TableHead>
              <TableHead className="max-lg:hidden">{reviewTab ? "Submitted" : "Updated"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} data-state={selected.includes(r.id) ? "selected" : undefined}>
                <TableCell>
                  <Checkbox
                    checked={selected.includes(r.id)}
                    aria-label={`Select ${r.title}`}
                    onCheckedChange={(v) => setSelected((s) => (v === true ? [...s, r.id] : s.filter((x) => x !== r.id)))}
                  />
                </TableCell>
                <TableCell className="min-w-56">
                  <Link href={`/admin/courses/${r.id}${reviewTab ? "/review" : ""}`} className="flex items-center gap-3">
                    <span className="relative hidden aspect-video w-16 shrink-0 overflow-hidden rounded-md bg-muted sm:block">
                      {r.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- small admin thumbnail
                        <img src={r.thumbnail_url} alt="" className="size-full object-cover" />
                      ) : null}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 font-medium hover:text-primary">
                        <span className="truncate">{r.title}</span>
                        {r.is_featured ? <Star className="size-3.5 shrink-0 fill-warning text-warning" aria-label="Featured" /> : null}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{r.category_name ?? "No category"}</span>
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="max-w-48 truncate text-sm text-muted-foreground max-md:hidden">{r.instructors.join(", ") || "—"}</TableCell>
                <TableCell>
                  <StatusBadge status={r.status} label={r.status === "in_review" && r.scheduled_publish_at ? "Scheduled" : undefined} />
                </TableCell>
                <TableCell className="text-right tabular-nums max-sm:hidden">{r.lesson_count}</TableCell>
                <TableCell className="text-right tabular-nums max-sm:hidden">{r.enrollment_count}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-lg:hidden">
                  <LocalTime value={reviewTab ? r.submitted_for_review_at : r.updated_at} format="relative" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
