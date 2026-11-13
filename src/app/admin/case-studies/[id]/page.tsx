import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { CaseStudyEditor, type CaseStudyDetail } from "@/components/admin/case-studies/case-study-editor";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export const instant = false;
export const metadata = { title: "Edit story" };

export default async function CaseStudyEditPage({ params }: PageProps<"/admin/case-studies/[id]">) {
  await requireAdmin("/admin/case-studies");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [res, courses] = await Promise.all([
    supabase
      .from("case_studies")
      .select(
        "id, kind, title, slug, summary, cover_image_url, customer_name, business_name, challenge, approach, implementation, outcome, media, course_ids, consent_confirmed, is_featured, status, published_at, seo_title, seo_description",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("courses").select("id, title, status").order("title"),
  ]);
  if (res.error) throw new Error(res.error.message);
  if (!res.data) notFound();
  const story = res.data as CaseStudyDetail;
  return (
    <>
      <PageHeader
        title={story.title}
        description={story.kind === "case_study" ? "Case study" : "Success story"}
        back={{ href: "/admin/case-studies", label: "All stories" }}
      />
      <CaseStudyEditor story={story} courses={(courses.data ?? []) as { id: string; title: string; status: string }[]} />
    </>
  );
}
