import Image from "next/image";
import Link from "next/link";
import { PlayCircle, Radio, Rocket, Sprout, TrendingUp, type LucideIcon } from "lucide-react";
import type { SectionContent } from "@/lib/cms/sections";
import { cn } from "@/lib/utils";
import { Container, ctaClass } from "../primitives";

/** Split the headline into its sentences so each can step forward. */
function headlineLines(headline: string): string[] {
  const parts = headline.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : [headline];
}

/**
 * Each line after the first steps forward. The step is filled by an icon
 * tile, joined to the previous step by a dotted connector, so the stagger
 * reads as a path forward instead of empty space.
 */
const STEP_ICONS: { icon: LucideIcon; tile: string }[] = [
  { icon: Sprout, tile: "bg-mint-soft text-mint-strong" },
  { icon: TrendingUp, tile: "bg-brand-soft text-primary" },
  { icon: Rocket, tile: "bg-warning-soft text-warning" },
];

function StepMarker({ index }: { index: number }) {
  const step = STEP_ICONS[(index - 1) % STEP_ICONS.length];
  const Icon = step.icon;
  return (
    <span aria-hidden className="mr-[0.22em] hidden shrink-0 items-center sm:inline-flex">
      {Array.from({ length: index - 1 }).map((_, i) => (
        <span key={i} className="mx-[0.06em] block h-0 w-[0.62em] border-t-[3px] border-dotted border-primary/30" />
      ))}
      <span className={cn("grid size-[0.74em] place-items-center rounded-[0.2em] shadow-card", step.tile)}>
        <Icon className="size-[0.42em]" strokeWidth={2.4} />
      </span>
    </span>
  );
}

/**
 * The home hero. The headline steps forward line by line (a typographic
 * nod to "fore"), and real interface fragments sit over the photograph to
 * show the product rather than decorate it. One load sequence, no loops.
 */
export function Hero({ content, subjectCount }: { content: SectionContent<"hero">; subjectCount: number }) {
  const lines = headlineLines(content.headline);
  const isLocalImage = content.image.startsWith("/");
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 right-[-10%] h-[620px] w-[620px] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--brand)_14%,transparent),transparent)]"
      />
      <Container className="relative grid items-center gap-12 pt-12 pb-16 sm:pt-16 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10 lg:pt-20 lg:pb-24">
        <div>
          <h1 className="font-heading text-[2.6rem] leading-[1.02] font-bold tracking-[-0.045em] text-foreground sm:text-[3.1rem] lg:text-[3rem] xl:text-[3.6rem]">
            {lines.map((line, i) => (
              <span
                key={`${i}-${line}`}
                className="flex animate-rise items-center sm:whitespace-nowrap"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                {i > 0 ? <StepMarker index={i} /> : null}
                <span>{line}</span>
              </span>
            ))}
          </h1>
          <p className="mt-7 max-w-xl animate-rise text-lg text-muted-foreground sm:text-xl" style={{ animationDelay: `${lines.length * 90 + 40}ms` }}>
            {content.subheadline}
          </p>
          <div className="mt-9 flex animate-rise flex-col gap-3 sm:flex-row" style={{ animationDelay: `${lines.length * 90 + 120}ms` }}>
            <Link href={content.primaryCta.href} className={ctaClass("primary", "h-12 px-6 text-base")}>
              {content.primaryCta.label}
            </Link>
            <Link href={content.secondaryCta.href} className={ctaClass("secondary", "h-12 px-6 text-base")}>
              {content.secondaryCta.label}
            </Link>
          </div>
          <dl className="mt-10 grid max-w-lg animate-rise grid-cols-3 gap-4 border-t pt-6 text-sm" style={{ animationDelay: `${lines.length * 90 + 200}ms` }}>
            {subjectCount > 0 ? (
              <div>
                <dt className="text-muted-foreground">Subject areas</dt>
                <dd className="mt-1 font-heading text-xl font-semibold">{subjectCount}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-muted-foreground">Formats</dt>
              <dd className="mt-1 font-medium">Video, live, practice</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Pace</dt>
              <dd className="mt-1 font-medium">Learn on your schedule</dd>
            </div>
          </dl>
        </div>

        <div className="relative mx-auto w-full max-w-[560px] lg:max-w-none">
          <div className="relative aspect-[4/5] animate-rise overflow-hidden rounded-[28px] bg-muted shadow-raised sm:aspect-[5/4] lg:aspect-[4/5]" style={{ animationDelay: "180ms" }}>
            {isLocalImage ? (
              <Image
                src={content.image}
                alt={
                  content.image === "/images/hero/hero-entrepreneur.jpg"
                    ? "A learner smiling at her laptop in a home studio lit in violet, with shipping boxes and a sales chart behind her"
                    : ""
                }
                fill
                priority
                sizes="(min-width: 1024px) 45vw, 100vw"
                className="object-cover object-[60%_center]"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={content.image} alt="" className="absolute inset-0 size-full object-cover" />
            )}
            <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgb(21_18_46/0.35))]" />
          </div>

          {/* Product fragments: illustrative interface, not data about real learners. */}
          <div
            aria-hidden
            className="absolute top-6 -right-2 w-[min(250px,62%)] animate-rise rounded-2xl border bg-popover/95 p-4 shadow-raised backdrop-blur sm:-right-5"
            style={{ animationDelay: "420ms" }}
          >
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span className="grid size-6 place-items-center rounded-md bg-brand-soft text-primary">
                <Radio className="size-3.5" />
              </span>
              Live workshop
            </div>
            <p className="mt-2 text-sm leading-snug font-semibold text-foreground">Questions answered live, recordings after</p>
            <p className="mt-1 text-xs text-muted-foreground">Join from your dashboard on Zoom or Google Meet</p>
          </div>

          <div
            aria-hidden
            className="absolute -bottom-6 left-2 w-[min(290px,78%)] animate-rise rounded-2xl border bg-popover p-4 shadow-raised sm:-left-8"
            style={{ animationDelay: "520ms" }}
          >
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                <PlayCircle className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Continue learning</p>
                <p className="truncate text-sm font-semibold text-foreground">Lesson 4 · Pricing your first product</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-[62%] rounded-full bg-mint" />
              </div>
              <span className="text-xs font-semibold text-mint-strong tabular-nums">62%</span>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
