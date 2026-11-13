"use client";

import { useState, useTransition } from "react";
import { Lock, Paperclip, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload, type UploadedFile } from "@/components/common/file-upload";
import { cn } from "@/lib/utils";
import { statusLabel, TICKET_PRIORITIES, TICKET_STATUSES, type TicketPriority, type TicketStatus } from "../lib/tickets";
import { assignTicketAction, replyTicketAction, requesterTicketAction, setTicketPriorityAction, setTicketStatusAction } from "./actions";

export function TicketReplyForm({ ticketId, isStaff, currentStatus }: { ticketId: string; isStaff: boolean; currentStatus: TicketStatus }) {
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [nextStatus, setNextStatus] = useState<string>("auto");
  const [pending, startTransition] = useTransition();
  const [uploadKey, setUploadKey] = useState(0);

  return (
    <form
      className={cn("grid gap-3 rounded-2xl border bg-card p-4 sm:p-5", internal && "border-warning/40 bg-warning-soft/40")}
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await replyTicketAction({
            ticketId,
            body,
            isInternal: internal,
            attachmentIds: files.map((f) => f.id),
            setStatus: nextStatus === "auto" ? null : nextStatus,
          });
          if (res.ok) {
            toast.success(res.message ?? "Sent");
            setBody("");
            setFiles([]);
            setShowUpload(false);
            setNextStatus("auto");
            setUploadKey((k) => k + 1);
          } else toast.error(res.error);
        });
      }}
    >
      <Label htmlFor={`ticket-reply-${ticketId}`}>{internal ? "Internal note (only staff can see this)" : isStaff ? "Reply to the student" : "Add a reply"}</Label>
      <Textarea
        id={`ticket-reply-${ticketId}`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        maxLength={20_000}
        placeholder={internal ? "Notes for the support team" : "Write your message"}
      />
      {showUpload ? (
        <FileUpload
          key={uploadKey}
          purpose="ticket_attachment"
          context={{ ticketId }}
          multiple
          maxFiles={5}
          label="Add files"
          onUploaded={(f) => setFiles((prev) => (prev.length >= 5 ? prev : [...prev, f]))}
        />
      ) : null}
      {files.length ? (
        <ul className="flex flex-wrap gap-2">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs">
              <Paperclip className="size-3" />
              <span className="max-w-48 truncate">{f.fileName}</span>
              <button type="button" aria-label={`Remove ${f.fileName}`} onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))}>
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={() => setShowUpload((v) => !v)} aria-pressed={showUpload}>
          <Paperclip className="size-4" /> Attach
        </Button>
        {isStaff ? (
          <>
            <div className="flex items-center gap-2">
              <Switch id={`internal-${ticketId}`} checked={internal} onCheckedChange={setInternal} />
              <Label htmlFor={`internal-${ticketId}`} className="font-normal">
                Internal note
              </Label>
            </div>
            {!internal ? (
              <Select value={nextStatus} onValueChange={setNextStatus}>
                <SelectTrigger className="h-8 w-56" aria-label="Status after reply">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Then: wait for the student</SelectItem>
                  <SelectItem value="in_progress">Then: keep in progress</SelectItem>
                  <SelectItem value="resolved">Then: mark resolved</SelectItem>
                </SelectContent>
              </Select>
            ) : null}
          </>
        ) : currentStatus === "resolved" ? (
          <span className="text-xs text-muted-foreground">Replying reopens this ticket.</span>
        ) : null}
        <Button type="submit" className="ml-auto" disabled={pending || !body.trim()}>
          {pending ? "Sending…" : internal ? "Add note" : "Send reply"}
        </Button>
      </div>
    </form>
  );
}

export function StaffTicketControls({
  ticketId,
  status,
  priority,
  assigneeId,
  meId,
  isAdmin,
  staff,
}: {
  ticketId: string;
  status: TicketStatus;
  priority: TicketPriority;
  assigneeId: string | null;
  meId: string;
  isAdmin: boolean;
  staff: { id: string; name: string; role: "admin" | "teacher" }[];
}) {
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) toast.success(res.message ?? "Saved");
      else toast.error(res.error);
    });

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor={`status-${ticketId}`} className="text-xs text-muted-foreground">
          Status
        </Label>
        <Select value={status} disabled={pending} onValueChange={(v) => run(() => setTicketStatusAction({ ticketId, status: v }))}>
          <SelectTrigger id={`status-${ticketId}`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TICKET_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {statusLabel(s, "staff")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`priority-${ticketId}`} className="text-xs text-muted-foreground">
          Priority
        </Label>
        <Select value={priority} disabled={pending} onValueChange={(v) => run(() => setTicketPriorityAction({ ticketId, priority: v }))}>
          <SelectTrigger id={`priority-${ticketId}`} className="w-full capitalize">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TICKET_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p} className="capitalize">
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`assignee-${ticketId}`} className="text-xs text-muted-foreground">
          Assigned to
        </Label>
        {isAdmin ? (
          <Select
            value={assigneeId ?? "none"}
            disabled={pending}
            onValueChange={(v) => run(() => assignTicketAction({ ticketId, assigneeId: v === "none" ? null : v }))}
          >
            <SelectTrigger id={`assignee-${ticketId}`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unassigned</SelectItem>
              {staff.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} {s.role === "teacher" ? "(instructor)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : assigneeId === meId ? (
          <p className="text-sm">You</p>
        ) : (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => assignTicketAction({ ticketId, assigneeId: meId }))}>
            Assign to me
          </Button>
        )}
      </div>
    </div>
  );
}

export function RequesterTicketControls({ ticketId, status, canReopen }: { ticketId: string; status: TicketStatus; canReopen: boolean }) {
  const [pending, startTransition] = useTransition();
  const run = (action: "close" | "reopen") =>
    startTransition(async () => {
      const res = await requesterTicketAction({ ticketId, action });
      if (res.ok) toast.success(res.message ?? "Saved");
      else toast.error(res.error);
    });
  if (status === "resolved" || status === "closed") {
    return canReopen ? (
      <Button variant="outline" size="sm" disabled={pending} onClick={() => run("reopen")}>
        <RotateCcw className="size-4" /> Reopen ticket
      </Button>
    ) : null;
  }
  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={() => run("close")}>
      <Lock className="size-4" /> Close ticket
    </Button>
  );
}
