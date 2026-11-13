"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * Refreshes the server-rendered confirmation page every few seconds while
 * the payment provider confirms the purchase. The page itself decides what
 * to show; this component only asks it to re-check.
 */
export function CheckoutStatusPoller({ intervalMs = 3000, maxAttempts = 20 }: { intervalMs?: number; maxAttempts?: number }) {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);
  const done = attempts >= maxAttempts;

  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => {
      router.refresh();
      setAttempts((a) => a + 1);
    }, intervalMs);
    return () => clearTimeout(t);
  }, [attempts, done, intervalMs, router]);

  if (done) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Confirmation is taking longer than usual. You don&apos;t need to stay on this page — we&apos;ll email you as soon as your access is ready, and it
        will appear under My courses.
      </p>
    );
  }
  return (
    <p className="inline-flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      Waiting for the payment provider to confirm…
    </p>
  );
}
