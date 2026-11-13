import type { Metadata } from "next";
import { StoryList } from "@/components/site/stories";
import { appUrl } from "@/lib/env";
import { getCaseStudies } from "@/lib/services/public/content";

export const metadata: Metadata = {
  title: "Success stories",
  description: "Personal learning journeys shared by Foremint Academy students.",
  alternates: { canonical: appUrl("/success-stories") },
};

export default async function Page() {
  const stories = await getCaseStudies("success_story");
  return <StoryList kind="success_story" stories={stories} />;
}
