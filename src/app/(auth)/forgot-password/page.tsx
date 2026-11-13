import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/simple-forms";

export const metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      description="Enter the email you signed up with and we'll send you a link to choose a new password."
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
