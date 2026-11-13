import Image from "next/image";
import Link from "next/link";
import type { SectionContent } from "@/lib/cms/sections";
import type { CaseStudyRow, CategorySummary, CourseCard as CourseCardData, InstructorSummary, PublicProduct, TestimonialRow } from "@/lib/services/public/types";
import { cn } from "@/lib/utils";
import { CourseGrid } from "../course-card";
import { FaqList } from "../faq-list";
import { CmsIcon } from "../icons";
import { CaseStudyCard, InstructorCard, TestimonialCard } from "../people";
import { ProductOffer } from "../plan-card";
import { Container, MediaImage, SectionHeading, ctaClass } from "../primitives";

const sectionY = "py-20 sm:py-24";

export function FeaturedCoursesSection({ content, courses }: { content: SectionContent<"featured_courses">; courses: CourseCardData[] }) {
  return (
    <section className={sectionY}>
      <Container>
        <SectionHeading
          title={content.title}
          subtitle={content.subtitle}
          action={
            courses.length ? (
              <Link href="/courses" className={ctaClass("secondary")}>
                Browse all courses
              </Link>
            ) : null
          }
        />
        {courses.length ? (
          <CourseGrid courses={courses} />
        ) : (
          <div className="rounded-3xl border border-dashed bg-card/60 px-6 py-12 text-center sm:px-12">
            <p className="font-heading text-xl font-semibold">The first courses are being prepared</p>
            <p className="mx-auto mt-2 max-w-lg text-muted-foreground">
              Create a free account and we&apos;ll let you know as soon as enrollment opens in the subjects you care about.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/register" className={ctaClass("primary")}>
                Create free account
              </Link>
              <Link href="/courses" className={ctaClass("secondary")}>
                See the subject areas
              </Link>
            </div>
          </div>
        )}
      </Container>
    </section>
  );
}

