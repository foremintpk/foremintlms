"use client";

import { useState } from "react";
import { CheckCircle2, PlugZap, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { FormField } from "@/components/auth/form-bits";
import { useAction } from "@/hooks/use-action";
import { saveSenderSettingsAction, testEmailConnectionAction } from "../actions";

export function SenderForm({ initial }: { initial: { senderName: string; fromAddress: string; replyTo: string } }) {
  const [values, setValues] = useState(initial);
  const save = useAction(saveSenderSettingsAction);
  const set = (key: keyof typeof values, value: string) => setValues((v) => ({ ...v, [key]: value }));

  return (
    <form
      className="grid max-w-xl gap-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save.run(values);
      }}
    >
      <FormField label="Sender name" htmlFor="senderName" description="Shown as the “From” name in inboxes." error={save.fieldErrors.senderName}>
        <Input id="senderName" value={values.senderName} onChange={(e) => set("senderName", e.target.value)} maxLength={80} />
      </FormField>
      <FormField
        label="From address"
        htmlFor="fromAddress"
        description="Must be on a domain verified in Resend. Leave empty to use EMAIL_FROM."
        error={save.fieldErrors.fromAddress}
      >
        <Input id="fromAddress" type="email" value={values.fromAddress} onChange={(e) => set("fromAddress", e.target.value)} placeholder="hello@mail.yourdomain.com" />
      </FormField>
      <FormField label="Reply-to address" htmlFor="replyTo" description="Where replies go, usually your support inbox." error={save.fieldErrors.replyTo}>
        <Input id="replyTo" type="email" value={values.replyTo} onChange={(e) => set("replyTo", e.target.value)} placeholder="support@yourdomain.com" />
      </FormField>
      <div>
        <Button type="submit" disabled={save.pending} className="h-10">
          {save.pending ? (
            <>
              <Spinner className="size-4" /> Saving…
            </>
          ) : (
            "Save sender settings"
          )}
        </Button>
      </div>
    </form>
  );
}

export function ConnectionTest() {
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const test = useAction(testEmailConnectionAction, { silent: true, onSuccess: setResult });
  return (
    <div className="grid gap-3">
      <Button type="button" variant="outline" className="h-10 w-fit" disabled={test.pending} onClick={() => test.run(undefined)}>
        {test.pending ? <Spinner className="size-4" /> : <PlugZap className="size-4" />} Test connection
      </Button>
      {result ? (
        <p className={`flex items-start gap-2 text-sm ${result.ok ? "text-success" : "text-destructive"}`} role="status">
          {result.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <XCircle className="mt-0.5 size-4 shrink-0" />}
          {result.message}
        </p>
      ) : test.error ? (
        <p className="text-sm text-destructive">{test.error}</p>
      ) : null}
    </div>
  );
}
