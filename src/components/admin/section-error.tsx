"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shared body for admin error.tsx boundaries. */
export function SectionError({ reset, title = "This page couldn't load" }: { reset: () => void; title?: string }) {
  return (
    <div className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3 rounded-2xl border bg-card p-8 text-center shadow-card">
      <span className="grid size-11 place-items-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-5" />
      </span>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">
        The data could not be loaded. Try again; if it keeps failing, check the database connection in your hosting logs.
      </p>
      <Button onClick={reset} variant="outline" size="sm">
        <RotateCcw /> Try again
      </Button>
    </div>
  );
}
