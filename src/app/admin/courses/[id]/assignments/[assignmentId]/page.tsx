import { AssignmentEditorPage } from "@/components/course-builder/pages/builder-pages";

export const instant = false;
export const metadata = { title: "Assignment editor" };

export default async function Page({ params }: PageProps<"/admin/courses/[id]/assignments/[assignmentId]">) {
  const { id, assignmentId } = await params;
  return <AssignmentEditorPage area="admin" courseId={id} assignmentId={assignmentId} />;
}
