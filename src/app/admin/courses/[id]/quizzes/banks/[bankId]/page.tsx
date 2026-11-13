import { QuestionBankPage } from "@/components/course-builder/pages/builder-pages";

export const instant = false;
export const metadata = { title: "Question bank" };

export default async function Page({ params }: PageProps<"/admin/courses/[id]/quizzes/banks/[bankId]">) {
  const { id, bankId } = await params;
  return <QuestionBankPage area="admin" courseId={id} bankId={bankId} />;
}
