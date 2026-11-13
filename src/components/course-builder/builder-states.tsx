"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function BuilderLoading() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-9 w-80 max-w-full" />
      <Skeleton className="h-10 w-full" />
      <div className="grid gap-3 pt-2">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export function BuilderError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div role="alert" className="grid place-items-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
      <span className="grid size-11 place-items-center rounded-2xl bg-destructive/10 text-destructive">
        <TriangleAlert className="size-5" />
      </span>
      <h2 className="text-base font-semibold">This page couldn&apos;t load</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Something went wrong while loading the course. Try again; if it keeps happening, contact support
        {error.digest ? ` and mention reference ${error.digest}` : ""}.
      </p>
      <Button variant="outline" onClick={reset}>
        <RotateCcw /> Try again
      </Button>
    </div>
  );
}
