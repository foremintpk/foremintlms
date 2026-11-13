import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StoryDetail } from "@/components/site/stories";
import { appUrl } from "@/lib/env";
import { getCourseCardsByIds } from "@/lib/services/public/catalog";
import { getCaseStudyBySlug } from "@/lib/services/public/content";

export const instant = false;

export async function generateMetadata({ params }: PageProps<"/success-stories/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const story = await getCaseStudyBySlug("success_story", slug);
  if (!story) return { title: "Not found", robots: { index: false } };
  const title = story.seo_title ?? story.title;
  const description = story.seo_description ?? story.summary ?? undefined;
  const url = appUrl(`/success-stories/${story.slug}`);
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url, type: "article" } };
}

export default async function Page({ params }: PageProps<"/success-stories/[slug]">) {
  const { slug } = await params;
  const story = await getCaseStudyBySlug("success_story", slug);
  if (!story) notFound();
  const courses = await getCourseCardsByIds(story.course_ids);
  return <StoryDetail story={story} courses={courses} />;
}
