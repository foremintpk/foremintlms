import { AssignmentEditorPage } from "@/components/course-builder/pages/builder-pages";

export const instant = false;
export const metadata = { title: "Assignment editor" };

export default async function Page({ params }: PageProps<"/teach/courses/[id]/assignments/[assignmentId]">) {
  const { id, assignmentId } = await params;
  return <AssignmentEditorPage area="teach" courseId={id} assignmentId={assignmentId} />;
}
