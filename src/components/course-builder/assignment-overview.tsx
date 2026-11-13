"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, PenLine, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ConfirmAction } from "@/components/common/confirm-action";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { LocalTime } from "@/components/common/local-time";
import { useAction } from "@/hooks/use-action";
import { createAssignment, deleteAssignment } from "@/lib/services/courses/actions/assignments";
import type { AssignmentListItem } from "@/lib/services/courses/authoring";
import { FormRow } from "./form-bits";

export function AssignmentOverview({
  courseId,
  courseBase,
  assignments,
  canEdit,
  reviewHref,
}: {
  courseId: string;
  courseBase: string;
  assignments: AssignmentListItem[];
  canEdit: boolean;
  reviewHref: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const create = useAction(createAssignment, { onSuccess: (d) => router.push(`${courseBase}/assignments/${d.id}`) });

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Practical tasks students submit for review. Add one to a lesson with an Assignment block.</p>
        {canEdit ? (
          <Button onClick={() => setOpen(true)}>
            <Plus /> New assignment
          </Button>
        ) : null}
      </div>
      {assignments.length === 0 ? (
        <EmptyState icon={PenLine} title="No assignments yet" description="Assignments let students practise and get written feedback with a grade." />
      ) : (
        <ul className="grid gap-2">
          {assignments.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3">
              <div className="min-w-0 flex-1">
                <Link href={`${courseBase}/assignments/${a.id}`} className="font-medium hover:text-primary">
                  {a.title}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {a.max_points} points ·{" "}
                  {a.due_at ? (
                    <>
                      due <LocalTime value={a.due_at} format="date" />
                    </>
                  ) : a.due_days_after_enrollment ? (
                    `due ${a.due_days_after_enrollment} days after enrolling`
                  ) : (
                    "no deadline"
                  )}
                  {a.lesson_title ? ` · ${a.lesson_title}` : ""} · {a.submission_count} submission{a.submission_count === 1 ? "" : "s"}
                </p>
              </div>
              {a.pending_count > 0 && reviewHref ? (
                <Link href={reviewHref} className="text-xs font-medium text-primary hover:underline">
                  {a.pending_count} to review
                </Link>
              ) : null}
              <StatusBadge status={a.status} />
              <Button asChild variant="ghost" size="sm">
                <Link href={`${courseBase}/assignments/${a.id}`}>
                  <Pencil /> {canEdit ? "Edit" : "View"}
                </Link>
              </Button>
              {canEdit ? (
                <ConfirmAction
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label={`Delete ${a.title}`} className="text-muted-foreground hover:text-destructive">
                      <Trash2 />
                    </Button>
                  }
                  title={`Delete “${a.title}”?`}
                  description={a.submission_count ? "Students have submitted work, so it will be archived and their submissions kept." : "The assignment is deleted."}
                  confirmLabel={a.submission_count ? "Archive assignment" : "Delete assignment"}
                  destructive
                  action={() => deleteAssignment({ courseId, assignmentId: a.id })}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form
            className="grid gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              void create.run({ courseId, title });
            }}
          >
            <DialogHeader>
              <DialogTitle>New assignment</DialogTitle>
              <DialogDescription>You’ll write instructions and grading details next.</DialogDescription>
            </DialogHeader>
            <FormRow label="Assignment title">
              <Input value={title} maxLength={200} autoFocus onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Draft your first product listing" />
            </FormRow>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!title.trim() || create.pending}>
                {create.pending ? <Loader2 className="animate-spin" /> : null}
                Create assignment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
