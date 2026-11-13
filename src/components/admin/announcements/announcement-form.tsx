"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmAction } from "@/components/common/confirm-action";
import { useAction } from "@/hooks/use-action";
import { deleteAnnouncement, saveAnnouncement, unpublishAnnouncement } from "@/app/admin/notifications/actions";

export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  audience: "all" | "students" | "teachers" | "course";
  course_id: string | null;
  course_title: string | null;
  send_email: boolean;
  published_at: string | null;
  created_at: string;
  state: "draft" | "scheduled" | "published";
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AnnouncementDialog({
  courses,
  announcement,
  trigger,
}: {
  courses: { id: string; title: string }[];
  announcement?: AnnouncementRow;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState<AnnouncementRow["audience"]>(announcement?.audience ?? "students");
  const [courseId, setCourseId] = useState(announcement?.course_id ?? "");
  const [mode, setMode] = useState<"draft" | "now" | "schedule">(announcement?.state === "scheduled" ? "schedule" : "now");
  const [publishAt, setPublishAt] = useState(announcement?.state === "scheduled" ? toLocalInput(announcement.published_at) : "");
  const [sendEmail, setSendEmail] = useState(announcement?.send_email ?? false);
  const { run, pending, fieldErrors } = useAction(saveAnnouncement, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus /> New announcement
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{announcement ? "Edit announcement" : "New announcement"}</DialogTitle>
          <DialogDescription>Shown on dashboards for the chosen audience.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run({
              id: announcement?.id,
              title: String(f.get("title") ?? ""),
              body: String(f.get("body") ?? ""),
              audience,
              course_id: audience === "course" ? courseId : "",
              mode,
              publish_at: publishAt ? new Date(publishAt).toISOString() : "",
              send_email: sendEmail,
            });
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="ann-title">Title</FieldLabel>
              <Input id="ann-title" name="title" defaultValue={announcement?.title} required maxLength={200} />
              <FieldError>{fieldErrors.title?.[0]}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="ann-body">Message</FieldLabel>
              <Textarea id="ann-body" name="body" rows={6} defaultValue={announcement?.body} required maxLength={5000} />
              <FieldError>{fieldErrors.body?.[0]}</FieldError>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="ann-audience">Audience</FieldLabel>
                <Select value={audience} onValueChange={(v) => setAudience(v as AnnouncementRow["audience"])}>
                  <SelectTrigger id="ann-audience">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Everyone</SelectItem>
                    <SelectItem value="students">All students</SelectItem>
                    <SelectItem value="teachers">All instructors</SelectItem>
                    <SelectItem value="course">Learners in one course</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {audience === "course" ? (
                <Field>
                  <FieldLabel htmlFor="ann-course">Course</FieldLabel>
                  <Select value={courseId} onValueChange={setCourseId}>
                    <SelectTrigger id="ann-course">
                      <SelectValue placeholder="Choose a course" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError>{fieldErrors.course_id?.[0]}</FieldError>
                </Field>
              ) : null}
            </div>
            <FieldSet>
              <FieldLegend variant="label">When</FieldLegend>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as typeof mode)} className="gap-2">
                <Field orientation="horizontal">
                  <RadioGroupItem value="now" id="ann-now" />
                  <FieldLabel htmlFor="ann-now" className="font-normal">
                    Publish now — also adds a notification to everyone’s bell
                  </FieldLabel>
                </Field>
                <Field orientation="horizontal">
                  <RadioGroupItem value="schedule" id="ann-schedule" />
                  <FieldLabel htmlFor="ann-schedule" className="font-normal">
                    Schedule for later
                  </FieldLabel>
                </Field>
                <Field orientation="horizontal">
                  <RadioGroupItem value="draft" id="ann-draft" />
                  <FieldLabel htmlFor="ann-draft" className="font-normal">
                    Save as draft
                  </FieldLabel>
                </Field>
              </RadioGroup>
              {mode === "schedule" ? (
                <Field>
                  <FieldLabel htmlFor="ann-at">Publish at (your local time)</FieldLabel>
                  <Input id="ann-at" type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} required />
                  <FieldError>{fieldErrors.publish_at?.[0]}</FieldError>
                </Field>
              ) : null}
            </FieldSet>
            <Field orientation="horizontal">
              <Checkbox id="ann-email" checked={sendEmail} onCheckedChange={(v) => setSendEmail(v === true)} disabled={mode === "draft"} />
              <FieldContent>
                <FieldLabel htmlFor="ann-email">Also send by email</FieldLabel>
                <FieldDescription>Scheduled emails go out at the publish time. Use sparingly for important news.</FieldDescription>
              </FieldContent>
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : mode === "now" ? "Publish announcement" : mode === "schedule" ? "Schedule announcement" : "Save draft"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AnnouncementRowActions({ announcement, courses }: { announcement: AnnouncementRow; courses: { id: string; title: string }[] }) {
  const router = useRouter();
  return (
    <div className="flex items-center justify-end gap-1">
      {announcement.state !== "published" ? (
        <AnnouncementDialog
          courses={courses}
          announcement={announcement}
          trigger={
            <Button size="sm" variant="ghost">
              Edit
            </Button>
          }
        />
      ) : (
        <ConfirmAction
          trigger={
            <Button size="sm" variant="ghost">
              <Undo2 /> Unpublish
            </Button>
          }
          title="Unpublish this announcement?"
          description="It disappears from dashboards. Notifications already delivered stay in people's inboxes."
          confirmLabel="Unpublish"
          action={() => unpublishAnnouncement({ id: announcement.id })}
          onDone={() => router.refresh()}
        />
      )}
      <ConfirmAction
        trigger={
          <Button size="icon-sm" variant="ghost" aria-label={`Delete ${announcement.title}`}>
            <Trash2 />
          </Button>
        }
        title="Delete this announcement?"
        description="Any emails still waiting to be sent are cancelled."
        confirmLabel="Delete announcement"
        destructive
        action={() => deleteAnnouncement({ id: announcement.id })}
        onDone={() => router.refresh()}
      />
    </div>
  );
}
