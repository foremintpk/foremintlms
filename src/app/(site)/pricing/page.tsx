import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { FaqList } from "@/components/site/faq-list";
import { ProductOffer } from "@/components/site/plan-card";
import { Container, PageIntro, ctaClass } from "@/components/site/primitives";
import { appUrl } from "@/lib/env";
import { sanitizeRichText } from "@/lib/sanitize";
import { getPricingCatalog } from "@/lib/services/public/catalog";
import { getFaqs } from "@/lib/services/public/content";

export const metadata: Metadata = {
  title: "Pricing and memberships",
  description: "Buy a single course, save with a bundle or unlock every course with a membership.",
  alternates: { canonical: appUrl("/pricing") },
};

export default async function PricingPage() {
  const [{ memberships, bundles, coursesWithPlans }, faqs] = await Promise.all([getPricingCatalog(), getFaqs()]);
  const billingFaqs = faqs.filter((f) => f.category === "billing").map((f) => ({ id: f.id, question: f.question, answerHtml: sanitizeRichText(f.answer) }));
  const nothingYet = memberships.length === 0 && bundles.length === 0 && coursesWithPlans === 0;

  return (
    <>
      <PageIntro title="Plans that fit how you learn" description="Buy a single course, save with a bundle, or unlock everything with a membership. Payments are processed securely by Whop." />
      <Container className="py-12 sm:py-16">
        {nothingYet ? (
          <div className="rounded-3xl border border-dashed bg-card/60 px-6 py-12 text-center">
            <p className="font-heading text-xl font-semibold">Pricing will be published with our first courses</p>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">Create a free account to be told as soon as enrollment opens.</p>
            <Link href="/register" className={ctaClass("primary", "mt-6")}>
              Create free account
            </Link>
          </div>
        ) : null}

        {memberships.length ? (
          <section className="mb-16">
            <h2 className="mb-2 text-2xl font-semibold tracking-tight">Memberships</h2>
            <p className="mb-8 text-muted-foreground">Ongoing access to many courses for as long as your membership is active.</p>
            <div className="grid gap-6 lg:grid-cols-2">
              {memberships.map((p) => (
                <ProductOffer key={p.id} product={p} />
              ))}
            </div>
          </section>
        ) : null}

        {bundles.length ? (
          <section className="mb-16">
            <h2 className="mb-2 text-2xl font-semibold tracking-tight">Bundles</h2>
            <p className="mb-8 text-muted-foreground">Related courses together, for less than buying them separately.</p>
            <div className="grid gap-6 lg:grid-cols-2">
              {bundles.map((p) => (
                <ProductOffer key={p.id} product={p} />
              ))}
            </div>
          </section>
        ) : null}

        {coursesWithPlans > 0 ? (
          <section className="mb-16 grid items-center gap-8 rounded-3xl border bg-card p-6 sm:p-10 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Individual courses</h2>
              <p className="mt-2 text-muted-foreground">
                Each course page lists its own options — fixed-term access, lifetime access or a subscription — so you can choose what suits you.
              </p>
              <ul className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
                {["30, 60 or 90-day access", "Lifetime access", "Monthly or yearly subscriptions", "Free previews before you buy"].map((t) => (
                  <li key={t} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">Available options vary by course.</p>
            </div>
            <div className="lg:text-right">
              <Link href="/courses" className={ctaClass("primary")}>
                Browse courses
              </Link>
            </div>
          </section>
        ) : null}

        <section className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Billing questions</h2>
            <p className="mt-2 text-muted-foreground">
              Read our{" "}
              <Link href="/legal/refund" className="font-medium text-primary hover:underline">
                refund policy
              </Link>{" "}
              or{" "}
              <Link href="/contact" className="font-medium text-primary hover:underline">
                contact us
              </Link>
              .
            </p>
          </div>
          {billingFaqs.length ? <FaqList items={billingFaqs} /> : null}
        </section>
      </Container>
    </>
  );
}
