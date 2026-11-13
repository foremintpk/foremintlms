import { z } from "zod";

/**
 * Typed content for editable CMS sections (public site renders them, admin
 * edits them). Each schema supplies defaults so a missing or partially
 * edited section still renders sensibly.
 */

const cta = z.object({
  label: z.string().trim().min(1).max(40),
  href: z.string().trim().min(1).max(300).refine((v) => v.startsWith("/") || /^https:\/\//.test(v), "Use a site path (/courses) or an https:// link"),
});

const iconName = z.string().trim().max(40).default("sparkles");

const titled = { title: z.string().trim().min(1).max(160), subtitle: z.string().trim().max(400).optional() };

export const sectionSchemas = {
  hero: z.object({
    headline: z.string().trim().min(1).max(160).default("Build Skills. Create Opportunities. Grow Beyond Limits."),
    subheadline: z
      .string()
      .trim()
      .max(400)
      .default("Practical education for people building businesses, launching digital careers and creating opportunities in the modern economy."),
    primaryCta: cta.default({ label: "Explore Courses", href: "/courses" }),
    secondaryCta: cta.default({ label: "Start Learning", href: "/register" }),
    image: z.string().trim().max(500).default("/images/hero/hero-entrepreneur.jpg"),
  }),
  featured_courses: z.object({ ...titled, limit: z.number().int().min(3).max(12).default(6) }),
  categories: z.object({ ...titled }),
  why: z.object({
    title: z.string().trim().min(1).max(160),
    items: z.array(z.object({ icon: iconName, title: z.string().trim().min(1).max(80), body: z.string().trim().max(300) })).max(8).default([]),
  }),
  how_it_works: z.object({
    title: z.string().trim().min(1).max(160),
    steps: z.array(z.object({ title: z.string().trim().min(1).max(60), body: z.string().trim().max(240) })).max(8).default([]),
  }),
  formats: z.object({
    title: z.string().trim().min(1).max(160),
    items: z.array(z.object({ icon: iconName, title: z.string().trim().min(1).max(80), body: z.string().trim().max(300) })).max(6).default([]),
  }),
  instructors: z.object({ ...titled }),
  testimonials: z.object({ ...titled }),
  case_studies: z.object({ ...titled }),
  pricing: z.object({ ...titled }),
  faq: z.object({ title: z.string().trim().min(1).max(160) }),
  final_cta: z.object({
    title: z.string().trim().min(1).max(160),
    body: z.string().trim().max(400).optional(),
    primaryCta: cta.default({ label: "Create free account", href: "/register" }),
    secondaryCta: cta.optional(),
  }),
  // about page
  intro: z.object({ title: z.string().trim().min(1).max(160), body: z.string().trim().max(1200), image: z.string().trim().max(500).optional() }),
  mission: z.object({
    title: z.string().trim().min(1).max(160),
    items: z.array(z.object({ title: z.string().trim().min(1).max(80), body: z.string().trim().max(400) })).max(6).default([]),
  }),
  approach: z.object({ title: z.string().trim().min(1).max(160), body: z.string().trim().max(1600), image: z.string().trim().max(500).optional() }),
} as const;

export type SectionKey = keyof typeof sectionSchemas;
export type SectionContent<K extends SectionKey> = z.infer<(typeof sectionSchemas)[K]>;

export const SECTION_LABELS: Record<SectionKey, string> = {
  hero: "Hero",
  featured_courses: "Featured courses",
  categories: "Learning categories",
  why: "Why Foremint Academy",
  how_it_works: "How it works",
  formats: "Learning formats",
  instructors: "Instructor spotlight",
  testimonials: "Testimonials",
  case_studies: "Case studies",
  pricing: "Membership & pricing",
  faq: "FAQ",
  final_cta: "Final call to action",
  intro: "Introduction",
  mission: "What we believe",
  approach: "How we teach",
};

export const PAGE_SECTIONS: Record<string, SectionKey[]> = {
  home: ["hero", "featured_courses", "categories", "why", "how_it_works", "formats", "instructors", "testimonials", "case_studies", "pricing", "faq", "final_cta"],
  about: ["intro", "mission", "approach"],
};

/** Parse stored JSON for a section; returns null when it fails validation. */
export function parseSection<K extends SectionKey>(key: K, content: unknown): SectionContent<K> | null {
  const result = sectionSchemas[key].safeParse(content ?? {});
  return result.success ? (result.data as SectionContent<K>) : null;
}
