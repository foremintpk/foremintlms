import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RichContent } from "@/components/common/rich-content";
import { Container } from "@/components/site/primitives";
import { appUrl } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { fillPlaceholders } from "@/lib/sanitize";
import { getLegalDocument, isLegalSlug, LEGAL_SLUGS } from "@/lib/services/public/content";
import { fillRegistrationNumber, legalPlaceholderValues } from "@/lib/services/public/shape";
import { getPublicSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export const instant = false;

const TITLES: Record<(typeof LEGAL_SLUGS)[number], string> = {
  terms: "Terms and Conditions",
  privacy: "Privacy Policy",
  refund: "Refund and Cancellation Policy",
  cookies: "Cookie Policy",
};

export async function generateMetadata({ params }: PageProps<"/legal/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (!isLegalSlug(slug)) return { title: "Not found", robots: { index: false } };
  return {
    title: TITLES[slug],
    description: `${TITLES[slug]} for Foremint Academy.`,
    alternates: { canonical: appUrl(`/legal/${slug}`) },
  };
}

export default async function LegalPage({ params }: PageProps<"/legal/[slug]">) {
  const { slug } = await params;
  if (!isLegalSlug(slug)) notFound();
  const [doc, settings] = await Promise.all([getLegalDocument(slug), getPublicSettings()]);
  if (!doc) notFound();

  const values = legalPlaceholderValues({
    legalEntityName: settings.legalEntityName,
    businessAddress: settings.businessAddress,
    supportEmail: settings.supportEmail,
    jurisdiction: settings.jurisdiction,
    siteUrl: appUrl("/"),
  });
  const body = doc.current ? fillPlaceholders(fillRegistrationNumber(doc.current.body, settings.registrationNumber), values) : "";

  return (
    <Container className="grid gap-12 py-12 sm:py-16 lg:grid-cols-[220px_1fr]">
      <nav aria-label="Legal documents" className="lg:sticky lg:top-24 lg:self-start">
        <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
          {LEGAL_SLUGS.map((s) => (
            <li key={s}>
              <Link
                href={`/legal/${s}`}
                aria-current={s === slug ? "page" : undefined}
                className={cn(
                  "inline-flex rounded-lg px-3 py-2 text-sm font-medium transition-colors max-lg:border",
                  s === slug ? "bg-brand-soft text-primary" : "text-foreground/75 hover:bg-muted hover:text-foreground",
                )}
              >
                {TITLES[s]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <article className="min-w-0">
        <h1 className="text-[2.2rem] leading-[1.05] font-bold tracking-[-0.03em] sm:text-[2.8rem]">{doc.title}</h1>
        {doc.current ? (
          <>
            <p className="mt-3 text-sm text-muted-foreground">
              Version {doc.current.version}, effective {formatDate(doc.current.effective_date)}
              {doc.current.published_at ? `, last updated ${formatDate(doc.current.published_at)}` : ""}
            </p>
            <RichContent html={body} className="mt-10" />
          </>
        ) : (
          <p className="mt-6 text-muted-foreground">This document hasn&apos;t been published yet.</p>
        )}
        {doc.history.length > 1 ? (
          <section className="mt-14 border-t pt-8">
            <h2 className="text-lg font-semibold">Version history</h2>
            <ol className="mt-4 grid gap-3 text-sm">
              {doc.history.map((v) => (
                <li key={v.id} className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                  <span className="w-28 shrink-0 font-medium">Version {v.version}</span>
                  <span className="text-muted-foreground">
                    Effective {formatDate(v.effective_date)}
                    {v.status === "superseded" ? " (superseded)" : " (current)"}
                    {v.change_summary ? ` — ${v.change_summary}` : ""}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </article>
    </Container>
  );
}
