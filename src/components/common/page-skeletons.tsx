import { Skeleton } from "@/components/ui/skeleton";

/** Page title + description placeholder shared by every skeleton. */
function HeaderSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div className="space-y-2.5">
        <Skeleton className="h-8 w-56 rounded-lg" />
        <Skeleton className="h-4 w-80 max-w-[70vw]" />
      </div>
      {action ? <Skeleton className="hidden h-9 w-32 rounded-lg sm:block" /> : null}
    </div>
  );
}

/** List pages: header, toolbar and table rows. */
export function ListPageSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      <HeaderSkeleton action />
      <div className="mb-4 flex flex-wrap gap-2">
        <Skeleton className="h-9 w-72 max-w-full rounded-lg" />
        <Skeleton className="h-9 w-40 rounded-lg" />
        <Skeleton className="h-9 w-40 rounded-lg" />
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex items-center gap-4 border-b bg-muted/40 px-4 py-3">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="ml-auto h-3.5 w-20" />
          <Skeleton className="h-3.5 w-20" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-4 py-3.5 last:border-0">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="hidden h-4 w-20 sm:block" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Dashboards: stat tiles, then two panels. */
export function DashboardSkeleton({ tiles = 4 }: { tiles?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      <HeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: tiles }).map((_, i) => (
          <div key={i} className="rounded-2xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="size-8 rounded-lg" />
            </div>
            <Skeleton className="mt-4 h-7 w-20 rounded-lg" />
            <Skeleton className="mt-2 h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border bg-card p-5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-5 h-56 rounded-xl" />
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <Skeleton className="h-4 w-32" />
          <div className="mt-5 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-9 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Learner home: "continue learning" banner, then course cards. */
export function LearnerHomeSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <HeaderSkeleton />
      <div className="flex flex-col gap-5 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center">
        <Skeleton className="aspect-video w-full rounded-xl sm:w-56" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-6 w-3/4 rounded-lg" />
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-9 w-40 rounded-lg" />
        </div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border bg-card p-5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="mt-3 h-7 w-16 rounded-lg" />
          </div>
        ))}
      </div>
      <CardGrid count={3} className="mt-6" />
    </div>
  );
}

function CardGrid({ count, className = "" }: { count: number; className?: string }) {
  return (
    <div className={`grid gap-5 sm:grid-cols-2 lg:grid-cols-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border bg-card">
          <Skeleton className="aspect-[16/9] rounded-none" />
          <div className="space-y-2.5 p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-4/5 rounded-lg" />
            <Skeleton className="h-3.5 w-3/5" />
            <Skeleton className="mt-4 h-2 w-full rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Grids of course or certificate cards. */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      <HeaderSkeleton />
      <div className="mb-6 flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      <CardGrid count={count} />
    </div>
  );
}

/** A course's overview inside the learner area: banner, curriculum, side panel. */
export function CourseOverviewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="rounded-2xl border bg-card p-6">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="mt-3 h-8 w-2/3 rounded-lg" />
        <Skeleton className="mt-3 h-4 w-1/2" />
        <div className="mt-6 flex items-center gap-4">
          <Skeleton className="h-2 flex-1 rounded-full" />
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-2xl border bg-card p-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-1/2 rounded-lg" />
                <Skeleton className="h-4 w-16" />
              </div>
              {i === 0 ? (
                <div className="mt-4 space-y-3">
                  {Array.from({ length: 4 }).map((__, j) => (
                    <div key={j} className="flex items-center gap-3">
                      <Skeleton className="size-6 rounded-full" />
                      <Skeleton className="h-4 flex-1" />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
        <div className="h-fit rounded-2xl border bg-card p-5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-4 h-24 rounded-xl" />
          <Skeleton className="mt-4 h-3.5 w-3/4" />
          <Skeleton className="mt-2 h-3.5 w-1/2" />
        </div>
      </div>
    </div>
  );
}

/** Editors, quizzes and single-record forms. */
export function FormPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="max-w-3xl">
      <HeaderSkeleton />
      <div className="space-y-5 rounded-2xl border bg-card p-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
        <Skeleton className="h-28 w-full rounded-lg" />
        <div className="flex justify-end gap-2 pt-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
