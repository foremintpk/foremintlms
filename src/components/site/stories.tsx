import Link from "next/link";
import { RichContent } from "@/components/common/rich-content";
import type { CaseStudyRow, CourseCard as CourseCardData } from "@/lib/services/public/types";
import { formatDate } from "@/lib/format";
import { CourseCard } from "./course-card";
import { CaseStudyCard } from "./people";
import { Breadcrumbs, Container, JsonLd, MediaImage, PageIntro, ctaClass } from "./primitives";
import { appUrl } from "@/lib/env";

const COPY = {
  case_study: {
    title: "Case studies",
    intro: "How learners applied what they studied to real businesses and projects.",
    empty: "We publish case studies only with the people and businesses involved, and only with their consent. The first ones are in progress.",
    base: "/case-studies",
  },
  success_story: {
    title: "Success stories",
    intro: "Personal learning journeys shared by Foremint Academy students.",
    empty: "Success stories are shared by real students with their permission. Check back soon.",
    base: "/success-stories",
  },
} as const;

export function StoryList({ kind, stories }: { kind: "case_study" | "success_story"; stories: CaseStudyRow[] }) {
  const copy = COPY[kind];
  return (
    <>
      <PageIntro title={copy.title} description={copy.intro} />
      <Container className="py-12 sm:py-16">
        {stories.length ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {stories.map((s) => (
              <CaseStudyCard key={s.id} study={s} />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed bg-card/60 px-6 py-12 text-center">
            <p className="font-heading text-xl font-semibold">Nothing published yet</p>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">{copy.empty}</p>
            <Link href="/courses" className={ctaClass("secondary", "mt-6")}>
              Browse courses
            </Link>
          </div>
        )}
      </Container>
    </>
  );
}

/** Plain text with paragraphs, or sanitised HTML when the editor stored HTML. */
function Body({ value }: { value: string | null }) {
  if (!value) return null;
  if (/<[a-z][\s\S]*>/i.test(value)) return <RichContent html={value} />;
  return (
    <div className="prose-foremint">
      {value.split(/\n{2,}/).map((p, i) => (
        <p key={i} className="whitespace-pre-line">
          {p}
        </p>
      ))}
    </div>
  );
}

export function StoryDetail({ story, courses }: { story: CaseStudyRow; courses: CourseCardData[] }) {
  const copy = COPY[story.kind];
  const who = [story.customer_name, story.business_name].filter(Boolean).join(", ");
  const sections: { title: string; body: string | null }[] = [
    { title: "The challenge", body: story.challenge },
    { title: "The approach", body: story.approach },
    { title: "Putting it into practice", body: story.implementation },
    { title: "The outcome", body: story.outcome },
  ];
  const images = story.media.filter((m) => m.url && /^https:\/\//.test(m.url) && (!m.type || m.type === "image"));
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: story.title,
          description: story.summary ?? undefined,
          datePublished: story.published_at ?? undefined,
          url: appUrl(`${copy.base}/${story.slug}`),
          ...(story.cover_image_url ? { image: story.cover_image_url } : {}),
        }}
      />
      <article>
        <header className="border-b">
          <Container className="max-w-4xl py-10 sm:py-14">
            <Breadcrumbs items={[{ label: copy.title, href: copy.base }, { label: story.title }]} />
            {who ? <p className="mt-6 font-medium text-primary">{who}</p> : null}
            <h1 className="mt-2 text-[2.2rem] leading-[1.05] font-bold tracking-[-0.03em] sm:text-[3rem]">{story.title}</h1>
            {story.summary ? <p className="mt-4 text-lg text-muted-foreground">{story.summary}</p> : null}
            {story.published_at ? <p className="mt-4 text-sm text-muted-foreground">Published {formatDate(story.published_at)}</p> : null}
          </Container>
        </header>
        {story.cover_image_url ? (
          <Container className="max-w-5xl pt-10">
            <div className="relative aspect-[16/8] overflow-hidden rounded-3xl bg-muted">
              <MediaImage src={story.cover_image_url} alt="" priority sizes="(min-width: 1024px) 1000px, 100vw" />
            </div>
          </Container>
        ) : null}
        <Container className="max-w-3xl py-12">
          {sections
            .filter((s) => s.body)
            .map((s) => (
              <section key={s.title} className="mb-10">
                <h2 className="mb-4 text-2xl font-semibold tracking-tight">{s.title}</h2>
                <Body value={s.body} />
              </section>
            ))}
          {images.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {images.map((m) => (
                <figure key={m.url}>
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted">
                    <MediaImage src={m.url} alt={m.caption ?? ""} sizes="(min-width: 640px) 380px, 100vw" />
                  </div>
                  {m.caption ? <figcaption className="mt-2 text-sm text-muted-foreground">{m.caption}</figcaption> : null}
                </figure>
              ))}
            </div>
          ) : null}
        </Container>
      </article>
      {courses.length ? (
        <section className="border-t bg-card py-14">
          <Container>
            <h2 className="mb-6 text-xl font-semibold">Courses mentioned in this story</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((c) => (
                <CourseCard key={c.id} course={c} />
              ))}
            </div>
          </Container>
        </section>
      ) : null}
    </>
  );
}
