import Link from "next/link";
import { ShieldX } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { getSessionUser, homePathFor } from "@/lib/auth/session";

export const instant = false;

export const metadata = { title: "Access denied" };

export default async function AccessDeniedPage() {
  const user = await getSessionUser();
  return (
    <AuthCard
      title="You don't have access to that page"
      description={
        user
          ? `You're signed in as ${user.email}. This area needs a different role. If you think you should have access, ask an administrator.`
          : "Sign in with an account that has access to this area."
      }
    >
      <div className="mb-6 grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
        <ShieldX className="size-6" />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        {user ? (
          <Button asChild className="h-11 flex-1">
            <Link href={homePathFor(user)}>Go to my dashboard</Link>
          </Button>
        ) : (
          <Button asChild className="h-11 flex-1">
            <Link href="/login">Sign in</Link>
          </Button>
        )}
        <Button asChild variant="outline" className="h-11 flex-1">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </AuthCard>
  );
}
