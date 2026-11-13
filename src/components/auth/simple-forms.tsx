"use client";

import { useState } from "react";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import { forgotPasswordAction, resendVerificationAction, resetPasswordAction } from "@/app/(auth)/actions";
import { FormAlert, FormField, PasswordInput, PasswordStrengthMeter } from "./form-bits";

function EmailOnlyForm({
  initialEmail = "",
  submitLabel,
  pendingLabel,
  action,
  successTitle,
}: {
  initialEmail?: string;
  submitLabel: string;
  pendingLabel: string;
  action: (input: { email: string }) => Promise<{ ok: true; data: null; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> }>;
  successTitle: string;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [done, setDone] = useState<string | null>(null);
  const { run, pending, error, fieldErrors } = useAction(action, {
    silent: true,
    onSuccess: () => setDone(email),
  });

  if (done) {
    return (
      <div className="grid gap-4 rounded-2xl border bg-card p-5 shadow-card">
        <span className="grid size-10 place-items-center rounded-xl bg-success-soft text-success">
          <MailCheck className="size-5" />
        </span>
        <div className="space-y-1.5">
          <p className="font-semibold">{successTitle}</p>
          <p className="text-sm text-muted-foreground">
            If <span className="font-medium text-foreground">{done}</span> has an account, you&rsquo;ll get an email in the next few minutes. Check
            your spam folder if it doesn&rsquo;t arrive.
          </p>
        </div>
        <Button type="button" variant="outline" className="h-10 w-fit" onClick={() => setDone(null)}>
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void run({ email });
      }}
    >
      {error && !fieldErrors.email ? <FormAlert>{error}</FormAlert> : null}
      <FormField label="Email" htmlFor="email" error={fieldErrors.email}>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11 text-base sm:text-sm"
          maxLength={254}
          autoFocus={!initialEmail}
        />
      </FormField>
      <Button type="submit" className="h-11 w-full" disabled={pending || !email}>
        {pending ? (
          <>
            <Spinner className="size-4" /> {pendingLabel}
          </>
        ) : (
          submitLabel
        )}
      </Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  return (
    <EmailOnlyForm
      submitLabel="Email me a reset link"
      pendingLabel="Sending…"
      action={forgotPasswordAction}
      successTitle="Check your inbox"
    />
  );
}

export function ResendVerificationForm({ initialEmail }: { initialEmail?: string }) {
  return (
    <EmailOnlyForm
      initialEmail={initialEmail}
      submitLabel="Send a new verification link"
      pendingLabel="Sending…"
      action={resendVerificationAction}
      successTitle="A new link is on its way"
    />
  );
}

export function ResetPasswordForm({ context }: { context: string[] }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [navigating, setNavigating] = useState(false);
  const { run, pending, error, fieldErrors } = useAction(resetPasswordAction, {
    onSuccess: ({ redirectTo }) => {
      setNavigating(true);
      window.location.assign(redirectTo);
    },
  });
  const busy = pending || navigating;

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void run({ password, confirm });
      }}
    >
      {error && !fieldErrors.password && !fieldErrors.confirm ? <FormAlert>{error}</FormAlert> : null}
      <FormField label="New password" htmlFor="password" error={fieldErrors.password}>
        <PasswordInput id="password" name="password" value={password} onChange={setPassword} autoComplete="new-password" invalid={Boolean(fieldErrors.password)} />
        <PasswordStrengthMeter password={password} context={context} />
      </FormField>
      <FormField label="Confirm new password" htmlFor="confirm" error={fieldErrors.confirm}>
        <PasswordInput id="confirm" name="confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" invalid={Boolean(fieldErrors.confirm)} />
      </FormField>
      <p className="text-xs text-muted-foreground">Saving signs you out on every other device.</p>
      <Button type="submit" className="h-11 w-full" disabled={busy || !password || !confirm}>
        {busy ? (
          <>
            <Spinner className="size-4" /> Saving…
          </>
        ) : (
          "Save new password"
        )}
      </Button>
    </form>
  );
}
