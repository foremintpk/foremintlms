import { AssignmentsPage } from "@/components/course-builder/pages/builder-pages";

export const instant = false;
export const metadata = { title: "Assignments" };

export default async function Page({ params }: PageProps<"/teach/courses/[id]/assignments">) {
  const { id } = await params;
  return <AssignmentsPage area="teach" courseId={id} />;
}
