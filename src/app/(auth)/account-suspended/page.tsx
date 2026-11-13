import Link from "next/link";
import { Ban } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { getPublicSettings } from "@/lib/settings";

export const metadata = { title: "Account suspended" };

export default async function AccountSuspendedPage() {
  const settings = await getPublicSettings();
  return (
    <AuthCard
      title="This account is suspended"
      description="You can't use courses, messages or billing while your account is suspended. If you think this is a mistake, contact our support team."
    >
      <div className="mb-6 grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
        <Ban className="size-6" />
      </div>
      <div className="grid gap-3 text-sm">
        {settings.supportEmail ? (
          <p>
            Email{" "}
            <a href={`mailto:${settings.supportEmail}`} className="font-semibold text-primary hover:underline">
              {settings.supportEmail}
            </a>{" "}
            with the address you signed up with.
          </p>
        ) : (
          <p>
            Use the{" "}
            <Link href="/contact" className="font-semibold text-primary hover:underline">
              contact form
            </Link>{" "}
            and include the address you signed up with.
          </p>
        )}
        <SignOutButton className="mt-2 h-11 w-full" />
      </div>
    </AuthCard>
  );
}
