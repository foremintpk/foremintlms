"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import { acceptJoinAction, acceptJoinWithNewAccountAction } from "@/app/(auth)/join/[token]/actions";
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

export function AcceptJoinButton({ token, label }: { token: string; label: string }) {
  const { run, busy, error } = useNavigatingAction(acceptJoinAction);
  return (
    <div className="grid gap-3">
      {error ? <FormAlert>{error}</FormAlert> : null}
      <Button type="button" className="h-11 w-full" disabled={busy} onClick={() => run({ token })} data-testid="accept-join">
        {busy ? (
          <>
            <Spinner className="size-4" /> Joining…
          </>
        ) : (
          label
        )}
      </Button>
    </div>
  );
}

export function JoinNewAccountForm({ token, email, defaultName, submitLabel }: { token: string; email: string; defaultName: string; submitLabel: string }) {
  const [fullName, setFullName] = useState(defaultName);
  const [password, setPassword] = useState("");
  const { run, busy, error, fieldErrors } = useNavigatingAction(acceptJoinWithNewAccountAction);

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
      <FormField label="Email" htmlFor="join-email" description="Your account uses this address.">
        <Input id="join-email" value={email} readOnly disabled className="h-11 text-base sm:text-sm" />
      </FormField>
      <FormField label="Full name" htmlFor="fullName" error={fieldErrors.fullName}>
        <Input id="fullName" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-11 text-base sm:text-sm" maxLength={120} required />
      </FormField>
      <FormField label="Create a password" htmlFor="password" error={fieldErrors.password}>
        <PasswordInput id="password" name="password" value={password} onChange={setPassword} autoComplete="new-password" invalid={Boolean(fieldErrors.password)} />
        <PasswordStrengthMeter password={password} context={[fullName, email.split("@")[0]]} />
      </FormField>
      <Button type="submit" className="h-11 w-full" disabled={busy || !fullName || !password} data-testid="join-create-account">
        {busy ? (
          <>
            <Spinner className="size-4" /> Setting up your account…
          </>
        ) : (
          submitLabel
        )}
      </Button>
    </form>
  );
}
