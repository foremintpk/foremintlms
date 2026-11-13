import { Container } from "@/components/site/primitives";
import { Skeleton } from "@/components/ui/skeleton";

export default function SiteLoading() {
  return (
    <Container className="py-16" >
      <div aria-busy="true" aria-label="Loading page">
        <Skeleton className="h-12 w-2/3 max-w-xl rounded-xl" />
        <Skeleton className="mt-4 h-5 w-1/2 max-w-md" />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[16/12] rounded-2xl" />
          ))}
        </div>
      </div>
    </Container>
  );
}
