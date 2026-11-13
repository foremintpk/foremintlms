"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Route-level error state for communication screens. */
export function SectionError({ title, reset }: { title: string; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3 rounded-2xl border bg-card p-8 text-center shadow-card">
      <span className="grid size-11 place-items-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-5" />
      </span>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">
        Something went wrong on our side. Try again — if it keeps happening, check your connection or contact support.
      </p>
      <Button onClick={reset} variant="outline" size="sm">
        <RotateCcw className="size-4" /> Try again
      </Button>
    </div>
  );
}
