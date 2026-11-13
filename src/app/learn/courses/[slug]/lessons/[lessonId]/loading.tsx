import { Skeleton } from "@/components/ui/skeleton";

export default function LessonLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-2" aria-busy="true" aria-label="Loading lesson">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="aspect-video w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
    </div>
  );
}
