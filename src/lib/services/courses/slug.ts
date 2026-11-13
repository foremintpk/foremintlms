import { slugify } from "@/lib/format";
import { RESERVED_SLUGS, SLUG_RE } from "@/lib/validation/course";

/** Turn a title into a valid course slug (pure). */
export function courseSlugFromTitle(title: string): string {
  let slug = slugify(title).replace(/-+/g, "-").slice(0, 90).replace(/-+$/g, "");
  if (slug.length < 3) slug = `${slug || "course"}-course`.replace(/^-/, "");
  if (RESERVED_SLUGS.includes(slug)) slug = `${slug}-course`;
  return slug;
}

/** First free variant of `base` given the slugs already taken: base, base-2, base-3… */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base.slice(0, 95)}-${i}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${base.slice(0, 80)}-${Date.now().toString(36)}`;
}

export function isValidCourseSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && slug.length >= 3 && slug.length <= 100 && !RESERVED_SLUGS.includes(slug);
}
