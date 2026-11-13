import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Loading notifications">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-8 w-40 rounded-full" />
      <div className="grid gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
