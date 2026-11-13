import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";
import { safeNextPath } from "@/components/auth/utils";
import { getSessionUser } from "@/lib/auth/session";
import { getSetting } from "@/lib/settings";

export const instant = false;

export const metadata = { title: "Create your account" };

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeNextPath(params.next, "") || undefined : undefined;
  if (await getSessionUser()) redirect(next ?? "/learn");
  const showGoogle = await getSetting<boolean>("security.allow_google_login", false);

  return (
    <AuthCard
      title="Create your free account"
      description="Preview lessons, save your progress and enroll when you're ready."
      footer={
        <>
          Already have an account?{" "}
          <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm next={next} showGoogle={showGoogle} />
    </AuthCard>
  );
}
