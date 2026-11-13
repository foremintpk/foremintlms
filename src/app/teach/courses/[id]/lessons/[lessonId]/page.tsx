import { LessonEditorPage } from "@/components/course-builder/pages/builder-pages";

export const instant = false;
export const metadata = { title: "Lesson editor" };

export default async function Page({ params }: PageProps<"/teach/courses/[id]/lessons/[lessonId]">) {
  const { id, lessonId } = await params;
  return <LessonEditorPage area="teach" courseId={id} lessonId={lessonId} />;
}
