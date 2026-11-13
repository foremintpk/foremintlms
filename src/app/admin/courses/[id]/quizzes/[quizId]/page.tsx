import { QuizEditorPage } from "@/components/course-builder/pages/builder-pages";

export const instant = false;
export const metadata = { title: "Quiz editor" };

export default async function Page({ params }: PageProps<"/admin/courses/[id]/quizzes/[quizId]">) {
  const { id, quizId } = await params;
  return <QuizEditorPage area="admin" courseId={id} quizId={quizId} />;
}
