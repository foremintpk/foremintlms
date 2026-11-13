import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { FormAlert } from "@/components/auth/form-bits";
import { LoginForm } from "@/components/auth/login-form";
import { safeNextPath } from "@/components/auth/utils";
import { getSessionUser } from "@/lib/auth/session";
import { getSetting } from "@/lib/settings";

export const instant = false;

export const metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  link_expired: "That link has expired or was already used. Sign in, or request a new verification email.",
  reset_link_expired: "That password reset link has expired or was already used. Request a new one.",
  invalid_link: "That link isn't valid. Check you copied the whole link from the email.",
  oauth_failed: "We couldn't complete Google sign-in. Try again or use your email and password.",
  oauth_denied: "Google sign-in was cancelled.",
  session_expired: "Your session ended. Sign in again to continue.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const nextRaw = typeof params.next === "string" ? params.next : undefined;
  const next = nextRaw ? safeNextPath(nextRaw, "") || undefined : undefined;
  const errorKey = typeof params.error === "string" ? params.error : null;

  const user = await getSessionUser();
  if (user) redirect(next ?? (user.primaryRole === "admin" ? "/admin" : user.primaryRole === "teacher" ? "/teach" : "/learn"));

  const showGoogle = await getSetting<boolean>("security.allow_google_login", false);

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to continue learning where you left off."
      footer={
        <>
          New to Foremint Academy?{" "}
          <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="font-semibold text-primary hover:underline">
            Create a free account
          </Link>
        </>
      }
    >
      {errorKey && ERRORS[errorKey] ? (
        <div className="mb-5">
          <FormAlert tone={errorKey === "oauth_denied" ? "info" : "error"}>{ERRORS[errorKey]}</FormAlert>
        </div>
      ) : null}
      <LoginForm next={next} showGoogle={showGoogle} />
    </AuthCard>
  );
}
