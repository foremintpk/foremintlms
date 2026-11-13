"use client";

import { useState } from "react";
import { Archive, CalendarCheck, CheckCircle2, Circle, Loader2, RotateCcw, Send, Star, StarOff, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmAction } from "@/components/common/confirm-action";
import { LocalTime } from "@/components/common/local-time";
import { StatusBadge } from "@/components/common/status-badge";
import { useAction } from "@/hooks/use-action";
import {
  approveCourse,
  changeCourseStatus,
  requestCourseChanges,
  setCourseFeatured,
  submitForReview,
  withdrawSubmission,
} from "@/lib/services/courses/actions/review";
import type { BuilderCourse } from "@/lib/services/courses/builder";
import { DateTimeField, FormRow } from "./form-bits";

interface Readiness {
  items: { key: string; label: string; done: boolean }[];
  ready: boolean;
  lessonCount: number;
}

function Checklist({ readiness }: { readiness: Readiness }) {
  return (
    <ul className="grid gap-2">
      {readiness.items.map((i) => (
        <li key={i.key} className="flex items-center gap-2 text-sm">
          {i.done ? <CheckCircle2 className="size-4 text-success" aria-label="Done" /> : <Circle className="size-4 text-muted-foreground/60" aria-label="Not done" />}
          <span className={i.done ? "" : "text-muted-foreground"}>{i.label}</span>
        </li>
      ))}
    </ul>
  );
}

const STATUS_COPY: Record<BuilderCourse["status"], string> = {
  draft: "Only instructors and administrators can see this course.",
  in_review: "Waiting for an administrator to review and publish it.",
  published: "Live. Students can find and enroll in this course.",
  unpublished: "Hidden from the catalogue. Enrolled students keep their access.",
  archived: "Archived. It no longer accepts enrollments; existing students keep their records.",
};

