import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { ProgramEditor, type ProgramCourse, type ProgramDetail } from "@/components/admin/programs/program-editor";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export const instant = false;
export const metadata = { title: "Edit program" };

export default async function ProgramDetailPage({ params }: PageProps<"/admin/programs/[id]">) {
  await requireAdmin("/admin/programs");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [programRes, linksRes, coursesRes] = await Promise.all([
    supabase
      .from("learning_paths")
      .select("id, title, slug, summary, description, image_url, level, status, is_featured, sort_order")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("learning_path_courses").select("course_id, is_required, sort_order").eq("learning_path_id", id).order("sort_order"),
    supabase.from("courses").select("id, title, status").order("title"),
  ]);
  if (programRes.error) throw new Error(programRes.error.message);
  if (!programRes.data) notFound();
  const courses = (coursesRes.data ?? []) as { id: string; title: string; status: string }[];
  const byId = new Map(courses.map((c) => [c.id, c]));
  const items: ProgramCourse[] = ((linksRes.data ?? []) as { course_id: string; is_required: boolean }[])
    .filter((l) => byId.has(l.course_id))
    .map((l) => ({ id: l.course_id, title: byId.get(l.course_id)!.title, status: byId.get(l.course_id)!.status, is_required: l.is_required }));

  const program = programRes.data as ProgramDetail;
  return (
    <>
      <PageHeader title={program.title} description="Program details and course order." back={{ href: "/admin/programs", label: "All programs" }} />
      <ProgramEditor program={program} items={items} allCourses={courses} />
    </>
  );
}
