import Link from "next/link";
import { redirect } from "next/navigation";
import { Hourglass } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";

export const instant = false;

export const metadata = { title: "Invitation accepted", robots: { index: false, follow: false } };

export default async function InvitationAcceptedPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.teacherStatus === "approved") redirect("/teach");

  return (
    <AuthCard
      title="You're in — approval is the last step"
      description="Thanks for accepting your instructor invitation. An administrator will review your account shortly, and we'll email you as soon as your teaching tools are unlocked."
    >
      <div className="mb-6 grid size-12 place-items-center rounded-2xl bg-brand-soft text-primary">
        <Hourglass className="size-6" />
      </div>
      <div className="grid gap-2">
        <Button asChild className="h-11 w-full">
          <Link href="/learn/settings">Complete your profile</Link>
        </Button>
        <Button asChild variant="outline" className="h-11 w-full">
          <Link href="/learn">Go to the student workspace</Link>
        </Button>
      </div>
    </AuthCard>
  );
}
