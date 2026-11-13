import { QuizzesPage } from "@/components/course-builder/pages/builder-pages";

export const instant = false;
export const metadata = { title: "Quizzes" };

export default async function Page({ params }: PageProps<"/teach/courses/[id]/quizzes">) {
  const { id } = await params;
  return <QuizzesPage area="teach" courseId={id} />;
}
