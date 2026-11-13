/**
 * Cache tags used by the public website. Admin actions that change this
 * content should call `updateTag(PUBLIC_TAGS.x)` so visitors see it at once;
 * otherwise entries refresh on their cacheLife schedule.
 */
export const PUBLIC_TAGS = {
  courses: "courses",
  categories: "categories",
  instructors: "instructors",
  programs: "programs",
  pricing: "pricing",
  reviews: "reviews",
  cms: "cms",
  faqs: "faqs",
  testimonials: "testimonials",
  caseStudies: "case-studies",
  blog: "blog",
  legal: "legal",
} as const;

export type PublicTag = (typeof PUBLIC_TAGS)[keyof typeof PUBLIC_TAGS];
