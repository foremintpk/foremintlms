"use client";

import Link from "next/link";
import { Check, Layers, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOptionalCart } from "./cart-provider";

/** Course page: add this course to the shared learning package (selector / checkout / advisor). */
export function AddToPlanButton({ courseId, courseTitle, className }: { courseId: string; courseTitle: string; className?: string }) {
  const cart = useOptionalCart();
  if (!cart) return null;
  const selected = cart.has(courseId);
  const pending = cart.pendingIds.has(courseId);
  const count = cart.cart?.courseIds.length ?? 0;
  return (
    <div className={cn("grid gap-2", className)}>
      <button
        type="button"
        aria-pressed={selected}
        disabled={pending}
        onClick={() => void (selected ? cart.remove(courseId) : cart.add([courseId]))}
        className={cn(
          "inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 outline-none disabled:opacity-60",
          selected ? "border-primary bg-brand-soft text-primary" : "border-primary/30 bg-background text-primary hover:border-primary hover:bg-brand-soft/60",
        )}
        data-testid="add-to-plan"
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : selected ? <Check className="size-4" aria-hidden /> : <Layers className="size-4" aria-hidden />}
        {selected ? "In your learning package" : "Add to learning package"}
        <span className="sr-only"> — {courseTitle}</span>
      </button>
      {count > 0 ? (
        <Link href="/courses/select" className="text-center text-xs font-medium text-muted-foreground hover:text-foreground">
          {count} {count === 1 ? "course" : "courses"} in your package · Review package
        </Link>
      ) : (
        <p className="text-center text-xs text-muted-foreground">Combine several courses and pay once.</p>
      )}
    </div>
  );
}
