import { ReviewPage } from "@/components/course-builder/pages/builder-pages";

export const instant = false;
export const metadata = { title: "Review and publish" };

export default async function Page({ params }: PageProps<"/teach/courses/[id]/review">) {
  const { id } = await params;
  return <ReviewPage area="teach" courseId={id} />;
}
