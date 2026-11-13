"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import { googleSignInAction, loginAction } from "@/app/(auth)/actions";
import { FormAlert, FormField, PasswordInput } from "./form-bits";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.8 3.6-4.9 6.7-4.9Z" />
    </svg>
  );
}

export function GoogleButton({ next, label = "Continue with Google" }: { next?: string; label?: string }) {
  const { run, pending } = useAction(googleSignInAction, {
    onSuccess: ({ redirectTo }) => window.location.assign(redirectTo),
  });
  return (
    <Button type="button" variant="outline" className="h-11 w-full gap-2 text-sm" disabled={pending} onClick={() => run({ next })}>
      {pending ? <Spinner className="size-4" /> : <GoogleIcon />}
      {label}
    </Button>
  );
}

export function LoginForm({ next, showGoogle }: { next?: string; showGoogle: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [navigating, setNavigating] = useState(false);
  const { run, pending, error, fieldErrors } = useAction(loginAction, {
    silent: true,
    onSuccess: ({ redirectTo }) => {
      setNavigating(true);
      // Full navigation so every server component re-renders with the new session.
      window.location.assign(redirectTo);
    },
  });
  const busy = pending || navigating;
  const unconfirmed = Boolean(fieldErrors.email?.[0]?.startsWith("Confirm"));

  return (
    <div className="grid gap-5">
      {showGoogle ? (
        <>
          <GoogleButton next={next} />
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or sign in with email <span className="h-px flex-1 bg-border" />
          </div>
        </>
      ) : null}

      <form
        className="grid gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void run({ email, password, next });
        }}
      >
        {error && !unconfirmed ? <FormAlert>{error}</FormAlert> : null}
        {unconfirmed ? (
          <FormAlert tone="info">
            Confirm your email address first.{" "}
            <Link href={`/verify-email?email=${encodeURIComponent(email)}`} className="font-semibold underline underline-offset-4">
              Send a new link
            </Link>
          </FormAlert>
        ) : null}

        <FormField label="Email" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 text-base sm:text-sm"
            maxLength={254}
            autoFocus
          />
        </FormField>

        <FormField
          label="Password"
          htmlFor="password"
          action={
            <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          }
        >
          <PasswordInput id="password" name="password" value={password} onChange={setPassword} autoComplete="current-password" />
        </FormField>

        <Button type="submit" className="mt-1 h-11 w-full text-[0.95rem]" disabled={busy || !email || !password}>
          {busy ? (
            <>
              <Spinner className="size-4" /> Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>
    </div>
  );
}
