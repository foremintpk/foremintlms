import { ReviewPage } from "@/components/course-builder/pages/builder-pages";

export const instant = false;
export const metadata = { title: "Review and publish" };

export default async function Page({ params }: PageProps<"/admin/courses/[id]/review">) {
  const { id } = await params;
  return <ReviewPage area="admin" courseId={id} />;
}
