import { FolderTree } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { CategoryManager, CategoryFormDialog, type CategoryRow, type CourseOption } from "@/components/admin/categories/category-manager";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export const instant = false;
export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  await requireAdmin("/admin/categories");
  const supabase = await createClient();
  const [cats, courses] = await Promise.all([
    supabase
      .from("course_categories")
      .select("id, slug, name, short_description, description, image_url, icon, accent_color, status, sort_order, seo_title, seo_description")
      .order("sort_order"),
    supabase.from("courses").select("id, title, status, category_id").order("title"),
  ]);
  if (cats.error) throw new Error(cats.error.message);
  if (courses.error) throw new Error(courses.error.message);
  const courseRows = (courses.data ?? []) as CourseOption[];
  const counts = new Map<string, number>();
  for (const c of courseRows) if (c.category_id) counts.set(c.category_id, (counts.get(c.category_id) ?? 0) + 1);
  const categories = ((cats.data ?? []) as Omit<CategoryRow, "course_count">[]).map((c) => ({ ...c, course_count: counts.get(c.id) ?? 0 }));

  return (
    <>
      <PageHeader
        title="Categories"
        description="Group courses by subject. Drag rows to change the order they appear on the website."
        actions={<CategoryFormDialog trigger={<Button>New category</Button>} />}
      />
      {categories.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title="No categories yet"
          description="Create a category, then assign courses to it."
          action={<CategoryFormDialog trigger={<Button>New category</Button>} />}
        />
      ) : (
        <CategoryManager categories={categories} courses={courseRows} />
      )}
    </>
  );
}
