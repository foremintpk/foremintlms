import { QuestionBankPage } from "@/components/course-builder/pages/builder-pages";

export const instant = false;
export const metadata = { title: "Question bank" };

export default async function Page({ params }: PageProps<"/teach/courses/[id]/quizzes/banks/[bankId]">) {
  const { id, bankId } = await params;
  return <QuestionBankPage area="teach" courseId={id} bankId={bankId} />;
}
