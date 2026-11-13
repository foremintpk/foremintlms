import Link from "next/link";
import { MailCheck } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { ResendVerificationForm } from "@/components/auth/simple-forms";

export const instant = false;

export const metadata = { title: "Verify your email" };

export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email.slice(0, 254) : "";
  const justSent = params.sent === "1";

  return (
    <AuthCard
      title="Check your inbox"
      description={
        justSent && email ? (
          <>
            We sent a verification link to <span className="font-medium text-foreground">{email}</span>. Open it to activate your account.
          </>
        ) : (
          "Open the verification link we emailed you to activate your account."
        )
      }
      footer={
        <>
          Already verified?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <div className="mb-6 flex items-start gap-3 rounded-2xl border bg-card p-4 text-sm text-muted-foreground shadow-card">
        <MailCheck className="mt-0.5 size-5 shrink-0 text-primary" />
        <p>The link works once and expires after 24 hours. If it isn&rsquo;t in your inbox after a few minutes, check spam or request a new one below.</p>
      </div>
      <ResendVerificationForm initialEmail={email} />
    </AuthCard>
  );
}
