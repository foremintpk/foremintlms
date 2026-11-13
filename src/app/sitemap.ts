import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/env";
import { getSitemapData } from "@/lib/services/public/content";

const STATIC_PATHS: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/courses", priority: 0.9, changeFrequency: "daily" },
  { path: "/programs", priority: 0.7, changeFrequency: "weekly" },
  { path: "/instructors", priority: 0.6, changeFrequency: "weekly" },
  { path: "/pricing", priority: 0.8, changeFrequency: "weekly" },
  { path: "/about", priority: 0.5, changeFrequency: "monthly" },
  { path: "/testimonials", priority: 0.4, changeFrequency: "monthly" },
  { path: "/case-studies", priority: 0.5, changeFrequency: "monthly" },
  { path: "/success-stories", priority: 0.5, changeFrequency: "monthly" },
  { path: "/blog", priority: 0.6, changeFrequency: "weekly" },
  { path: "/faq", priority: 0.5, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.4, changeFrequency: "yearly" },
  { path: "/certificates/verify", priority: 0.3, changeFrequency: "yearly" },
];

/** Published, public pages only — nothing behind sign-in. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await getSitemapData();
  const entry = (path: string, lastModified?: string, priority = 0.6): MetadataRoute.Sitemap[number] => ({
    url: appUrl(path),
    ...(lastModified ? { lastModified } : {}),
    priority,
  });
  return [
    ...STATIC_PATHS.map((s) => ({ url: appUrl(s.path), priority: s.priority, changeFrequency: s.changeFrequency })),
    ...data.courses.map((c) => entry(`/courses/${c.slug}`, c.updated_at, 0.9)),
    ...data.categories.map((c) => entry(`/categories/${c.slug}`, c.updated_at, 0.7)),
    ...data.programs.map((p) => entry(`/programs/${p.slug}`, p.updated_at, 0.7)),
    ...data.instructors.map((i) => entry(`/instructors/${i.slug}`, i.updated_at, 0.5)),
    ...data.posts.map((p) => entry(`/blog/${p.slug}`, p.updated_at, 0.6)),
    ...data.caseStudies.map((c) => entry(`${c.kind === "success_story" ? "/success-stories" : "/case-studies"}/${c.slug}`, c.updated_at, 0.5)),
    ...data.legal.map((l) => entry(`/legal/${l.slug}`, l.updated_at, 0.2)),
  ];
}
