"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Ban, KeyRound, MoreHorizontal, PlusCircle, RotateCcw, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmAction } from "@/components/common/confirm-action";
import { useAction } from "@/hooks/use-action";
import {
  clearDeletionRequest,
  deleteUserAccount,
  grantManualAccess,
  reactivateUser,
  revokeEntitlement,
  searchUsersAction,
  sendPasswordReset,
  suspendUser,
} from "@/app/admin/students/actions";

const DURATIONS = [
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "6 months" },
  { value: "365", label: "1 year" },
  { value: "lifetime", label: "No end date" },
  { value: "custom", label: "Until a date…" },
] as const;

/** Grant access form, shared by the student page and the enrollments page. */
export function GrantAccessForm({
  userId,
  courses,
  onDone,
  submitLabel = "Grant access",
}: {
  userId: string | null;
  courses: { id: string; title: string; status: string }[];
  onDone?: () => void;
  submitLabel?: string;
}) {
  const [target, setTarget] = useState<"course" | "all_access">("course");
  const [courseId, setCourseId] = useState("");
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]["value"]>("lifetime");
  const [customUntil, setCustomUntil] = useState("");
  const [reason, setReason] = useState("");
  const { run, pending, fieldErrors } = useAction(grantManualAccess, { onSuccess: () => onDone?.() });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!userId) return;
        void run({ userId, target, courseId: target === "course" ? courseId : "", duration, customUntil, reason });
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="grant-target">Access to</FieldLabel>
          <Select value={target} onValueChange={(v) => setTarget(v as typeof target)}>
            <SelectTrigger id="grant-target">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="course">One course</SelectItem>
              <SelectItem value="all_access">All courses (all-access)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {target === "course" ? (
          <Field>
            <FieldLabel htmlFor="grant-course">Course</FieldLabel>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger id="grant-course">
                <SelectValue placeholder={courses.length ? "Choose a course" : "No published courses"} />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError>{fieldErrors.courseId?.[0]}</FieldError>
          </Field>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="grant-duration">How long</FieldLabel>
            <Select value={duration} onValueChange={(v) => setDuration(v as typeof duration)}>
              <SelectTrigger id="grant-duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATIONS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {duration === "custom" ? (
            <Field>
              <FieldLabel htmlFor="grant-until">Until</FieldLabel>
              <Input id="grant-until" type="date" value={customUntil} onChange={(e) => setCustomUntil(e.target.value)} required />
              <FieldError>{fieldErrors.customUntil?.[0]}</FieldError>
            </Field>
          ) : null}
        </div>
        <Field>
          <FieldLabel htmlFor="grant-reason">Reason</FieldLabel>
          <Textarea
            id="grant-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={1000}
            placeholder="e.g. Scholarship, payment taken offline, support goodwill"
            required
          />
          <FieldDescription>Recorded with the grant and in the audit log.</FieldDescription>
          <FieldError>{fieldErrors.reason?.[0]}</FieldError>
        </Field>
      </FieldGroup>
      <div className="mt-6 flex justify-end">
        <Button type="submit" disabled={pending || !userId || reason.trim().length < 5 || (target === "course" && !courseId)}>
          {pending ? "Granting…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function GrantAccessDialog({ userId, courses, disabled }: { userId: string; courses: { id: string; title: string; status: string }[]; disabled?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          <PlusCircle /> Grant access
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Grant access</DialogTitle>
          <DialogDescription>Gives access without a payment. Use for scholarships, offline payments or support fixes.</DialogDescription>
        </DialogHeader>
        <GrantAccessForm
          userId={userId}
          courses={courses}
          onDone={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

export function RevokeEntitlementButton({ userId, entitlementId, label }: { userId: string; entitlementId: string; label: string }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={
        <Button size="icon-sm" variant="ghost" aria-label={`Revoke access to ${label}`}>
          <X />
        </Button>
      }
      title={`Revoke access to ${label}?`}
      description="Access ends immediately. If this came from a payment, refund it separately from Payments."
      confirmLabel="Revoke access"
      destructive
      requireReason
      action={({ reason }) => revokeEntitlement({ entitlementId, userId, reason })}
      onDone={() => router.refresh()}
    />
  );
}

function DeleteAccountDialog({ userId, email, open, onOpenChange }: { userId: string; email: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const { run, pending, fieldErrors } = useAction(deleteUserAccount, {
    onSuccess: () => {
      onOpenChange(false);
      router.push("/admin/students");
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Delete this account permanently?</DialogTitle>
          <DialogDescription>This can’t be undone.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          <p>Deleted: profile, sign-in, enrollments and progress, notes, quiz attempts, assignment submissions and their files, messages they sent, certificates.</p>
          <p className="text-muted-foreground">
            Kept without a link to this person: payment transactions and receipts (required for tax and accounting), and the audit log entry for this deletion.
          </p>
          <Field>
            <FieldLabel htmlFor="del-confirm">
              Type <span className="font-mono">{email}</span> to confirm
            </FieldLabel>
            <Input id="del-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
            <FieldError>{fieldErrors.confirmEmail?.[0]}</FieldError>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={pending || confirm.trim().toLowerCase() !== email.toLowerCase()}
            onClick={() => void run({ userId, confirmEmail: confirm })}
          >
            {pending ? "Deleting…" : "Delete account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AccountActions({
  userId,
  email,
  name,
  status,
  isSelf,
  isAdmin,
  deletionRequested,
}: {
  userId: string;
  email: string;
  name: string;
  status: "active" | "suspended";
  isSelf: boolean;
  isAdmin: boolean;
  deletionRequested: boolean;
}) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const reset = useAction(sendPasswordReset);
  const clear = useAction(clearDeletionRequest, { onSuccess: () => router.refresh() });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "active" ? (
        <ConfirmAction
          trigger={
            <Button variant="outline" disabled={isSelf}>
              <Ban /> Suspend account
            </Button>
          }
          title={`Suspend ${name}?`}
          description="They are signed out and can't sign in or open courses until you reactivate the account. Their data is kept."
          confirmLabel="Suspend account"
          destructive
          requireReason
          action={({ reason }) => suspendUser({ userId, reason })}
          onDone={() => router.refresh()}
        />
      ) : (
        <ConfirmAction
          trigger={
            <Button>
              <RotateCcw /> Reactivate account
            </Button>
          }
          title={`Reactivate ${name}?`}
          description="They can sign in again and get back any access that hasn't expired."
          confirmLabel="Reactivate"
          action={() => reactivateUser({ userId })}
          onDone={() => router.refresh()}
        />
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="More account actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={reset.pending || status !== "active"} onSelect={() => void reset.run({ userId })}>
            <KeyRound /> Send password reset email
          </DropdownMenuItem>
          {deletionRequested ? (
            <DropdownMenuItem disabled={clear.pending} onSelect={() => void clear.run({ userId })}>
              <X /> Clear deletion request
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={isSelf || isAdmin} onSelect={() => setDeleteOpen(true)}>
            <Trash2 /> Delete account…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {deleteOpen ? <DeleteAccountDialog userId={userId} email={email} open={deleteOpen} onOpenChange={setDeleteOpen} /> : null}
    </div>
  );
}

/** Search-as-you-type user picker (name, email or ID). */
export function UserPicker({
  role,
  value,
  onChange,
}: {
  role?: "student" | "teacher" | "admin";
  value: { id: string; full_name: string; email: string } | null;
  onChange: (user: { id: string; full_name: string; email: string } | null) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; full_name: string; email: string; status: string }[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { run, pending } = useAction(searchUsersAction, { silent: true, onSuccess: (rows) => setResults(rows) });

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
        <span className="min-w-0">
          <span className="block truncate font-medium">{value.full_name || value.email}</span>
          <span className="block truncate text-xs text-muted-foreground">{value.email}</span>
        </span>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Change person" onClick={() => onChange(null)}>
          <X />
        </Button>
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          className="pl-8"
          placeholder="Search by name or email"
          aria-label="Search people"
          onChange={(e) => {
            const next = e.target.value;
            setQ(next);
            if (timer.current) clearTimeout(timer.current);
            if (next.trim().length < 2) {
              setResults([]);
              return;
            }
            timer.current = setTimeout(() => void run({ q: next.trim(), role }), 300);
          }}
        />
      </div>
      {q.trim().length >= 2 ? (
        <ul className="max-h-56 overflow-y-auto rounded-lg border" role="listbox" aria-label="Matching people">
          {pending && results.length === 0 ? <li className="px-3 py-2 text-sm text-muted-foreground">Searching…</li> : null}
          {!pending && results.length === 0 ? <li className="px-3 py-2 text-sm text-muted-foreground">No one matches.</li> : null}
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                disabled={r.status !== "active"}
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                onClick={() => onChange(r)}
              >
                <span className="block truncate font-medium">{r.full_name || r.email}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {r.email}
                  {r.status !== "active" ? " · suspended" : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
