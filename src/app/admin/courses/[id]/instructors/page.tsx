import { InstructorsPage } from "@/components/course-builder/pages/builder-pages";

export const instant = false;
export const metadata = { title: "Course instructors" };

export default async function Page({ params }: PageProps<"/admin/courses/[id]/instructors">) {
  const { id } = await params;
  return <InstructorsPage courseId={id} />;
}
