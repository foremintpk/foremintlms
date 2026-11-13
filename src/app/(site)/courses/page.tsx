import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SearchX } from "lucide-react";
import { CourseGrid } from "@/components/site/course-card";
import { CatalogFilters } from "@/components/site/catalog-filters";
import { Container, PageIntro, SimplePagination, ctaClass } from "@/components/site/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { appUrl } from "@/lib/env";
import { CATALOG_PAGE_SIZE, getCategories, searchCourses } from "@/lib/services/public/catalog";
import { parseCatalogQuery } from "@/lib/services/public/shape";

export const metadata: Metadata = {
  title: "Courses",
  description:
    "Browse practical courses in Amazon FBA, e-commerce, eBay selling, company formation, Shopify, WordPress, SEO, web and app development and digital marketing.",
  alternates: { canonical: appUrl("/courses") },
  openGraph: { title: "Courses · Foremint Academy", url: appUrl("/courses") },
};

function ResultsSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading courses">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border bg-card">
          <Skeleton className="aspect-[16/10] w-full rounded-none" />
          <div className="space-y-3 p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

async function Results({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const query = parseCatalogQuery(raw);
  const { courses, total } = await searchCourses(query);
  const filtered = Boolean(query.q || query.category || query.level || query.price);

  const hrefFor = (page: number) => {
    const p = new URLSearchParams();
    if (query.q) p.set("q", query.q);
    if (query.category) p.set("category", query.category);
    if (query.level) p.set("level", query.level);
    if (query.price) p.set("price", query.price);
    if (query.sort !== "featured") p.set("sort", query.sort);
    if (page > 1) p.set("page", String(page));
    const s = p.toString();
    return `/courses${s ? `?${s}` : ""}`;
  };

  if (courses.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed bg-card/60 px-6 py-14 text-center">
        <SearchX className="mx-auto size-8 text-muted-foreground" aria-hidden />
        <p className="mt-4 font-heading text-xl font-semibold">{filtered ? "No courses match these filters" : "Courses are on their way"}</p>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          {filtered
            ? "Try a broader search or clear the filters to see everything that's available."
            : "We're preparing the first courses now. Create a free account to hear when enrollment opens."}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          {filtered ? (
            <Link href="/courses" className={ctaClass("secondary")}>
              Clear filters
            </Link>
          ) : (
            <Link href="/register" className={ctaClass("primary")}>
              Create free account
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <p className="mb-6 text-sm text-muted-foreground" aria-live="polite">
        {total} {total === 1 ? "course" : "courses"}
        {query.q ? (
          <>
            {" "}
            for “<span className="font-medium text-foreground">{query.q}</span>”
          </>
        ) : null}
      </p>
      <CourseGrid courses={courses} />
      <SimplePagination page={query.page} total={total} pageSize={CATALOG_PAGE_SIZE} hrefFor={hrefFor} />
    </>
  );
}

export default async function CoursesPage({ searchParams }: PageProps<"/courses">) {
  const categories = await getCategories();
  return (
    <>
      <PageIntro
        title="Find the skill that moves you forward"
        description="Practical courses for building online businesses and digital careers. Filter by subject, level or price."
      />
      <Container className="py-12 sm:py-16">
        <CatalogFilters categories={categories.map((c) => ({ value: c.slug, label: c.name }))} />
        <Suspense fallback={<ResultsSkeleton />}>
          <Results searchParams={searchParams} />
        </Suspense>
      </Container>
    </>
  );
}
