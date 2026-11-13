import { LessonEditorPage } from "@/components/course-builder/pages/builder-pages";

export const instant = false;
export const metadata = { title: "Lesson editor" };

export default async function Page({ params }: PageProps<"/admin/courses/[id]/lessons/[lessonId]">) {
  const { id, lessonId } = await params;
  return <LessonEditorPage area="admin" courseId={id} lessonId={lessonId} />;
}
