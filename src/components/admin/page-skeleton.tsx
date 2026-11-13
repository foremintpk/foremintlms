import { Skeleton } from "@/components/ui/skeleton";

/** Loading state for admin list pages: header, toolbar and table rows. */
export function ListPageSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="mb-8 space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="mb-4 flex gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="mb-8 space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[118px] rounded-2xl" />
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}

export function FormPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="max-w-3xl space-y-4">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <Skeleton className="mt-6 h-64 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
    </div>
  );
}
