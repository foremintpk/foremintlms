import { NewCoursePage } from "@/components/course-builder/pages/course-list-pages";

export const instant = false;
export const metadata = { title: "New course" };

export default function Page() {
  return <NewCoursePage area="teach" />;
}
