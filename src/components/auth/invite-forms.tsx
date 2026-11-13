"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import { acceptInvitationAction, acceptInvitationWithNewAccountAction } from "@/app/(auth)/invite/[token]/actions";
import { FormAlert, FormField, PasswordInput, PasswordStrengthMeter } from "./form-bits";

function useNavigatingAction<I>(action: (input: I) => Promise<{ ok: true; data: { redirectTo: string }; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> }>) {
  const [navigating, setNavigating] = useState(false);
  const state = useAction(action, {
    silent: true,
    onSuccess: ({ redirectTo }) => {
      setNavigating(true);
      window.location.assign(redirectTo);
    },
  });
  return { ...state, busy: state.pending || navigating };
}

export function AcceptInvitationButton({ token }: { token: string }) {
  const { run, busy, error } = useNavigatingAction(acceptInvitationAction);
  return (
    <div className="grid gap-3">
      {error ? <FormAlert>{error}</FormAlert> : null}
      <Button type="button" className="h-11 w-full" disabled={busy} onClick={() => run({ token })}>
        {busy ? (
          <>
            <Spinner className="size-4" /> Accepting…
          </>
        ) : (
          "Accept invitation"
        )}
      </Button>
    </div>
  );
}

export function AcceptInvitationNewAccountForm({ token, email, defaultName }: { token: string; email: string; defaultName: string }) {
  const [fullName, setFullName] = useState(defaultName);
  const [password, setPassword] = useState("");
  const { run, busy, error, fieldErrors } = useNavigatingAction(acceptInvitationWithNewAccountAction);

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void run({ token, fullName, password });
      }}
    >
      {error && !fieldErrors.password && !fieldErrors.fullName ? <FormAlert>{error}</FormAlert> : null}
      <FormField label="Email" htmlFor="invite-email" description="Invitations are tied to this address.">
        <Input id="invite-email" value={email} readOnly disabled className="h-11 text-base sm:text-sm" />
      </FormField>
      <FormField label="Full name" htmlFor="fullName" error={fieldErrors.fullName}>
        <Input
          id="fullName"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="h-11 text-base sm:text-sm"
          maxLength={120}
          required
        />
      </FormField>
      <FormField label="Create a password" htmlFor="password" error={fieldErrors.password}>
        <PasswordInput id="password" name="password" value={password} onChange={setPassword} autoComplete="new-password" invalid={Boolean(fieldErrors.password)} />
        <PasswordStrengthMeter password={password} context={[fullName, email.split("@")[0]]} />
      </FormField>
      <Button type="submit" className="h-11 w-full" disabled={busy || !fullName || !password}>
        {busy ? (
          <>
            <Spinner className="size-4" /> Creating your account…
          </>
        ) : (
          "Create account and accept"
        )}
      </Button>
    </form>
  );
}
