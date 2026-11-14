import Link from "next/link";
import { ArrowRight, CalendarClock, Layers, Share2 } from "lucide-react";
import { Container, MediaImage, ctaClass } from "@/components/site/primitives";
import { formatMinor } from "@/lib/domain/invoicing";
import type { SelectorCatalog } from "@/lib/domain/commerce-view";

/** Home page: invite visitors to build a multi-course learning package. */
export function LearningPlanCtaSection({ catalog }: { catalog: SelectorCatalog }) {
  if (!catalog.enabled || catalog.courses.length === 0) return null;
  const preview = catalog.courses.slice(0, 4);
  const cheapest = Math.min(...catalog.courses.flatMap((c) => Object.values(c.prices).map((p) => p.priceMinor)));
  return (
    <section className="py-16 sm:py-24" aria-labelledby="learning-plan-cta">
      <Container>
        <div className="relative overflow-hidden rounded-[32px] bg-ink px-6 py-10 text-white sm:px-10 sm:py-14 lg:px-14">
          <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 size-[420px] rounded-full bg-[radial-gradient(closest-side,rgb(124_98_255/0.45),transparent)]" />
          <div className="relative grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white/90">
                <Layers className="size-4" aria-hidden /> Build your learning plan
              </p>
              <h2 id="learning-plan-cta" className="mt-5 font-heading text-[2rem] leading-[1.05] font-semibold tracking-[-0.03em] sm:text-[2.6rem]">
                Choose the skills you want to master.
              </h2>
              <p className="mt-4 max-w-xl text-lg text-white/75">
                Pick any combination of our {catalog.courses.length} courses, see the total straight away and pay once — or send the payment link to whoever is paying for you.
              </p>
              <ul className="mt-6 grid gap-2 text-sm text-white/80 sm:grid-cols-2">
                <li className="flex items-center gap-2">
                  <CalendarClock className="size-4 text-[#b9a9ff]" aria-hidden /> One access period for the whole package
                </li>
                <li className="flex items-center gap-2">
                  <Share2 className="size-4 text-[#b9a9ff]" aria-hidden /> No account needed to pay
                </li>
              </ul>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link href="/courses/select" className={ctaClass("inverse", "h-12 px-6 text-base")}>
                  Build your learning plan <ArrowRight className="size-4" aria-hidden />
                </Link>
                {Number.isFinite(cheapest) ? <p className="text-sm text-white/60">Courses from {formatMinor(cheapest, catalog.currency)}</p> : null}
              </div>
            </div>
            <ul className="grid grid-cols-2 gap-3" aria-hidden>
              {preview.map((c, i) => (
                <li key={c.id} className={i % 2 === 1 ? "translate-y-6" : ""}>
                  <div className="overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10">
                    <div className="relative aspect-[4/3]">
                      <MediaImage src={c.thumbnailUrl} alt="" sizes="220px" />
                    </div>
                    <p className="truncate px-3 py-2.5 text-sm font-medium text-white/90">{c.title}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}
