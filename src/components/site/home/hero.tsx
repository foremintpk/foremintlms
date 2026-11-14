import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Award, BookOpen, Layers, PlayCircle, Radio, Sparkles } from "lucide-react";
import type { SectionContent } from "@/lib/cms/sections";
import { cn } from "@/lib/utils";
import { Container, ctaClass } from "../primitives";

/** Split the headline into its sentences so the last one can carry the accent. */
function headlineLines(headline: string): string[] {
  const parts = headline.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : [headline];
}

/**
 * The home hero. Copy, calls to action and the photograph come from the CMS
 * (Admin → Website content → Hero). The numbers and topic links are real
 * catalogue data; the floating cards illustrate product features and are
 * hidden from assistive technology.
 */
export function Hero({
  content,
  subjectCount,
  courseCount = 0,
  topics = [],
}: {
  content: SectionContent<"hero">;
  subjectCount: number;
  courseCount?: number;
  topics?: { slug: string; name: string }[];
}) {
  const lines = headlineLines(content.headline);
  const isLocalImage = content.image.startsWith("/");
  const delay = (i: number) => ({ animationDelay: `${i * 80}ms` });

  return (
    <section className="relative isolate -mt-[4.25rem] overflow-hidden pt-[4.25rem]">
      {/* Atmosphere: soft brand mesh + a faint grid that fades out toward the edges. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-48 right-[-12%] h-[720px] w-[720px] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--brand)_22%,transparent),transparent)] blur-2xl" />
        <div className="absolute top-24 -left-48 h-[520px] w-[520px] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,#3b82f6_14%,transparent),transparent)] blur-2xl" />
        <div className="absolute -bottom-40 left-1/3 h-[420px] w-[620px] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--mint)_14%,transparent),transparent)] blur-2xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_oklch,var(--ink)_6%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklch,var(--ink)_6%,transparent)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_30%,black,transparent)] bg-[size:56px_56px]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
      </div>

      <Container className="relative grid items-center gap-14 pt-10 pb-20 sm:pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:pt-20 lg:pb-28">
        <div>
          <Link
            href="/courses/select"
            className="group inline-flex animate-rise items-center gap-2 rounded-full border border-primary/15 bg-card/70 py-1 pr-3 pl-1 text-sm font-medium text-foreground/80 shadow-card backdrop-blur transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
              <Sparkles className="size-3" aria-hidden /> New
            </span>
            Build your own learning plan
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>

          <h1 className="mt-7 font-heading text-[2.6rem] leading-[1.02] font-bold tracking-[-0.045em] text-foreground sm:text-[3.3rem] lg:text-[3.15rem] xl:text-[3.6rem]">
            {lines.map((line, i) => {
              const last = i === lines.length - 1 && lines.length > 1;
              return (
                <span key={`${i}-${line}`} className="block animate-rise sm:whitespace-nowrap" style={delay(i + 1)}>
                  {last ? (
                    <span className="bg-[linear-gradient(100deg,var(--brand)_10%,#3b6cff_55%,var(--brand-strong)_90%)] box-decoration-clone bg-clip-text text-transparent underline decoration-primary/25 decoration-[5px] underline-offset-[14px]">
                      {line}
                    </span>
                  ) : (
                    line
                  )}
                </span>
              );
            })}
          </h1>

          <p className="mt-7 max-w-xl animate-rise text-lg leading-relaxed text-muted-foreground sm:text-xl" style={delay(lines.length + 1)}>
            {content.subheadline}
          </p>

          <div className="mt-9 flex animate-rise flex-col gap-3 sm:flex-row" style={delay(lines.length + 2)}>
            <Link
              href={content.primaryCta.href}
              className={ctaClass("primary", "group h-12 bg-[linear-gradient(135deg,var(--brand),var(--brand-strong))] px-6 text-base shadow-[0_10px_30px_-10px_rgb(91_61_245/0.7)] hover:brightness-110")}
            >
              {content.primaryCta.label}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <Link href={content.secondaryCta.href} className={ctaClass("secondary", "h-12 border-foreground/10 bg-card/70 px-6 text-base backdrop-blur hover:bg-card")}>
              <PlayCircle className="size-4 text-primary" aria-hidden />
              {content.secondaryCta.label}
            </Link>
          </div>

          <dl className="mt-10 grid max-w-xl animate-rise grid-cols-3 gap-3" style={delay(lines.length + 3)}>
            {[
              subjectCount > 0 ? { icon: Layers, label: "Subject areas", value: String(subjectCount) } : null,
              courseCount > 0 ? { icon: BookOpen, label: "Courses", value: String(courseCount) } : null,
              { icon: Radio, label: "Formats", value: "Video · Live" },
            ]
              .filter(Boolean)
              .map((stat) => {
                const s = stat!;
                return (
                  <div key={s.label} className="rounded-2xl border bg-card/70 px-4 py-3 shadow-card backdrop-blur">
                    <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <s.icon className="size-3.5 text-primary" aria-hidden /> {s.label}
                    </dt>
                    <dd className="mt-1 font-heading text-lg font-semibold tracking-tight">{s.value}</dd>
                  </div>
                );
              })}
          </dl>

          {topics.length ? (
            <div className="mt-6 flex animate-rise flex-wrap items-center gap-2 text-sm" style={delay(lines.length + 4)}>
              <span className="text-muted-foreground">Popular:</span>
              {topics.slice(0, 4).map((t) => (
                <Link
                  key={t.slug}
                  href={`/categories/${t.slug}`}
                  className="rounded-full border bg-card/60 px-3 py-1 font-medium text-foreground/80 backdrop-blur transition-colors hover:border-primary/40 hover:text-primary"
                >
                  {t.name}
                </Link>
              ))}
            </div>
          ) : null}
        </div>

        <div className="relative mx-auto w-full max-w-[560px] lg:max-w-none">
          {/* Decorative frame layers behind the photograph. */}
          <div aria-hidden className="absolute -inset-4 -z-10 rotate-[-4deg] rounded-[40px] bg-[linear-gradient(135deg,color-mix(in_oklch,var(--brand)_25%,transparent),color-mix(in_oklch,#3b82f6_15%,transparent)_50%,color-mix(in_oklch,var(--mint)_20%,transparent))] blur-[2px]" />
          <div aria-hidden className="absolute -top-6 -right-6 -z-10 size-28 rounded-full border-2 border-dashed border-primary/25" />

          <div className="relative aspect-[4/5] animate-rise overflow-hidden rounded-[32px] bg-muted shadow-[0_40px_80px_-30px_rgb(21_18_46/0.45)] ring-1 ring-white/60 sm:aspect-[5/4] lg:aspect-[4/5]" style={{ animationDelay: "160ms" }}>
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
            <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,transparent_50%,rgb(21_18_46/0.45))]" />
          </div>

          {/* Product fragments: illustrative interface, not data about real learners. */}
          <div aria-hidden className="absolute top-6 -right-3 w-[min(250px,62%)] animate-rise sm:-right-8" style={{ animationDelay: "420ms" }}>
            <div className="animate-float-slow rounded-2xl border border-white/70 bg-white/80 p-4 shadow-raised backdrop-blur-xl">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <span className="relative grid size-6 place-items-center rounded-md bg-brand-soft text-primary">
                  <Radio className="size-3.5" />
                  <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-destructive ring-2 ring-white" />
                </span>
                Live workshop
              </div>
              <p className="mt-2 text-sm leading-snug font-semibold text-foreground">Questions answered live, recordings after</p>
              <p className="mt-1 text-xs text-muted-foreground">Join from your dashboard on Zoom or Google Meet</p>
            </div>
          </div>

          <div aria-hidden className="absolute top-1/2 -left-4 hidden w-[240px] -translate-y-1/2 animate-rise sm:block lg:-left-12" style={{ animationDelay: "560ms" }}>
            <div className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/85 p-3 shadow-raised backdrop-blur-xl">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-mint-soft text-mint-strong">
                <Award className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Certificate</p>
                <p className="text-sm leading-snug font-semibold text-foreground">Verifiable on completion</p>
              </div>
            </div>
          </div>

          <div aria-hidden className="absolute -bottom-6 left-4 w-[min(300px,80%)] animate-rise sm:-left-6" style={{ animationDelay: "640ms" }}>
            <div className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-raised backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl text-primary-foreground", "bg-[linear-gradient(135deg,var(--brand),var(--brand-strong))]")}>
                  <PlayCircle className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Continue learning</p>
                  <p className="truncate text-sm font-semibold text-foreground">Lesson 4 · Pricing your first product</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-[62%] rounded-full bg-[linear-gradient(90deg,var(--mint),var(--mint-strong))]" />
                </div>
                <span className="text-xs font-semibold text-mint-strong tabular-nums">62%</span>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
