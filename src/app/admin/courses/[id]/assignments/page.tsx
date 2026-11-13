import { AssignmentsPage } from "@/components/course-builder/pages/builder-pages";

export const instant = false;
export const metadata = { title: "Assignments" };

export default async function Page({ params }: PageProps<"/admin/courses/[id]/assignments">) {
  const { id } = await params;
  return <AssignmentsPage area="admin" courseId={id} />;
}
