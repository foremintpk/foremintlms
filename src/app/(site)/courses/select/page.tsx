import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, CalendarClock, CreditCard, Layers, MailCheck, MousePointerClick, Share2 } from "lucide-react";
import { Breadcrumbs, Container, JsonLd, ctaClass } from "@/components/site/primitives";
import { CourseSelector } from "@/components/commerce/course-selector";
import { OpenAdvisorButton } from "@/components/advisor/open-advisor-button";
import { appUrl } from "@/lib/env";
import { formatMinor, minorToMajorString } from "@/lib/domain/invoicing";
import { getSelectorCatalog } from "@/lib/services/commerce/catalog";

const TITLE = "Build your learning plan";
const DESCRIPTION =
  "Choose the courses that match your goals, create your learning package and start developing skills that move your business forward. One payment, no account needed to start.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: appUrl("/courses/select") },
  openGraph: { title: `${TITLE} · Foremint Academy`, description: DESCRIPTION, url: appUrl("/courses/select"), type: "website" },
  twitter: { title: TITLE, description: DESCRIPTION },
};

const STEPS = [
  { icon: MousePointerClick, title: "Choose your courses", body: "Every course shows its own price. Add as many as you need." },
  { icon: CalendarClock, title: "Pick your access period", body: "One period for the whole package. Have a discount code? Add it at checkout." },
  { icon: Share2, title: "Pay — or share the link", body: "Pay securely now, or send the payment link to a parent, employer or institution." },
  { icon: MailCheck, title: "Get your login by email", body: "Once the payment is confirmed, the student gets a secure link to set their password." },
];

export default async function CourseSelectPage() {
  const catalog = await getSelectorCatalog();
  const available = catalog.enabled && catalog.courses.length > 0;
  const cheapest = available
    ? Math.min(...catalog.courses.flatMap((c) => Object.values(c.prices).map((p) => p.priceMinor)))
    : null;
  const periods = catalog.durations.map((d) => d.label);

  return (
    <>
      {available ? (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: TITLE,
            itemListElement: catalog.courses.map((c, i) => {
              const price = catalog.defaultDuration ? c.prices[catalog.defaultDuration] : Object.values(c.prices)[0];
              return {
                "@type": "ListItem",
                position: i + 1,
                item: {
                  "@type": "Course",
                  name: c.title,
                  url: appUrl(`/courses/${c.slug}`),
                  ...(c.shortDescription ? { description: c.shortDescription } : {}),
                  provider: { "@type": "Organization", name: "Foremint Academy", sameAs: appUrl("/") },
                  ...(price ? { offers: { "@type": "Offer", price: minorToMajorString(price.priceMinor, catalog.currency), priceCurrency: catalog.currency.toUpperCase(), category: "Paid" } } : {}),
                },
              };
            }),
          }}
        />
      ) : null}

      <section className="relative -mt-[4.25rem] overflow-hidden border-b bg-[linear-gradient(180deg,var(--brand-soft),transparent_75%)] pt-[4.25rem]">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-48 -right-40 h-[560px] w-[560px] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--brand)_16%,transparent),transparent)]"
        />
        <Container className="relative grid gap-10 pt-10 pb-12 sm:pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14 lg:pb-16">
          <div>
            <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Courses", href: "/courses" }, { label: TITLE }]} />
            <h1 className="mt-6 animate-rise font-heading text-[2.5rem] leading-[1.02] font-bold tracking-[-0.04em] sm:text-[3.3rem]">
              Build your own learning experience
            </h1>
            <p className="mt-5 max-w-xl animate-rise text-lg text-muted-foreground" style={{ animationDelay: "80ms" }}>
              Choose the courses that match your goals, create your learning package and start developing skills that move your business forward.
            </p>
            <div className="mt-8 flex animate-rise flex-col gap-3 sm:flex-row" style={{ animationDelay: "140ms" }}>
              <a href="#courses" className={ctaClass("primary", "h-12 px-6 text-base")}>
                Explore courses
              </a>
              <OpenAdvisorButton className={ctaClass("secondary", "h-12 px-6 text-base")} message="I'm not sure which course is right for me.">
                Not sure? Ask the course advisor
              </OpenAdvisorButton>
            </div>
            <dl className="mt-10 grid max-w-lg animate-rise grid-cols-3 gap-4 border-t pt-6 text-sm" style={{ animationDelay: "200ms" }}>
              <div>
                <dt className="text-muted-foreground">Courses</dt>
                <dd className="mt-1 font-heading text-xl font-semibold" data-testid="selector-course-count">
                  {catalog.courses.length}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Access</dt>
                <dd className="mt-1 font-medium">{periods.length > 1 ? `${periods[0]} to ${periods[periods.length - 1].toLowerCase()}` : periods[0] ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">From</dt>
                <dd className="mt-1 font-medium">{cheapest !== null ? `${formatMinor(cheapest, catalog.currency)} a course` : "—"}</dd>
              </div>
            </dl>
          </div>

          <div className="animate-rise rounded-[28px] border bg-card/90 p-6 shadow-raised backdrop-blur sm:p-8" style={{ animationDelay: "160ms" }}>
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
              <Layers className="size-4" aria-hidden /> How it works
            </p>
            <ol className="mt-5 grid gap-5">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-primary">
                    <step.icon className="size-5" aria-hidden />
                    <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-primary text-[0.68rem] font-bold text-primary-foreground">{i + 1}</span>
                  </span>
                  <div>
                    <p className="font-semibold">{step.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-6 flex items-center gap-2 border-t pt-4 text-xs text-muted-foreground">
              <CreditCard className="size-3.5" aria-hidden /> Payments are processed securely by Whop.
              <BadgeCheck className="ml-auto size-3.5 text-mint-strong" aria-hidden /> No account needed to pay
            </p>
          </div>
        </Container>
      </section>

      <div className="pt-8 sm:pt-10">
        {available ? (
          <CourseSelector catalog={catalog} />
        ) : (
          <Container className="pb-20">
            <div className="mx-auto max-w-xl rounded-3xl border bg-card p-10 text-center shadow-card">
              <h2 className="font-heading text-xl font-semibold">Course packages aren&apos;t available right now</h2>
              <p className="mt-2 text-muted-foreground">You can still browse every course and buy it on its own page.</p>
              <Link href="/courses" className={ctaClass("primary", "mt-6")}>
                Browse courses
              </Link>
            </div>
          </Container>
        )}
      </div>
    </>
  );
}
