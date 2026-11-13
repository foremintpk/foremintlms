"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import { registerAction } from "@/app/(auth)/actions";
import { GoogleButton } from "./login-form";
import { FormAlert, FormField, PasswordInput, PasswordStrengthMeter } from "./form-bits";

export function RegisterForm({ next, showGoogle }: { next?: string; showGoogle: boolean }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const { run, pending, error, fieldErrors } = useAction(registerAction, {
    silent: true,
    onSuccess: (data) => router.push(`/verify-email?email=${encodeURIComponent(data.email)}&sent=1`),
  });

  return (
    <div className="grid gap-5">
      {showGoogle ? (
        <>
          <GoogleButton next={next} label="Sign up with Google" />
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or use your email <span className="h-px flex-1 bg-border" />
          </div>
        </>
      ) : null}
      <form
        className="grid gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void run({ fullName, email, password, acceptTerms: acceptTerms as true, next });
        }}
      >
        {error && Object.keys(fieldErrors).length === 0 ? <FormAlert>{error}</FormAlert> : null}

        <FormField label="Full name" htmlFor="fullName" error={fieldErrors.fullName}>
          <Input
            id="fullName"
            name="fullName"
            autoComplete="name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="h-11 text-base sm:text-sm"
            maxLength={120}
            aria-invalid={Boolean(fieldErrors.fullName) || undefined}
            autoFocus
          />
        </FormField>

        <FormField label="Email" htmlFor="email" error={fieldErrors.email}>
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
            aria-invalid={Boolean(fieldErrors.email) || undefined}
          />
        </FormField>

        <FormField label="Password" htmlFor="password" error={fieldErrors.password}>
          <PasswordInput
            id="password"
            name="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            invalid={Boolean(fieldErrors.password)}
          />
          <PasswordStrengthMeter password={password} context={[fullName, email.split("@")[0]]} />
        </FormField>

        <div className="grid gap-1.5">
          <label className="flex items-start gap-2.5 text-sm leading-snug text-muted-foreground">
            <Checkbox
              id="acceptTerms"
              checked={acceptTerms}
              onCheckedChange={(v) => setAcceptTerms(v === true)}
              className="mt-0.5"
              aria-invalid={Boolean(fieldErrors.acceptTerms) || undefined}
            />
            <span>
              I agree to the{" "}
              <Link href="/legal/terms" target="_blank" className="font-medium text-foreground underline underline-offset-4">
                Terms and Conditions
              </Link>{" "}
              and{" "}
              <Link href="/legal/privacy" target="_blank" className="font-medium text-foreground underline underline-offset-4">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          {fieldErrors.acceptTerms ? (
            <p role="alert" className="text-sm text-destructive">
              {fieldErrors.acceptTerms[0]}
            </p>
          ) : null}
        </div>

        <Button type="submit" className="mt-1 h-11 w-full text-[0.95rem]" disabled={pending}>
          {pending ? (
            <>
              <Spinner className="size-4" /> Creating account…
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>
    </div>
  );
}
