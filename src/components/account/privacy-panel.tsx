"use client";

import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/auth/form-bits";
import { LocalTime } from "@/components/common/local-time";
import { useAction } from "@/hooks/use-action";
import { requestAccountDeletionAction } from "./actions";

export function PrivacyPanel({ deletionRequestedAt }: { deletionRequestedAt: string | null }) {
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [requested, setRequested] = useState<{ at: string; ticket: string | null } | null>(
    deletionRequestedAt ? { at: deletionRequestedAt, ticket: null } : null,
  );
  const { run, pending, error, fieldErrors } = useAction(requestAccountDeletionAction, {
    onSuccess: (data) => setRequested({ at: new Date().toISOString(), ticket: data.ticketNumber }),
  });

  return (
    <div className="grid max-w-2xl gap-8">
      <section className="grid gap-3">
        <div>
          <h3 className="text-base font-semibold">Download your data</h3>
          <p className="text-sm text-muted-foreground">
            A JSON file with your profile, enrollments, progress, submissions, certificates, payments, messages you sent and support tickets.
          </p>
        </div>
        <Button asChild variant="outline" className="h-10 w-fit">
          <a href="/learn/settings/export" download>
            <Download className="size-4" /> Download my data
          </a>
        </Button>
      </section>

      <section className="grid gap-4 rounded-2xl border border-destructive/25 p-5">
        <div>
          <h3 className="text-base font-semibold">Delete your account</h3>
          <p className="text-sm text-muted-foreground">
            We&rsquo;ll delete your account and personal data within 30 days. Payment records we must keep by law are retained, and course access
            you bought ends when the account is deleted.
          </p>
        </div>
        {requested ? (
          <FormAlert tone="info">
            Deletion requested <LocalTime value={requested.at} format="date" />.
            {requested.ticket ? ` Reference ${requested.ticket}.` : ""} We&rsquo;ll confirm by email before anything is removed.
          </FormAlert>
        ) : (
          <form
            className="grid gap-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void run({ reason, confirm: confirm as "DELETE" });
            }}
          >
            {error && !fieldErrors.confirm ? <FormAlert>{error}</FormAlert> : null}
            <FormField label="Anything we should know? (optional)" htmlFor="deletion-reason">
              <Textarea id="deletion-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={1000} />
            </FormField>
            <FormField label="Type DELETE to confirm" htmlFor="deletion-confirm" error={fieldErrors.confirm}>
              <Input id="deletion-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" className="max-w-48" />
            </FormField>
            <Button type="submit" variant="destructive" className="h-10 w-fit" disabled={pending || confirm !== "DELETE"}>
              {pending ? <Spinner className="size-4" /> : <Trash2 className="size-4" />} Request account deletion
            </Button>
          </form>
        )}
      </section>
    </div>
  );
}
