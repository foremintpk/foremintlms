import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/simple-forms";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";

export const instant = false;

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <AuthCard
        title="This reset link has expired"
        description="Password reset links work once and expire after an hour. Request a new one to continue."
      >
        <Button asChild className="h-11 w-full">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" description={`For ${user.email}`}>
      <ResetPasswordForm context={[user.fullName, user.email.split("@")[0]]} />
    </AuthCard>
  );
}
