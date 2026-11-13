import { Skeleton } from "@/components/ui/skeleton";

export function MessagesSkeleton() {
  return (
    <div className="flex flex-col" aria-busy="true" aria-label="Loading messages">
      <Skeleton className="mb-2 h-8 w-40" />
      <Skeleton className="mb-4 h-4 w-72" />
      <div className="grid h-[calc(100svh-12.5rem)] min-h-[26rem] overflow-hidden rounded-2xl border bg-card md:h-[calc(100svh-11rem)] md:grid-cols-[minmax(17rem,22rem)_1fr]">
        <div className="space-y-1 border-r p-3">
          <Skeleton className="mb-3 h-9 w-full" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-3 py-2">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-4 p-6 max-md:hidden">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="ml-auto h-12 w-2/5 rounded-2xl" />
          <Skeleton className="h-16 w-1/2 rounded-2xl" />
          <Skeleton className="ml-auto h-10 w-1/3 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 6, title = true }: { rows?: number; title?: boolean }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      {title ? (
        <>
          <Skeleton className="mb-2 h-8 w-48" />
          <Skeleton className="mb-8 h-4 w-80" />
        </>
      ) : null}
      <Skeleton className="mb-4 h-9 w-full max-w-md" />
      <div className="divide-y rounded-2xl border bg-card">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ThreadSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-3/4" />
      <div className="space-y-3 rounded-2xl border bg-card p-5">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/4" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
