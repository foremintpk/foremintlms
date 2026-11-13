import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { PostEditor, type PostDetail } from "@/components/admin/blog/post-editor";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export const instant = false;
export const metadata = { title: "Edit post" };

export default async function BlogEditPage({ params }: PageProps<"/admin/blog/[id]">) {
  await requireAdmin("/admin/blog");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [res, cats] = await Promise.all([
    supabase
      .from("blog_posts")
      .select("id, title, slug, excerpt, body, cover_image_url, author_name, category, tags, reading_minutes, status, published_at, seo_title, seo_description")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("blog_posts").select("category").not("category", "is", null),
  ]);
  if (res.error) throw new Error(res.error.message);
  if (!res.data) notFound();
  const categories = [...new Set(((cats.data ?? []) as { category: string }[]).map((c) => c.category))].sort();
  const post = res.data as PostDetail;
  return (
    <>
      <PageHeader title={post.title} description="Write, schedule and publish this article." back={{ href: "/admin/blog", label: "All posts" }} />
      <PostEditor post={post} existingCategories={categories} />
    </>
  );
}
