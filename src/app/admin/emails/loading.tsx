import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Loading email settings">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-9 w-80" />
      <div className="grid gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