export function CategoriesSection({ content, categories }: { content: SectionContent<"categories">; categories: CategorySummary[] }) {
  if (categories.length === 0) return null;
  return (
    <section className={cn(sectionY, "bg-card")}>
      <Container>
        <SectionHeading title={content.title} subtitle={content.subtitle} />
        <ul className="grid auto-rows-[200px] gap-4 sm:grid-cols-2 lg:auto-rows-[220px] lg:grid-cols-4">
          {categories.map((c, i) => (
            <li key={c.id} className={cn(i < 2 && "lg:col-span-2 lg:row-span-1", i === 0 && "sm:row-span-2 lg:row-span-2")}>
              <Link
                href={`/categories/${c.slug}`}
                className="group relative flex h-full overflow-hidden rounded-2xl bg-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
              >
                <MediaImage
                  src={c.image_url}
                  alt=""
                  sizes={i < 2 ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 25vw, 50vw"}
                  className="opacity-90 transition-transform duration-500 group-hover:scale-[1.04]"
                />
                <span aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,rgb(21_18_46/0.82))]" />
                <span className="relative mt-auto block p-5 text-white">
                  <span className="block font-heading text-xl font-semibold tracking-tight">{c.name}</span>
                  <span className="mt-1 block text-sm text-white/75">
                    {c.courseCount > 0 ? `${c.courseCount} ${c.courseCount === 1 ? "course" : "courses"}` : "Courses coming soon"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

export function WhySection({ content }: { content: SectionContent<"why"> }) {
  if (content.items.length === 0) return null;
  return (
    <section className={sectionY}>
      <Container className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div>
          <h2 className="text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[2.4rem]">{content.title}</h2>
          <div className="relative mt-8 aspect-[4/3] overflow-hidden rounded-3xl bg-muted max-lg:hidden">
            <Image
              src="/images/about/global-community.jpg"
              alt="Learners collaborating around a table while others join by video"
              fill
              sizes="40vw"
              className="object-cover"
            />
          </div>
        </div>
        <ul className="grid gap-x-10 sm:grid-cols-2">
          {content.items.map((item) => (
            <li key={item.title} className="border-t py-6">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-primary">
                <CmsIcon name={item.icon} className="size-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold tracking-tight">{item.title}</h3>
              <p className="mt-1.5 text-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

export function HowItWorksSection({ content }: { content: SectionContent<"how_it_works"> }) {
  if (content.steps.length === 0) return null;
  return (
    <section className={cn(sectionY, "bg-ink text-white")} aria-labelledby="how-it-works">
      <Container>
        <h2 id="how-it-works" className="max-w-2xl text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[2.4rem]">
          {content.title}
        </h2>
        <ol className="relative mt-12 grid gap-8 md:grid-cols-3 lg:grid-cols-6 lg:gap-5">
          <span aria-hidden className="absolute top-5 right-0 left-0 hidden h-px bg-white/15 lg:block" />
          {content.steps.map((step, i) => (
            <li key={step.title} className="relative flex gap-4 lg:block">
              <span className="relative z-10 grid size-10 shrink-0 place-items-center rounded-full border border-white/20 bg-ink font-heading text-sm font-semibold text-mint">
                {i + 1}
              </span>
              <div className="lg:mt-5">
                <h3 className="text-base font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm text-white/65">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

export function FormatsSection({ content }: { content: SectionContent<"formats"> }) {
  if (content.items.length === 0) return null;
  return (
    <section className={sectionY}>
      <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="relative aspect-[16/11] overflow-hidden rounded-3xl bg-muted">
          <Image
            src="/images/formats/content-creator.jpg"
            alt="A creator recording a video lesson at a desk with a camera and lighting"
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
        <div>
          <h2 className="text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[2.4rem]">{content.title}</h2>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2">
            {content.items.map((item) => (
              <li key={item.title}>
                <CmsIcon name={item.icon} className="size-6 text-primary" />
                <h3 className="mt-3 font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}

export function InstructorsSection({ content, instructors }: { content: SectionContent<"instructors">; instructors: InstructorSummary[] }) {
  if (instructors.length === 0) return null;
  return (
    <section className={cn(sectionY, "bg-card")}>
      <Container>
        <SectionHeading
          title={content.title}
          subtitle={content.subtitle}
          action={
            <Link href="/instructors" className={ctaClass("secondary")}>
              Meet all instructors
            </Link>
          }
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {instructors.map((i) => (
            <InstructorCard key={i.user_id} instructor={i} />
          ))}
        </div>
      </Container>
    </section>
  );
}

export function TestimonialsSection({ content, testimonials }: { content: SectionContent<"testimonials">; testimonials: TestimonialRow[] }) {
  if (testimonials.length === 0) return null;
  return (
    <section className={sectionY}>
      <Container>
        <SectionHeading
          title={content.title}
          subtitle={content.subtitle}
          action={
            <Link href="/testimonials" className={ctaClass("secondary")}>
              Read more
            </Link>
          }
        />
        <div className="columns-1 gap-5 sm:columns-2 lg:columns-3 [&>*]:mb-5 [&>*]:break-inside-avoid">
          {testimonials.map((t) => (
            <TestimonialCard key={t.id} testimonial={t} />
          ))}
        </div>
      </Container>
    </section>
  );
}

export function CaseStudiesSection({ content, studies }: { content: SectionContent<"case_studies">; studies: CaseStudyRow[] }) {
  if (studies.length === 0) return null;
  return (
    <section className={cn(sectionY, "bg-card")}>
      <Container>
        <SectionHeading
          title={content.title}
          subtitle={content.subtitle}
          action={
            <Link href="/case-studies" className={ctaClass("secondary")}>
              All case studies
            </Link>
          }
        />
        <div className="grid gap-6 md:grid-cols-3">
          {studies.map((s) => (
            <CaseStudyCard key={s.id} study={s} />
          ))}
        </div>
      </Container>
    </section>
  );
}

export function PricingSection({ content, products }: { content: SectionContent<"pricing">; products: PublicProduct[] }) {
  if (products.length === 0) return null;
  return (
    <section className={sectionY}>
      <Container>
        <SectionHeading
          title={content.title}
          subtitle={content.subtitle}
          action={
            <Link href="/pricing" className={ctaClass("secondary")}>
              Compare all plans
            </Link>
          }
        />
        <div className={cn("grid gap-6", products.length > 1 && "lg:grid-cols-2")}>
          {products.slice(0, 2).map((p) => (
            <ProductOffer key={p.id} product={p} />
          ))}
        </div>
      </Container>
    </section>
  );
}

export function FaqSection({ content, items }: { content: SectionContent<"faq">; items: { id: string; question: string; answerHtml: string }[] }) {
  if (items.length === 0) return null;
  return (
    <section className={cn(sectionY, "bg-card")}>
      <Container className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <h2 className="text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[2.4rem]">{content.title}</h2>
          <p className="mt-3 text-muted-foreground">
            Can&apos;t find what you need?{" "}
            <Link href="/faq" className="font-medium text-primary hover:underline">
              See all questions
            </Link>{" "}
            or{" "}
            <Link href="/contact" className="font-medium text-primary hover:underline">
              contact us
            </Link>
            .
          </p>
        </div>
        <FaqList items={items} defaultOpenFirst />
      </Container>
    </section>
  );
}

export function FinalCtaSection({ content }: { content: SectionContent<"final_cta"> }) {
  return (
    <section className="py-20 sm:py-24">
      <Container>
        <div className="relative overflow-hidden rounded-[32px] bg-primary px-6 py-14 text-primary-foreground sm:px-14 sm:py-20">
          <Image
            src="/images/hero/abstract-glass.jpg"
            alt=""
            fill
            sizes="(min-width: 1280px) 1200px, 100vw"
            className="object-cover object-right opacity-25 mix-blend-luminosity"
          />
          <div className="relative max-w-2xl">
            <h2 className="text-[2.1rem] leading-[1.04] font-bold tracking-[-0.035em] sm:text-[3rem]">{content.title}</h2>
            {content.body ? <p className="mt-4 text-lg text-white/85">{content.body}</p> : null}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={content.primaryCta.href} className={ctaClass("inverse", "h-12 px-6 text-base")}>
                {content.primaryCta.label}
              </Link>
              {content.secondaryCta ? (
                <Link
                  href={content.secondaryCta.href}
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-white/30 px-6 text-base font-semibold text-white transition-colors hover:bg-white/10"
                >
                  {content.secondaryCta.label}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
