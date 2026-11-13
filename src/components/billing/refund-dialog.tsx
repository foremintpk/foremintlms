"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useAction, type ClientActionResult } from "@/hooks/use-action";

export function RefundDialog({
  refundableCents,
  currency,
  refund,
}: {
  refundableCents: number;
  currency: string;
  refund: (input: { amountCents: number | null; reason: string }) => Promise<ClientActionResult<{ status: string }>>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const { run, pending, fieldErrors } = useAction(refund, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });
  const fmt = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
          <Undo2 className="size-4" /> Refund
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Refund this payment</AlertDialogTitle>
          <AlertDialogDescription>
            The refund is issued through Whop to the original payment method. A full refund also removes the course access it paid for.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-4">
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as "full" | "partial")} className="grid gap-2">
            <label className="flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm">
              <RadioGroupItem value="full" /> Full refund — {fmt(refundableCents)}
            </label>
            <label className="flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm">
              <RadioGroupItem value="partial" /> Partial refund (access stays)
            </label>
          </RadioGroup>
          {mode === "partial" ? (
            <Field>
              <FieldLabel htmlFor="refund-amount">Amount</FieldLabel>
              <Input id="refund-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="10.00" />
              <FieldDescription>Up to {fmt(refundableCents)}.</FieldDescription>
              {fieldErrors.amountCents?.[0] ? <FieldError>{fieldErrors.amountCents[0]}</FieldError> : null}
            </Field>
          ) : null}
          <Field>
            <FieldLabel htmlFor="refund-reason">Reason</FieldLabel>
            <Textarea id="refund-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} placeholder="Recorded in the audit log" />
            {fieldErrors.reason?.[0] ? <FieldError>{fieldErrors.reason[0]}</FieldError> : null}
          </Field>
          {localError ? <p className="text-sm text-destructive">{localError}</p> : null}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={pending || reason.trim().length < 3}
            onClick={() => {
              setLocalError(null);
              let cents: number | null = null;
              if (mode === "partial") {
                const n = Math.round(Number(amount) * 100);
                if (!Number.isFinite(n) || n <= 0) return setLocalError("Enter the amount to refund.");
                if (n > refundableCents) return setLocalError(`You can refund at most ${fmt(refundableCents)}.`);
                cents = n;
              }
              void run({ amountCents: cents, reason: reason.trim() });
            }}
          >
            {pending ? "Refunding…" : mode === "full" ? "Refund in full" : "Issue partial refund"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
