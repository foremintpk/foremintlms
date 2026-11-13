"use client";

import { useState } from "react";
import { ExternalLink, FileText, Link2, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmAction } from "@/components/common/confirm-action";
import { FileUpload } from "@/components/common/file-upload";
import { useAction } from "@/hooks/use-action";
import {
  addRecordingAction,
  addSessionResourceAction,
  cancelLiveSessionAction,
  deleteRecordingAction,
  inviteStudentsAction,
  markAttendanceAction,
  removeSessionResourceAction,
  saveAnnouncementAction,
  setRecordingVisibilityAction,
  syncSessionArtifactsAction,
} from "@/lib/services/live/actions";

export function AnnouncementForm({ sessionId, initial, disabled }: { sessionId: string; initial: string; disabled?: boolean }) {
  const [text, setText] = useState(initial);
  const [notifyStudents, setNotifyStudents] = useState(true);
  const { run, pending } = useAction(saveAnnouncementAction);
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void run({ sessionId, announcement: text, notifyStudents });
      }}
    >
      <Textarea
        rows={3}
        maxLength={2000}
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        aria-label="Announcement for students"
        placeholder="Share a reminder, a change of agenda, or what to prepare"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={notifyStudents} onCheckedChange={(v) => setNotifyStudents(v === true)} disabled={disabled} />
          Notify invited students
        </label>
        <Button type="submit" size="sm" disabled={pending || disabled || text === initial}>
          {pending ? "Saving…" : "Save announcement"}
        </Button>
      </div>
    </form>
  );
}

export function AttendanceToggle({ sessionId, userId, present, source }: { sessionId: string; userId: string; present: boolean; source: string | null }) {
  const { run, pending } = useAction(markAttendanceAction);
  const providerOnly = present && source === "provider";
  return (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox
        checked={present}
        disabled={pending || providerOnly}
        onCheckedChange={(v) => void run({ sessionId, userId, present: v === true })}
        aria-label={present ? "Remove attendance" : "Mark as attended"}
      />
      <span className="text-muted-foreground">
        {present ? (source === "provider" ? "Joined (from meeting)" : source === "join_click" ? "Joined (clicked join)" : "Marked present") : "Not recorded"}
      </span>
    </label>
  );
}

export function InviteStudentsButton({ sessionId, disabled }: { sessionId: string; disabled?: boolean }) {
  const { run, pending } = useAction(inviteStudentsAction);
  return (
    <Button variant="outline" size="sm" disabled={pending || disabled} onClick={() => void run({ sessionId })}>
      <UserPlus /> {pending ? "Inviting…" : "Invite new students"}
    </Button>
  );
}

export function SyncArtifactsButton({ sessionId }: { sessionId: string }) {
  const { run, pending } = useAction(syncSessionArtifactsAction);
  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={() => void run({ sessionId })}>
      <RefreshCw className={pending ? "animate-spin" : undefined} /> {pending ? "Syncing…" : "Sync recordings & attendance"}
    </Button>
  );
}

