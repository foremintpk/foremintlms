"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** Loading skeleton shared by instructor and live-class pages. */
export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

/** Error boundary body: says what failed and offers a retry. */
export function RouteError({ error, reset, what }: { error: Error & { digest?: string }; reset: () => void; what: string }) {
  return (
    <div role="alert" className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3 rounded-2xl border bg-card p-8 text-center shadow-card">
      <span className="grid size-11 place-items-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-5" />
      </span>
      <h2 className="text-lg font-semibold">{what} couldn&apos;t load</h2>
      <p className="text-sm text-muted-foreground">
        Something went wrong on our side. Try again — if it keeps happening, contact support{error.digest ? ` with reference ${error.digest}` : ""}.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
