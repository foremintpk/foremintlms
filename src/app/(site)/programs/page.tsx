import type { Metadata } from "next";
import Link from "next/link";
import { Container, MediaImage, PageIntro, ctaClass } from "@/components/site/primitives";
import { appUrl } from "@/lib/env";
import { getPrograms } from "@/lib/services/public/catalog";
import { LEVEL_LABEL } from "@/lib/services/public/shape";

export const metadata: Metadata = {
  title: "Learning programs",
  description: "Structured learning paths that combine courses into a clear sequence toward a goal.",
  alternates: { canonical: appUrl("/programs") },
};

export default async function ProgramsPage() {
  const programs = await getPrograms();
  return (
    <>
      <PageIntro title="Learning programs" description="Courses arranged in a clear order toward a goal, so you always know what to learn next." />
      <Container className="py-12 sm:py-16">
        {programs.length ? (
          <ul className="grid gap-6 md:grid-cols-2">
            {programs.map((p) => (
              <li key={p.id}>
                <Link href={`/programs/${p.slug}`} className="group flex h-full flex-col overflow-hidden rounded-3xl border bg-card transition-colors hover:border-primary/30 sm:flex-row">
                  <div className="relative aspect-[16/10] bg-muted sm:aspect-auto sm:w-2/5">
                    <MediaImage src={p.image_url} alt="" sizes="(min-width: 768px) 20vw, 100vw" />
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <p className="text-sm text-muted-foreground">
                      {p.courseCount} {p.courseCount === 1 ? "course" : "courses"}, {LEVEL_LABEL[p.level].toLowerCase()}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold tracking-tight group-hover:text-primary">{p.title}</h2>
                    {p.summary ? <p className="mt-2 text-muted-foreground">{p.summary}</p> : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-3xl border border-dashed bg-card/60 px-6 py-12 text-center">
            <p className="font-heading text-xl font-semibold">Programs are being put together</p>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">In the meantime, browse individual courses by subject.</p>
            <Link href="/courses" className={ctaClass("primary", "mt-6")}>
              Browse courses
            </Link>
          </div>
        )}
      </Container>
    </>
  );
}
