import Link from "next/link";
import { Quote } from "lucide-react";
import { initials } from "@/lib/format";
import type { CaseStudyRow, InstructorSummary, TestimonialRow } from "@/lib/services/public/types";
import { cn } from "@/lib/utils";
import { MediaImage, RatingStars } from "./primitives";

export function PersonAvatar({ name, src, className }: { name: string; src: string | null; className?: string }) {
  return (
    <span className={cn("relative inline-flex size-12 shrink-0 overflow-hidden rounded-full bg-brand-soft", className)}>
      {src ? (
        <MediaImage src={src} alt="" sizes="96px" />
      ) : (
        <span className="m-auto font-heading text-sm font-semibold text-primary">{initials(name)}</span>
      )}
    </span>
  );
}

export function InstructorCard({ instructor, className }: { instructor: InstructorSummary; className?: string }) {
  return (
    <article className={cn("group relative flex h-full flex-col rounded-2xl border bg-card p-5 transition-colors hover:border-primary/30", className)}>
      <PersonAvatar name={instructor.public_name} src={instructor.avatar_url} className="size-16" />
      <h3 className="mt-4 text-lg font-semibold tracking-tight">
        <Link href={`/instructors/${instructor.slug}`} className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline">
          {instructor.public_name}
        </Link>
      </h3>
      {instructor.headline ? <p className="mt-1 text-sm text-muted-foreground">{instructor.headline}</p> : null}
      {instructor.expertise.length ? (
        <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Expertise">
          {instructor.expertise.slice(0, 4).map((e) => (
            <li key={e} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground/80">
              {e}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function TestimonialCard({ testimonial, className }: { testimonial: TestimonialRow; className?: string }) {
  const meta = [testimonial.person_role, testimonial.company].filter(Boolean).join(", ");
  return (
    <figure className={cn("flex h-full flex-col rounded-2xl border bg-card p-6", className)}>
      <Quote className="size-6 text-primary/40" aria-hidden />
      {testimonial.rating ? <RatingStars value={testimonial.rating} className="mt-3" /> : null}
      <blockquote className="mt-3 flex-1 text-[1.02rem] leading-relaxed text-foreground/90">{testimonial.quote}</blockquote>
      <figcaption className="mt-6 flex items-center gap-3">
        <PersonAvatar name={testimonial.person_name} src={testimonial.avatar_url} className="size-10" />
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{testimonial.person_name}</span>
          {meta ? <span className="block text-sm text-muted-foreground">{meta}</span> : null}
          {testimonial.course ? (
            <Link href={`/courses/${testimonial.course.slug}`} className="block text-xs text-primary hover:underline">
              {testimonial.course.title}
            </Link>
          ) : null}
        </span>
      </figcaption>
    </figure>
  );
}

export function CaseStudyCard({ study, className }: { study: CaseStudyRow; className?: string }) {
  const base = study.kind === "success_story" ? "/success-stories" : "/case-studies";
  const who = [study.customer_name, study.business_name].filter(Boolean).join(", ");
  return (
    <article className={cn("group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card", className)}>
      <div className="relative aspect-[16/9] bg-muted">
        <MediaImage src={study.cover_image_url} alt="" sizes="(min-width: 1024px) 33vw, 100vw" className="transition-transform duration-500 group-hover:scale-[1.03]" />
      </div>
      <div className="flex flex-1 flex-col p-5">
        {who ? <p className="text-sm font-medium text-primary">{who}</p> : null}
        <h3 className="mt-1.5 text-lg leading-snug font-semibold tracking-tight">
          <Link href={`${base}/${study.slug}`} className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline">
            {study.title}
          </Link>
        </h3>
        {study.summary ? <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{study.summary}</p> : null}
        <span aria-hidden className="mt-auto pt-4 text-sm font-semibold text-primary">
          Read the story
        </span>
      </div>
    </article>
  );
}
