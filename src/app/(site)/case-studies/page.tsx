import type { Metadata } from "next";
import { StoryList } from "@/components/site/stories";
import { appUrl } from "@/lib/env";
import { getCaseStudies } from "@/lib/services/public/content";

export const metadata: Metadata = {
  title: "Case studies",
  description: "How Foremint Academy learners applied what they studied to real businesses and projects.",
  alternates: { canonical: appUrl("/case-studies") },
};

export default async function Page() {
  const stories = await getCaseStudies("case_study");
  return <StoryList kind="case_study" stories={stories} />;
}
