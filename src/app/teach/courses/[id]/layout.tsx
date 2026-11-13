import { CourseBuilderLayout } from "@/components/course-builder/pages/builder-pages";

export const instant = false;

export default async function Layout({ children, params }: LayoutProps<"/teach/courses/[id]">) {
  const { id } = await params;
  return (
    <CourseBuilderLayout area="teach" courseId={id}>
      {children}
    </CourseBuilderLayout>
  );
}
