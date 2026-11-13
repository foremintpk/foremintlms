import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Container, MediaImage, ctaClass } from "@/components/site/primitives";
import { appUrl } from "@/lib/env";
import { sectionSchemas } from "@/lib/cms/sections";
import { getCategories } from "@/lib/services/public/catalog";
import { getCmsPage } from "@/lib/services/public/content";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getCmsPage("about");
  const title = page.seo_title ?? "About Foremint Academy";
  const description = page.seo_description ?? "Why Foremint Academy exists, how we teach and who we teach.";
  return { title: { absolute: title }, description, alternates: { canonical: appUrl("/about") }, openGraph: { title, description, url: appUrl("/about") } };
}

export default async function AboutPage() {
  const [page, categories] = await Promise.all([getCmsPage("about"), getCategories()]);
  const intro = page.sections.intro?.visible ? page.sections.intro.content : null;
  const mission = page.sections.mission?.visible ? page.sections.mission.content : null;
  const approach = page.sections.approach?.visible ? page.sections.approach.content : null;
  const fallbackIntro = sectionSchemas.intro.safeParse({
    title: "Education for people who build",
    body: "Foremint Academy teaches the practical skills behind online businesses and digital careers.",
  });
  const hero = intro ?? (fallbackIntro.success ? fallbackIntro.data : null);

  return (
    <>
      {hero ? (
        <section className="border-b">
          <Container className="grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <h1 className="text-[2.6rem] leading-[1] font-bold tracking-[-0.04em] sm:text-[3.8rem]">{hero.title}</h1>
              <p className="mt-6 max-w-xl text-lg whitespace-pre-line text-muted-foreground">{hero.body}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/courses" className={ctaClass("primary")}>
                  Explore courses
                </Link>
                <Link href="/contact" className={ctaClass("secondary")}>
                  Contact us
                </Link>
              </div>
            </div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] bg-muted">
              <MediaImage src={hero.image ?? "/images/about/team-collaboration.jpg"} alt="" priority sizes="(min-width: 1024px) 45vw, 100vw" />
            </div>
          </Container>
        </section>
      ) : null}

      {mission && mission.items.length ? (
        <section className="py-20">
          <Container>
            <h2 className="max-w-2xl text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[2.4rem]">{mission.title}</h2>
            <ul className="mt-10 grid gap-8 md:grid-cols-3">
              {mission.items.map((m) => (
                <li key={m.title} className="border-t-2 border-primary pt-5">
                  <h3 className="text-lg font-semibold">{m.title}</h3>
                  <p className="mt-2 text-muted-foreground">{m.body}</p>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      ) : null}

      {approach ? (
        <section className="bg-card py-20">
          <Container className="grid items-center gap-12 lg:grid-cols-2">
            <div className="relative aspect-[16/10] overflow-hidden rounded-[28px] bg-muted lg:order-last">
              <MediaImage src={approach.image ?? "/images/about/global-community.jpg"} alt="" sizes="(min-width: 1024px) 50vw, 100vw" />
            </div>
            <div>
              <h2 className="text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[2.4rem]">{approach.title}</h2>
              <p className="mt-5 text-lg whitespace-pre-line text-muted-foreground">{approach.body}</p>
            </div>
          </Container>
        </section>
      ) : null}

      <section className="py-20">
        <Container>
          <div className="grid items-end gap-8 lg:grid-cols-[1fr_auto]">
            <div>
              <h2 className="text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[2.4rem]">What we teach</h2>
              <p className="mt-3 max-w-2xl text-muted-foreground">Subjects chosen for people building businesses and careers online.</p>
            </div>
            <Link href="/courses" className={ctaClass("secondary")}>
              Browse all courses
            </Link>
          </div>
          {categories.length ? (
            <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {categories.map((c) => (
                <li key={c.id}>
                  <Link href={`/categories/${c.slug}`} className="flex h-full flex-col rounded-2xl border bg-card p-4 transition-colors hover:border-primary/40">
                    <span className="font-semibold">{c.name}</span>
                    {c.short_description ? <span className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.short_description}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </Container>
      </section>

      <section className="pb-20">
        <Container>
          <div className="grid gap-4 sm:grid-cols-3">
            {["/images/about/mentor-1.jpg", "/images/about/mentor-2.jpg", "/images/about/mentor-3.jpg"].map((src) => (
              <div key={src} className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-muted max-sm:hidden first:max-sm:block">
                <Image src={src} alt="" fill sizes="(min-width: 640px) 33vw, 100vw" className="object-cover" />
              </div>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
