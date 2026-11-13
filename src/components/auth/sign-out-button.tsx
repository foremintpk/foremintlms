"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";

export function SignOutButton({ className, label = "Sign out" }: { className?: string; label?: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button type="button" variant="outline" className={className} disabled={pending} onClick={() => startTransition(() => signOut())}>
      <LogOut className="size-4" /> {pending ? "Signing out…" : label}
    </Button>
  );
}
