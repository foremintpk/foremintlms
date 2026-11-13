import { CourseDetailsPage } from "@/components/course-builder/pages/builder-pages";

export const instant = false;
export const metadata = { title: "Course details" };

export default async function Page({ params }: PageProps<"/teach/courses/[id]">) {
  const { id } = await params;
  return <CourseDetailsPage area="teach" courseId={id} />;
}
