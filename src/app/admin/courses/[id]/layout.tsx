import { CourseBuilderLayout } from "@/components/course-builder/pages/builder-pages";

export const instant = false;

export default async function Layout({ children, params }: LayoutProps<"/admin/courses/[id]">) {
  const { id } = await params;
  return (
    <CourseBuilderLayout area="admin" courseId={id}>
      {children}
    </CourseBuilderLayout>
  );
}
