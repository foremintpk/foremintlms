"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, PauseCircle, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmAction } from "@/components/common/confirm-action";
import { useAction } from "@/hooks/use-action";
import { extendAccessAction, setPackageStatusAction } from "@/app/admin/billing/actions";

export function ExtendAccessDialog({ entitlementId, currentExpiry, triggerLabel = "Extend access" }: { entitlementId: string; currentExpiry: string | null; triggerLabel?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"add_from_expiry" | "add_from_today" | "set_date">("add_from_expiry");
  const [days, setDays] = useState("30");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const { run, pending, fieldErrors } = useAction(extendAccessAction, {
    onSuccess: () => {
      setOpen(false);
      setReason("");
      router.refresh();
    },
  });
  const err = (k: string) => (fieldErrors[k]?.length ? <FieldError>{fieldErrors[k][0]}</FieldError> : null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <CalendarPlus aria-hidden />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Extend access</DialogTitle>
          <DialogDescription>
            Changes the end date for everyone covered by this package. {currentExpiry ? `It currently ends ${new Date(currentExpiry).toLocaleDateString()}.` : "It currently has no end date."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run({ entitlementId, mode, days: mode === "set_date" ? null : Number(days), date: mode === "set_date" ? date : null, reason });
          }}
        >
          <Field>
            <FieldLabel htmlFor="extend-mode">How</FieldLabel>
            <Select value={mode} onValueChange={(m) => setMode(m as typeof mode)}>
              <SelectTrigger id="extend-mode" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="add_from_expiry">Add days to the current end date</SelectItem>
                <SelectItem value="add_from_today">Add days from today</SelectItem>
                <SelectItem value="set_date">Set a new end date</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {mode === "set_date" ? (
            <Field>
              <FieldLabel htmlFor="extend-date">New end date</FieldLabel>
              <Input id="extend-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              {err("date")}
            </Field>
          ) : (
            <Field>
              <FieldLabel htmlFor="extend-days">Days</FieldLabel>
              <Input id="extend-days" type="number" min={1} max={3650} value={days} onChange={(e) => setDays(e.target.value)} />
              <FieldDescription>{mode === "add_from_expiry" ? "An already-ended package is extended from today." : null}</FieldDescription>
              {err("days")}
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="extend-reason">Reason</FieldLabel>
            <Textarea id="extend-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Recorded in the audit log" maxLength={1000} />
            {err("reason")}
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Extend access
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PackageStatusControls({ entitlementId, status }: { entitlementId: string; status: string }) {
  const router = useRouter();
  if (status === "revoked") return null;
  return status === "suspended" ? (
    <ConfirmAction
      trigger={
        <Button size="sm" variant="outline">
          <PlayCircle aria-hidden />
          Restore access
        </Button>
      }
      title="Restore access?"
      description="Everyone covered by this package regains access, until its end date."
      confirmLabel="Restore access"
      requireReason
      action={(i) => setPackageStatusAction({ entitlementId, status: "active", reason: i.reason ?? "" })}
      onDone={() => router.refresh()}
    />
  ) : (
    <ConfirmAction
      trigger={
        <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
          <PauseCircle aria-hidden />
          Suspend access
        </Button>
      }
      title="Suspend this package?"
      description="Everyone covered by it loses access immediately (their own purchases are unaffected). You can restore it later."
      confirmLabel="Suspend access"
      destructive
      requireReason
      action={(i) => setPackageStatusAction({ entitlementId, status: "suspended", reason: i.reason ?? "" })}
      onDone={() => router.refresh()}
    />
  );
}