export function CancelSessionButton({ sessionId, title }: { sessionId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [notifyStudents, setNotifyStudents] = useState(true);
  const { run, pending } = useAction(cancelLiveSessionAction, { onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Cancel class
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel “{title}”?</DialogTitle>
          <DialogDescription>The meeting is removed from the provider where possible and students see it as cancelled.</DialogDescription>
        </DialogHeader>
        <FieldGroup className="gap-3">
          <Field>
            <FieldLabel htmlFor="cancel-reason">Reason (shared with students)</FieldLabel>
            <Textarea id="cancel-reason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={notifyStudents} onCheckedChange={(v) => setNotifyStudents(v === true)} />
            Email invited students
          </label>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Keep class
          </Button>
          <Button variant="destructive" disabled={pending} onClick={() => void run({ sessionId, reason, notifyStudents })}>
            {pending ? "Cancelling…" : "Cancel class"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AddRecordingForm({ sessionId }: { sessionId: string }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [passcode, setPasscode] = useState("");
  const { run, pending, fieldErrors } = useAction(addRecordingAction, {
    onSuccess: () => {
      setTitle("");
      setUrl("");
      setPasscode("");
    },
  });
  const err = (k: string) => (fieldErrors[k]?.length ? [{ message: fieldErrors[k][0] }] : undefined);
  return (
    <form
      className="grid gap-3 rounded-xl border bg-muted/30 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run({ sessionId, title, url, passcode: passcode || null });
      }}
    >
      <p className="text-sm font-medium">Add a recording link</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="rec-title">Title</FieldLabel>
          <Input id="rec-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} aria-invalid={Boolean(err("title"))} />
          <FieldError errors={err("title")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="rec-pass">Passcode</FieldLabel>
          <Input id="rec-pass" value={passcode} onChange={(e) => setPasscode(e.target.value)} maxLength={100} placeholder="Optional" />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="rec-url">Link</FieldLabel>
        <Input id="rec-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" aria-invalid={Boolean(err("url"))} />
        <FieldError errors={err("url")} />
      </Field>
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add recording"}
        </Button>
      </div>
    </form>
  );
}

export function RecordingControls({ recordingId, isVisible, title }: { recordingId: string; isVisible: boolean; title: string }) {
  const { run, pending } = useAction(setRecordingVisibilityAction);
  return (
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <Switch checked={isVisible} disabled={pending} onCheckedChange={(v) => void run({ recordingId, isVisible: v })} aria-label="Visible to students" />
        {isVisible ? "Visible" : "Hidden"}
      </label>
      <ConfirmAction
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label={`Remove ${title}`}>
            <Trash2 />
          </Button>
        }
        title="Remove this recording?"
        description="Students will no longer see it. The original stays with the meeting provider."
        confirmLabel="Remove recording"
        destructive
        action={() => deleteRecordingAction({ recordingId })}
      />
    </div>
  );
}

export function AddResourceForm({ sessionId, courseId }: { sessionId: string; courseId: string }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<{ id: string; fileName: string } | null>(null);
  const [mode, setMode] = useState<"file" | "link">("file");
  const { run, pending, fieldErrors } = useAction(addSessionResourceAction, {
    onSuccess: () => {
      setTitle("");
      setUrl("");
      setFile(null);
    },
  });
  const err = (k: string) => (fieldErrors[k]?.length ? [{ message: fieldErrors[k][0] }] : undefined);
  return (
    <form
      className="grid gap-3 rounded-xl border bg-muted/30 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run({ sessionId, title, mediaFileId: mode === "file" ? file?.id ?? null : null, url: mode === "link" ? url : null });
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Add a resource</p>
        <div className="flex gap-1">
          <Button type="button" size="xs" variant={mode === "file" ? "secondary" : "ghost"} onClick={() => setMode("file")}>
            <FileText /> File
          </Button>
          <Button type="button" size="xs" variant={mode === "link" ? "secondary" : "ghost"} onClick={() => setMode("link")}>
            <Link2 /> Link
          </Button>
        </div>
      </div>
      <Field>
        <FieldLabel htmlFor="res-title">Title</FieldLabel>
        <Input id="res-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Slides, worksheet, template…" aria-invalid={Boolean(err("title"))} />
        <FieldError errors={err("title")} />
      </Field>
      {mode === "file" ? (
        file ? (
          <p className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
            <span className="truncate">{file.fileName}</span>
            <Button type="button" variant="ghost" size="xs" onClick={() => setFile(null)}>
              Replace
            </Button>
          </p>
        ) : (
          <FileUpload
            purpose="live_resource"
            context={{ courseId, liveSessionId: sessionId }}
            label="Choose a file"
            hint="PDF, slides, documents, images or ZIP"
            onUploaded={(f) => {
              setFile({ id: f.id, fileName: f.fileName });
              if (!title) setTitle(f.fileName.replace(/\.[^.]+$/, ""));
            }}
          />
        )
      ) : (
        <Field>
          <FieldLabel htmlFor="res-url">Link</FieldLabel>
          <Input id="res-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" aria-invalid={Boolean(err("url"))} />
          <FieldError errors={err("url")} />
        </Field>
      )}
      <div>
        <Button type="submit" size="sm" disabled={pending || (mode === "file" && !file)}>
          {pending ? "Adding…" : "Add resource"}
        </Button>
      </div>
    </form>
  );
}

export function ResourceRow({ id, title, href, external }: { id: string; title: string; href: string; external: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
      <a href={href} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-2 font-medium hover:text-primary">
        {external ? <ExternalLink className="size-4 shrink-0 text-muted-foreground" /> : <FileText className="size-4 shrink-0 text-muted-foreground" />}
        <span className="truncate">{title}</span>
      </a>
      <ConfirmAction
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label={`Remove ${title}`}>
            <Trash2 />
          </Button>
        }
        title="Remove this resource?"
        description="Students will no longer see it on the class page."
        confirmLabel="Remove resource"
        destructive
        action={() => removeSessionResourceAction({ resourceId: id })}
      />
    </li>
  );
}
