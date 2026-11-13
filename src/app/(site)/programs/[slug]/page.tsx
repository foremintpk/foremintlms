import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CourseCard } from "@/components/site/course-card";
import { RichContent } from "@/components/common/rich-content";
import { Breadcrumbs, Container, JsonLd, MediaImage } from "@/components/site/primitives";
import { appUrl } from "@/lib/env";
import { getProgramBySlug } from "@/lib/services/public/catalog";
import { LEVEL_LABEL } from "@/lib/services/public/shape";

export const instant = false;

export async function generateMetadata({ params }: PageProps<"/programs/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const program = await getProgramBySlug(slug);
  if (!program) return { title: "Program not found", robots: { index: false } };
  const url = appUrl(`/programs/${program.slug}`);
  const description = program.summary ?? `A structured learning program from Foremint Academy.`;
  return { title: program.title, description, alternates: { canonical: url }, openGraph: { title: program.title, description, url } };
}

export default async function ProgramPage({ params }: PageProps<"/programs/[slug]">) {
  const { slug } = await params;
  const program = await getProgramBySlug(slug);
  if (!program) notFound();

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: program.title,
          itemListElement: program.courses.map((c, i) => ({ "@type": "ListItem", position: i + 1, url: appUrl(`/courses/${c.slug}`), name: c.title })),
        }}
      />
      <section className="border-b">
        <Container className="grid items-center gap-10 py-10 lg:grid-cols-[1fr_0.8fr] lg:py-14">
          <div>
            <Breadcrumbs items={[{ label: "Programs", href: "/programs" }, { label: program.title }]} />
            <h1 className="mt-6 text-[2.4rem] leading-[1.02] font-bold tracking-[-0.035em] sm:text-[3.2rem]">{program.title}</h1>
            {program.summary ? <p className="mt-4 max-w-xl text-lg text-muted-foreground">{program.summary}</p> : null}
            <p className="mt-4 text-sm text-muted-foreground">
              {program.courseCount} {program.courseCount === 1 ? "course" : "courses"}, {LEVEL_LABEL[program.level].toLowerCase()}
            </p>
          </div>
          {program.image_url ? (
            <div className="relative aspect-[16/10] overflow-hidden rounded-3xl bg-muted">
              <MediaImage src={program.image_url} alt="" priority sizes="(min-width: 1024px) 40vw, 100vw" />
            </div>
          ) : null}
        </Container>
      </section>
      <Container className="py-12 sm:py-16">
        {program.description ? <RichContent html={program.description} className="mb-12" /> : null}
        <h2 className="mb-8 text-2xl font-semibold tracking-tight">The path, step by step</h2>
        {program.courses.length ? (
          <ol className="grid gap-8">
            {program.courses.map((c, i) => (
              <li key={c.id} className="grid gap-4 md:grid-cols-[64px_1fr]">
                <div className="flex items-center gap-3 md:flex-col md:items-start">
                  <span className="grid size-11 place-items-center rounded-full bg-primary font-heading text-sm font-semibold text-primary-foreground">{i + 1}</span>
                  <span className="text-xs text-muted-foreground">{c.is_required ? "Required" : "Optional"}</span>
                </div>
                <CourseCard course={c} className="md:max-w-xl" />
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-2xl border border-dashed p-6 text-muted-foreground">The courses in this program will appear once they&apos;re published.</p>
        )}
      </Container>
    </>
  );
}