export function ReviewPanel({ course, readiness, isAdmin, canEdit }: { course: BuilderCourse; readiness: Readiness; isAdmin: boolean; canEdit: boolean }) {
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<"now" | "schedule">("now");
  const [publishAt, setPublishAt] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const submit = useAction(submitForReview);
  const approve = useAction(approveCourse);
  const changes = useAction(requestCourseChanges);
  const scheduled = course.status === "in_review" && course.scheduled_publish_at;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid content-start gap-6">
        <section className="grid gap-3 rounded-2xl border bg-card p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">Status</h2>
            <StatusBadge status={course.status} />
          </div>
          <p className="text-sm text-muted-foreground">{STATUS_COPY[course.status]}</p>
          {scheduled ? (
            <p className="text-sm">
              Approved — publishes <LocalTime value={course.scheduled_publish_at} format="weekday" />.
            </p>
          ) : null}
          {course.submitted_for_review_at && course.status === "in_review" ? (
            <p className="text-xs text-muted-foreground">
              Submitted <LocalTime value={course.submitted_for_review_at} format="relative" />
            </p>
          ) : null}
          {course.published_at ? (
            <p className="text-xs text-muted-foreground">
              First published <LocalTime value={course.published_at} format="date" />
            </p>
          ) : null}
          {course.review_notes ? (
            <div className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm">
              <p className="font-medium text-warning">Reviewer notes</p>
              <p className="mt-1 whitespace-pre-line text-foreground/90">{course.review_notes}</p>
            </div>
          ) : null}
        </section>

        <section className="grid gap-3 rounded-2xl border bg-card p-5">
          <h2 className="text-base font-semibold">Ready to publish?</h2>
          <Checklist readiness={readiness} />
        </section>
      </div>

      <aside className="grid content-start gap-4">
        {!isAdmin && canEdit && (course.status === "draft" || course.status === "unpublished") ? (
          <section className="grid gap-3 rounded-2xl border bg-card p-5">
            <h2 className="text-base font-semibold">Submit for review</h2>
            <p className="text-sm text-muted-foreground">An administrator checks the course before it goes live. You can keep editing while you wait.</p>
            <FormRow label="Note for the reviewer" optional>
              <Textarea rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
            </FormRow>
            <Button disabled={!readiness.ready || submit.pending} onClick={() => void submit.run({ courseId: course.id, note: note || null })}>
              {submit.pending ? <Loader2 className="animate-spin" /> : <Send />} Submit for review
            </Button>
            {!readiness.ready ? <p className="text-xs text-muted-foreground">Finish the checklist first.</p> : null}
          </section>
        ) : null}

        {canEdit && course.status === "in_review" ? (
          <ConfirmAction
            trigger={
              <Button variant="outline">
                <Undo2 /> Withdraw submission
              </Button>
            }
            title="Withdraw from review?"
            description={scheduled ? "This cancels the scheduled publication. You'll need to submit it again." : "The course returns to draft."}
            confirmLabel="Withdraw"
            action={() => withdrawSubmission({ courseId: course.id })}
          />
        ) : null}

        {isAdmin && course.status !== "archived" ? (
          <section className="grid gap-4 rounded-2xl border bg-card p-5">
            <h2 className="text-base font-semibold">{course.status === "published" ? "Publication" : "Approve and publish"}</h2>
            {course.status !== "published" ? (
              <>
                <RadioGroup value={mode} onValueChange={(v) => setMode(v as "now" | "schedule")} className="grid gap-2">
                  <Label className="flex items-center gap-2 text-sm font-normal">
                    <RadioGroupItem value="now" /> Publish now
                  </Label>
                  <Label className="flex items-center gap-2 text-sm font-normal">
                    <RadioGroupItem value="schedule" /> Schedule for later
                  </Label>
                </RadioGroup>
                {mode === "schedule" ? (
                  <FormRow label="Publish on" error={approve.fieldErrors.publishAt?.[0]}>
                    <DateTimeField value={publishAt} onChange={setPublishAt} />
                  </FormRow>
                ) : null}
                <FormRow label="Notes for the instructors" optional>
                  <Textarea rows={2} maxLength={2000} value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
                </FormRow>
                {!readiness.ready ? <p className="text-xs text-warning">Some checklist items are incomplete. You can still publish.</p> : null}
                <Button
                  disabled={approve.pending || (mode === "schedule" && !publishAt)}
                  onClick={() => void approve.run({ courseId: course.id, mode, publishAt: mode === "schedule" ? publishAt : null, notes: adminNotes || null })}
                >
                  {approve.pending ? <Loader2 className="animate-spin" /> : mode === "now" ? <CheckCircle2 /> : <CalendarCheck />}
                  {mode === "now" ? "Publish course" : "Schedule publication"}
                </Button>
                {course.status === "in_review" ? (
                  <div className="grid gap-2 border-t pt-4">
                    <FormRow label="Or send it back with changes">
                      <Textarea rows={3} maxLength={2000} value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="What needs to change before it can be published?" />
                    </FormRow>
                    <Button
                      variant="outline"
                      disabled={changes.pending || adminNotes.trim().length < 5}
                      onClick={() => void changes.run({ courseId: course.id, notes: adminNotes })}
                    >
                      {changes.pending ? <Loader2 className="animate-spin" /> : <Undo2 />} Request changes
                    </Button>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Unpublishing hides the course from the catalogue; enrolled students keep access.</p>
                <ConfirmAction
                  trigger={<Button variant="outline">Unpublish course</Button>}
                  title="Unpublish this course?"
                  description="It disappears from the catalogue and can't be bought. Enrolled students keep their access."
                  confirmLabel="Unpublish"
                  requireReason
                  action={({ reason }) => changeCourseStatus({ courseId: course.id, action: "unpublish", reason })}
                />
                <ConfirmAction
                  trigger={
                    <Button variant="ghost">
                      {course.is_featured ? <StarOff /> : <Star />} {course.is_featured ? "Remove from featured" : "Feature on the home page"}
                    </Button>
                  }
                  title={course.is_featured ? "Remove from featured courses?" : "Feature this course?"}
                  confirmLabel={course.is_featured ? "Remove" : "Feature course"}
                  action={() => setCourseFeatured({ courseId: course.id, featured: !course.is_featured })}
                />
              </>
            )}
          </section>
        ) : null}

        {isAdmin ? (
          course.status === "archived" ? (
            <ConfirmAction
              trigger={
                <Button variant="outline">
                  <RotateCcw /> Restore as draft
                </Button>
              }
              title="Restore this course?"
              description="It returns to draft so it can be edited and published again."
              confirmLabel="Restore course"
              action={() => changeCourseStatus({ courseId: course.id, action: "restore" })}
            />
          ) : (
            <ConfirmAction
              trigger={
                <Button variant="ghost" className="text-muted-foreground">
                  <Archive /> Archive course
                </Button>
              }
              title="Archive this course?"
              description="It stops accepting enrollments and leaves the catalogue. Students' progress, grades and certificates are kept."
              confirmLabel="Archive course"
              destructive
              requireReason
              action={({ reason }) => changeCourseStatus({ courseId: course.id, action: "archive", reason })}
            />
          )
        ) : null}
      </aside>
    </div>
  );
}
