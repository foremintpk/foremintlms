import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Globe } from "lucide-react";
import { CourseGrid } from "@/components/site/course-card";
import { PersonAvatar } from "@/components/site/people";
import { Breadcrumbs, Container, JsonLd } from "@/components/site/primitives";
import { appUrl } from "@/lib/env";
import { getInstructorBySlug } from "@/lib/services/public/catalog";

export const instant = false;

export async function generateMetadata({ params }: PageProps<"/instructors/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await getInstructorBySlug(slug);
  if (!data) return { title: "Instructor not found", robots: { index: false } };
  const { instructor } = data;
  const description = instructor.headline ?? `Courses by ${instructor.public_name} at Foremint Academy.`;
  const url = appUrl(`/instructors/${instructor.slug}`);
  return { title: instructor.public_name, description, alternates: { canonical: url }, openGraph: { title: instructor.public_name, description, url, type: "profile" } };
}

function safeUrl(url: string | null | undefined): string | null {
  return url && /^https:\/\//.test(url) ? url : null;
}

export default async function InstructorPage({ params }: PageProps<"/instructors/[slug]">) {
  const { slug } = await params;
  const data = await getInstructorBySlug(slug);
  if (!data) notFound();
  const { instructor, courses } = data;
  const website = safeUrl(instructor.website_url);
  const socials = Object.entries(instructor.social_links).filter(([, u]) => safeUrl(u));

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Person",
          name: instructor.public_name,
          jobTitle: instructor.headline ?? undefined,
          url: appUrl(`/instructors/${instructor.slug}`),
          knowsAbout: instructor.expertise.length ? instructor.expertise : undefined,
          sameAs: [website, ...socials.map(([, u]) => u)].filter(Boolean),
        }}
      />
      <section className="border-b bg-[linear-gradient(180deg,var(--brand-soft),transparent)]">
        <Container className="py-10 sm:py-14">
          <Breadcrumbs items={[{ label: "Instructors", href: "/instructors" }, { label: instructor.public_name }]} />
          <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-center">
            <PersonAvatar name={instructor.public_name} src={instructor.avatar_url} className="size-28" />
            <div>
              <h1 className="text-[2.2rem] leading-[1.05] font-bold tracking-[-0.03em] sm:text-[3rem]">{instructor.public_name}</h1>
              {instructor.headline ? <p className="mt-2 text-lg text-muted-foreground">{instructor.headline}</p> : null}
              {website || socials.length ? (
                <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  {website ? (
                    <li>
                      <a href={website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
                        <Globe className="size-4" aria-hidden />
                        Website
                      </a>
                    </li>
                  ) : null}
                  {socials.map(([k, u]) => (
                    <li key={k}>
                      <a href={u} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-primary capitalize hover:underline">
                        {k}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </Container>
      </section>
      <Container className="grid gap-12 py-12 lg:grid-cols-[1fr_2fr]">
        <div>
          {instructor.bio ? (
            <>
              <h2 className="text-xl font-semibold">About</h2>
              <p className="mt-3 whitespace-pre-line text-foreground/85">{instructor.bio}</p>
            </>
          ) : null}
          {instructor.expertise.length ? (
            <>
              <h2 className="mt-8 text-xl font-semibold">Expertise</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {instructor.expertise.map((e) => (
                  <li key={e} className="rounded-full bg-muted px-3 py-1 text-sm font-medium">
                    {e}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
        <div>
          <h2 className="mb-6 text-xl font-semibold">Courses</h2>
          {courses.length ? (
            <CourseGrid courses={courses} className="lg:grid-cols-2" />
          ) : (
            <p className="rounded-2xl border border-dashed p-6 text-muted-foreground">{instructor.public_name}&apos;s courses will appear here once they&apos;re published.</p>
          )}
        </div>
      </Container>
    </>
  );
}
