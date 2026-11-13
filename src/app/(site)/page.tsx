import type { Metadata } from "next";
import { Hero } from "@/components/site/home/hero";
import {
  CaseStudiesSection,
  CategoriesSection,
  FaqSection,
  FeaturedCoursesSection,
  FinalCtaSection,
  FormatsSection,
  HowItWorksSection,
  InstructorsSection,
  PricingSection,
  TestimonialsSection,
  WhySection,
} from "@/components/site/home/sections";
import { JsonLd } from "@/components/site/primitives";
import { appUrl } from "@/lib/env";
import { sanitizeRichText } from "@/lib/sanitize";
import { getPublicSettings } from "@/lib/settings";
import { getCategories, getFeaturedCourses, getInstructors, getPricingCatalog } from "@/lib/services/public/catalog";
import { getCaseStudies, getCmsPage, getFaqs, getTestimonials } from "@/lib/services/public/content";
import { sectionSchemas } from "@/lib/cms/sections";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getCmsPage("home");
  const title = page.seo_title ?? "Foremint Academy — Practical skills for the digital economy";
  const description =
    page.seo_description ??
    "Practical, career-focused courses in e-commerce, Amazon FBA, Shopify, SEO, web and app development and digital marketing.";
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: appUrl("/") },
    openGraph: { title, description, url: appUrl("/"), type: "website" },
    twitter: { title, description },
  };
}

export default async function HomePage() {
  const page = await getCmsPage("home");
  const s = page.sections;
  const show = <K extends keyof typeof s>(key: K) => Boolean(s[key]?.visible);

  const [categories, featured, instructors, testimonials, caseStudies, pricing, faqs, settings] = await Promise.all([
    getCategories(),
    show("featured_courses") ? getFeaturedCourses(s.featured_courses?.content.limit ?? 6) : Promise.resolve([]),
    show("instructors") ? getInstructors({ limit: 4 }) : Promise.resolve([]),
    show("testimonials") ? getTestimonials({ limit: 6 }) : Promise.resolve([]),
    show("case_studies") ? getCaseStudies("case_study", 3) : Promise.resolve([]),
    show("pricing") ? getPricingCatalog() : Promise.resolve({ memberships: [], bundles: [], coursesWithPlans: 0 }),
    show("faq") ? getFaqs({ homeOnly: true }) : Promise.resolve([]),
    getPublicSettings(),
  ]);

  const hero = s.hero?.visible ? s.hero.content : sectionSchemas.hero.parse({});
  const pricingProducts = [...pricing.memberships, ...pricing.bundles].sort((a, b) => Number(b.is_featured) - Number(a.is_featured));
  const faqItems = faqs.map((f) => ({ id: f.id, question: f.question, answerHtml: sanitizeRichText(f.answer) }));

  const sameAs = Object.values(settings.socialLinks).filter((u) => typeof u === "string" && u.startsWith("https://"));

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "EducationalOrganization",
          name: settings.brandName,
          url: appUrl("/"),
          logo: appUrl("/brand/foremint-mark-512.png"),
          description: hero.subheadline,
          ...(settings.supportEmail ? { email: settings.supportEmail } : {}),
          ...(sameAs.length ? { sameAs } : {}),
        }}
      />
      <Hero content={hero} subjectCount={categories.length} />
      {s.featured_courses?.visible ? <FeaturedCoursesSection content={s.featured_courses.content} courses={featured} /> : null}
      {s.categories?.visible ? <CategoriesSection content={s.categories.content} categories={categories} /> : null}
      {s.why?.visible ? <WhySection content={s.why.content} /> : null}
      {s.how_it_works?.visible ? <HowItWorksSection content={s.how_it_works.content} /> : null}
      {s.formats?.visible ? <FormatsSection content={s.formats.content} /> : null}
      {s.instructors?.visible ? <InstructorsSection content={s.instructors.content} instructors={instructors} /> : null}
      {s.testimonials?.visible ? <TestimonialsSection content={s.testimonials.content} testimonials={testimonials} /> : null}
      {s.case_studies?.visible ? <CaseStudiesSection content={s.case_studies.content} studies={caseStudies} /> : null}
      {s.pricing?.visible ? <PricingSection content={s.pricing.content} products={pricingProducts} /> : null}
      {s.faq?.visible ? <FaqSection content={s.faq.content} items={faqItems} /> : null}
      {s.final_cta?.visible ? <FinalCtaSection content={s.final_cta.content} /> : null}
    </>
  );
}
