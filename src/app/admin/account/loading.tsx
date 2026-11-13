import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Loading settings">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-9 w-96 max-w-full" />
      <Skeleton className="h-96 w-full rounded-2xl" />
    </div>
  );
}
