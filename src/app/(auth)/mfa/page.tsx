import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { MfaChallenge, MfaEnroll } from "@/components/auth/mfa-flow";
import { safeNextPath } from "@/components/auth/utils";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export const metadata = { title: "Two-step verification" };

/**
 * Authenticator (TOTP) verification. Administrators are sent here until
 * their session is MFA-verified (aal2); anyone can use it to add a factor.
 */
export default async function MfaPage({ searchParams }: PageProps<"/mfa">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeNextPath(params.next, "") || undefined : undefined;

  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/mfa${next ? `?next=${encodeURIComponent(next)}` : ""}`)}`);
  if (user.accountStatus !== "active") redirect("/account-suspended");

  const supabase = await createClient();
  const [{ data: factors }, { data: aal }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  const verified = (factors?.totp ?? []).filter((f) => f.status === "verified");
  const enrollOnly = params.enroll === "1";

  if (aal?.currentLevel === "aal2" && !enrollOnly && next) redirect(next);

  if (verified.length > 0 && !enrollOnly) {
    return (
      <AuthCard
        title="Enter your verification code"
        description="Open your authenticator app and enter the current 6-digit code for Foremint Academy."
      >
        <MfaChallenge factorId={verified[0].id} next={next} />
        <p className="mt-6 text-sm text-muted-foreground">
          Lost access to your authenticator? Contact another administrator or support to reset two-step verification.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Turn on two-step verification"
      description={
        user.roles.includes("admin")
          ? "Administrator accounts must use an authenticator app. It only takes a minute."
          : "Add an authenticator app for an extra layer of security when you sign in."
      }
    >
      <MfaEnroll next={next} />
    </AuthCard>
  );
}
