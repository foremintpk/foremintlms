import { CurriculumPage } from "@/components/course-builder/pages/builder-pages";

export const instant = false;
export const metadata = { title: "Curriculum" };

export default async function Page({ params }: PageProps<"/admin/courses/[id]/curriculum">) {
  const { id } = await params;
  return <CurriculumPage area="admin" courseId={id} />;
}
