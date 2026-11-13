import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseGrid } from "@/components/site/course-card";
import { Breadcrumbs, Container, JsonLd, MediaImage, ctaClass } from "@/components/site/primitives";
import { appUrl } from "@/lib/env";
import { getCategories, getCategoryBySlug } from "@/lib/services/public/catalog";

export const instant = false;

export async function generateMetadata({ params }: PageProps<"/categories/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCategoryBySlug(slug);
  if (!data) return { title: "Category not found", robots: { index: false } };
  const { category } = data;
  const title = category.seo_title ?? `${category.name} courses`;
  const description = category.seo_description ?? category.short_description ?? `Practical ${category.name} courses from Foremint Academy.`;
  const url = appUrl(`/categories/${category.slug}`);
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url } };
}

export default async function CategoryPage({ params }: PageProps<"/categories/[slug]">) {
  const { slug } = await params;
  const data = await getCategoryBySlug(slug);
  if (!data) notFound();
  const { category, courses } = data;
  const others = (await getCategories()).filter((c) => c.slug !== category.slug);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Courses", item: appUrl("/courses") },
            { "@type": "ListItem", position: 2, name: category.name, item: appUrl(`/categories/${category.slug}`) },
          ],
        }}
      />
      <section className="border-b">
        <Container className="grid items-center gap-10 py-10 lg:grid-cols-[1fr_0.9fr] lg:py-14">
          <div>
            <Breadcrumbs items={[{ label: "Courses", href: "/courses" }, { label: category.name }]} />
            <h1 className="mt-6 text-[2.4rem] leading-[1.02] font-bold tracking-[-0.035em] sm:text-[3.4rem]">{category.name}</h1>
            {category.short_description ? <p className="mt-4 max-w-xl text-lg text-muted-foreground">{category.short_description}</p> : null}
            {category.description ? <p className="mt-4 max-w-xl whitespace-pre-line text-foreground/85">{category.description}</p> : null}
          </div>
          <div className="relative aspect-[16/10] overflow-hidden rounded-3xl bg-muted">
            <MediaImage src={category.image_url} alt="" priority sizes="(min-width: 1024px) 45vw, 100vw" />
          </div>
        </Container>
      </section>
      <Container className="py-12 sm:py-16">
        {courses.length ? (
          <>
            <h2 className="mb-6 text-xl font-semibold">
              {courses.length} {courses.length === 1 ? "course" : "courses"}
            </h2>
            <CourseGrid courses={courses} />
          </>
        ) : (
          <div className="rounded-3xl border border-dashed bg-card/60 px-6 py-12 text-center">
            <p className="font-heading text-xl font-semibold">{category.name} courses are being prepared</p>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">Create a free account and we&apos;ll let you know when enrollment opens.</p>
            <Link href="/register" className={ctaClass("primary", "mt-6")}>
              Create free account
            </Link>
          </div>
        )}
        {others.length ? (
          <div className="mt-16 border-t pt-10">
            <h2 className="text-lg font-semibold">Explore other subjects</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {others.map((c) => (
                <li key={c.id}>
                  <Link href={`/categories/${c.slug}`} className="inline-flex h-9 items-center rounded-full border bg-card px-4 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Container>
    </>
  );
}
