"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAction, type ClientActionResult } from "@/hooks/use-action";

/**
 * A button that asks for confirmation before running a server action.
 * Set `requireReason` for actions that must be justified in the audit log
 * (revoking access, refunds, suspensions).
 */
export function ConfirmAction<T>({
  trigger,
  title,
  description,
  confirmLabel,
  destructive = false,
  requireReason = false,
  reasonLabel = "Reason",
  action,
  onDone,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  requireReason?: boolean;
  reasonLabel?: string;
  action: (input: { reason?: string }) => Promise<ClientActionResult<T>>;
  onDone?: (data: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { run, pending } = useAction(action, {
    onSuccess: (data) => {
      setOpen(false);
      setReason("");
      onDone?.(data);
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        {requireReason ? (
          <div className="grid gap-2">
            <Label htmlFor="confirm-reason">{reasonLabel}</Label>
            <Textarea
              id="confirm-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Recorded in the audit log"
            />
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={destructive ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
            disabled={pending || (requireReason && reason.trim().length < 3)}
            onClick={(e) => {
              e.preventDefault();
              void run({ reason: reason.trim() || undefined });
            }}
          >
            {pending ? "Working…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
