"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { KeyRound, Laptop, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmAction } from "@/components/common/confirm-action";
import { LocalTime } from "@/components/common/local-time";
import { FormAlert, FormField, PasswordInput, PasswordStrengthMeter } from "@/components/auth/form-bits";
import { useAction } from "@/hooks/use-action";
import { changePasswordAction, removeFactorAction, signOutOtherDevicesAction } from "./actions";

export interface FactorView {
  id: string;
  name: string;
  createdAt: string;
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-b pb-8 last:border-b-0 last:pb-0">
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function ChangePasswordForm({ context }: { context: string[] }) {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [signOutOthers, setSignOutOthers] = useState(true);
  const { run, pending, error, fieldErrors } = useAction(changePasswordAction, {
    onSuccess: () => {
      setCurrent("");
      setNew("");
      setConfirm("");
    },
  });
  return (
    <form
      className="grid max-w-md gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void run({ currentPassword, newPassword, confirm, signOutOthers });
      }}
    >
      {error && Object.keys(fieldErrors).length === 0 ? <FormAlert>{error}</FormAlert> : null}
      <FormField label="Current password" htmlFor="currentPassword" error={fieldErrors.currentPassword}>
        <PasswordInput id="currentPassword" name="currentPassword" value={currentPassword} onChange={setCurrent} autoComplete="current-password" invalid={Boolean(fieldErrors.currentPassword)} />
      </FormField>
      <FormField label="New password" htmlFor="newPassword" error={fieldErrors.newPassword}>
        <PasswordInput id="newPassword" name="newPassword" value={newPassword} onChange={setNew} autoComplete="new-password" invalid={Boolean(fieldErrors.newPassword)} />
        <PasswordStrengthMeter password={newPassword} context={context} />
      </FormField>
      <FormField label="Confirm new password" htmlFor="confirmPassword" error={fieldErrors.confirm}>
        <PasswordInput id="confirmPassword" name="confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" invalid={Boolean(fieldErrors.confirm)} />
      </FormField>
      <label className="flex items-center gap-2.5 text-sm">
        <Checkbox checked={signOutOthers} onCheckedChange={(v) => setSignOutOthers(v === true)} />
        Sign out of all other devices
      </label>
      <div>
        <Button type="submit" disabled={pending || !currentPassword || !newPassword || !confirm} className="h-10">
          {pending ? (
            <>
              <Spinner className="size-4" /> Changing…
            </>
          ) : (
            "Change password"
          )}
        </Button>
      </div>
    </form>
  );
}

export function SecurityPanel({
  factors,
  aal,
  mfaRequired,
  passwordContext,
  settingsPath,
}: {
  factors: FactorView[];
  aal: "aal1" | "aal2";
  mfaRequired: boolean;
  passwordContext: string[];
  settingsPath: string;
}) {
  const router = useRouter();
  const back = encodeURIComponent(`${settingsPath}?tab=security`);

  return (
    <div className="grid gap-8">
      <Section title="Password" description="Use a long, unique password you don't use anywhere else.">
        <ChangePasswordForm context={passwordContext} />
      </Section>

      <Section title="Two-step verification" description="Require a code from an authenticator app when you sign in.">
        {factors.length === 0 ? (
          <div className="flex flex-col gap-3 rounded-xl border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <ShieldOff className="mt-0.5 size-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Not turned on</p>
                <p className="text-sm text-muted-foreground">
                  {mfaRequired ? "Your role requires an authenticator app." : "Add an authenticator app to protect your account."}
                </p>
              </div>
            </div>
            <Button asChild className="h-10 shrink-0">
              <Link href={`/mfa?enroll=1&next=${back}`}>Set up authenticator</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {aal !== "aal2" ? (
              <FormAlert tone="info">
                <Link href={`/mfa?next=${back}`} className="font-semibold underline underline-offset-4">
                  Verify with your authenticator
                </Link>{" "}
                to add or remove authenticator apps.
              </FormAlert>
            ) : null}
            <ul className="divide-y rounded-xl border">
              {factors.map((f) => (
                <li key={f.id} className="flex items-center gap-3 px-4 py-3">
                  <ShieldCheck className="size-5 text-success" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{f.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Added <LocalTime value={f.createdAt} format="date" />
                    </p>
                  </div>
                  <ConfirmAction
                    trigger={
                      <Button type="button" variant="ghost" size="sm" disabled={aal !== "aal2"}>
                        Remove
                      </Button>
                    }
                    title="Remove this authenticator?"
                    description={
                      factors.length === 1
                        ? "Two-step verification will be turned off for your account."
                        : "You'll still be able to verify with your other authenticator."
                    }
                    confirmLabel="Remove authenticator"
                    destructive
                    action={() => removeFactorAction({ factorId: f.id })}
                    onDone={() => router.refresh()}
                  />
                </li>
              ))}
            </ul>
            {aal === "aal2" ? (
              <Button asChild variant="outline" className="h-10 w-fit">
                <Link href={`/mfa?enroll=1&next=${back}`}>
                  <KeyRound className="size-4" /> Add another authenticator
                </Link>
              </Button>
            ) : null}
          </div>
        )}
      </Section>

      <Section title="Other devices" description="Signed in on a shared or lost device? End every session except this one.">
        <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Laptop className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">You&rsquo;ll stay signed in here. Other browsers and devices will need to sign in again.</p>
          </div>
          <ConfirmAction
            trigger={
              <Button type="button" variant="outline" className="h-10 shrink-0">
                Sign out of all other devices
              </Button>
            }
            title="Sign out of all other devices?"
            description="Every other browser and device signed in to your account will be signed out."
            confirmLabel="Sign out other devices"
            action={() => signOutOtherDevicesAction()}
            onDone={() => router.refresh()}
          />
        </div>
      </Section>
    </div>
  );
}
