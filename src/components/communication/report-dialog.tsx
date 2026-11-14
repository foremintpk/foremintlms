"use client";

import { useState } from "react";
import { useTrackedTransition } from "@/hooks/use-tracked-transition";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

export type ReportReason = "spam" | "harassment" | "inappropriate" | "off_topic" | "other";

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Spam or advertising" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "inappropriate", label: "Inappropriate or offensive" },
  { value: "off_topic", label: "Off topic" },
  { value: "other", label: "Something else" },
];

type Result = { ok: true; message?: string } | { ok: false; error: string };

/** Controlled report dialog; the caller decides what is being reported. */
export function ReportDialog({
  open,
  onOpenChange,
  what,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  what: string;
  onSubmit: (input: { reason: ReportReason; details?: string }) => Promise<Result>;
}) {
  const [reason, setReason] = useState<ReportReason>("spam");
  const [details, setDetails] = useState("");
  const [pending, startTransition] = useTrackedTransition();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report {what}</DialogTitle>
          <DialogDescription>Reports are private. Our moderators review them and take action when community rules are broken.</DialogDescription>
        </DialogHeader>
        <RadioGroup value={reason} onValueChange={(v) => setReason(v as ReportReason)} className="gap-2">
          {REASONS.map((r) => (
            <div key={r.value} className="flex items-center gap-2">
              <RadioGroupItem value={r.value} id={`report-${r.value}`} />
              <Label htmlFor={`report-${r.value}`} className="font-normal">
                {r.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
        <div className="grid gap-2">
          <Label htmlFor="report-details">Details (optional)</Label>
          <Textarea id="report-details" value={details} onChange={(e) => setDetails(e.target.value)} rows={3} maxLength={2000} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await onSubmit({ reason, details: details.trim() || undefined });
                if (res.ok) {
                  toast.success(res.message ?? "Report sent");
                  setDetails("");
                  onOpenChange(false);
                } else toast.error(res.error);
              })
            }
          >
            {pending ? "Sending…" : "Send report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
