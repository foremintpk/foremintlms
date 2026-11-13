import { AdminCourseListPage } from "@/components/course-builder/pages/course-list-pages";

export const instant = false;
export const metadata = { title: "Courses" };

export default async function Page({ searchParams }: PageProps<"/admin/courses">) {
  return <AdminCourseListPage searchParams={await searchParams} />;
}
