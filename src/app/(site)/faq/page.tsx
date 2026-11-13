import type { Metadata } from "next";
import Link from "next/link";
import { FaqList } from "@/components/site/faq-list";
import { Container, JsonLd, PageIntro, ctaClass } from "@/components/site/primitives";
import { appUrl } from "@/lib/env";
import { sanitizeRichText, stripHtml } from "@/lib/sanitize";
import { getFaqs } from "@/lib/services/public/content";

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description: "Answers about courses, access, billing, certificates and live classes at Foremint Academy.",
  alternates: { canonical: appUrl("/faq") },
};

const CATEGORY_LABEL: Record<string, string> = {
  general: "General",
  courses: "Courses and access",
  billing: "Billing and refunds",
  certificates: "Certificates",
  live: "Live classes",
  technical: "Technical",
  instructors: "Instructors",
};

const ORDER = ["general", "courses", "billing", "certificates", "live", "technical", "instructors"];

export default async function FaqPage() {
  const faqs = await getFaqs();
  const groups = ORDER.map((cat) => ({
    cat,
    items: faqs.filter((f) => f.category === cat).map((f) => ({ id: f.id, question: f.question, answerHtml: sanitizeRichText(f.answer) })),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      {faqs.length ? (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: stripHtml(f.answer) } })),
          }}
        />
      ) : null}
      <PageIntro title="Questions, answered" description="Everything about courses, access, payments and certificates. Still stuck? Our team is happy to help." />
      <Container className="grid gap-12 py-12 sm:py-16 lg:grid-cols-[240px_1fr]">
        {groups.length ? (
          <>
            <nav aria-label="FAQ topics" className="lg:sticky lg:top-24 lg:self-start">
              <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
                {groups.map((g) => (
                  <li key={g.cat}>
                    <a href={`#${g.cat}`} className="inline-flex rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-muted hover:text-foreground max-lg:border">
                      {CATEGORY_LABEL[g.cat]}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="grid gap-12">
              {groups.map((g) => (
                <section key={g.cat} id={g.cat} className="scroll-mt-24">
                  <h2 className="mb-4 text-xl font-semibold">{CATEGORY_LABEL[g.cat]}</h2>
                  <FaqList items={g.items} />
                </section>
              ))}
            </div>
          </>
        ) : (
          <p className="text-muted-foreground lg:col-span-2">Answers are being added. In the meantime, contact us with any question.</p>
        )}
        <div className="rounded-3xl border bg-card p-6 sm:p-8 lg:col-span-2">
          <h2 className="text-xl font-semibold">Didn&apos;t find your answer?</h2>
          <p className="mt-1 text-muted-foreground">Send us a message and we&apos;ll reply by email.</p>
          <Link href="/contact" className={ctaClass("primary", "mt-5")}>
            Contact us
          </Link>
        </div>
      </Container>
    </>
  );
}
