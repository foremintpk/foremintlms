"use client";

import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shared error state for learner routes (used by error.tsx files). */
export function RouteError({ reset, title = "This page couldn't load" }: { reset: () => void; title?: string }) {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" />
      </span>
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">
          Something went wrong on our side. Try again — your progress is saved. If it keeps happening, contact support.
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={reset}>
          <RotateCcw /> Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/learn">Go to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
