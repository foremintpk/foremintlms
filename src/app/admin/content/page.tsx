import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { PageSeoForm, SectionList, type SectionRow } from "@/components/admin/content/section-editor";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { PAGE_SECTIONS, SECTION_LABELS, type SectionKey } from "@/lib/cms/sections";
import { cn } from "@/lib/utils";

export const instant = false;
export const metadata = { title: "Website content" };

const PAGES = [
  { slug: "home", label: "Home page", path: "/" },
  { slug: "about", label: "About page", path: "/about" },
];

interface PageRow {
  id: string;
  slug: string;
  title: string;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
}

export default async function ContentPage({ searchParams }: PageProps<"/admin/content">) {
  await requireAdmin("/admin/content");
  const sp = await searchParams;
  const current = PAGES.find((p) => p.slug === sp.page) ?? PAGES[0];
  const supabase = await createClient();
  const { data: page, error } = await supabase
    .from("cms_pages")
    .select("id, slug, title, seo_title, seo_description, og_image_url")
    .eq("slug", current.slug)
    .maybeSingle();
  if (error) throw new Error(error.message);

  let sections: SectionRow[] = [];
  if (page) {
    const { data, error: sErr } = await supabase
      .from("cms_sections")
      .select("id, section_key, sort_order, is_visible, content, updated_at")
      .eq("page_id", page.id)
      .order("sort_order");
    if (sErr) throw new Error(sErr.message);
    const stored = (data ?? []) as Omit<SectionRow, "label">[];
    const keys = PAGE_SECTIONS[current.slug] ?? [];
    sections = keys
      .map((key) => {
        const row = stored.find((s) => s.section_key === key);
        return row
          ? { ...row, label: SECTION_LABELS[key as SectionKey] }
          : { id: `missing:${key}`, section_key: key, sort_order: 999, is_visible: false, content: {}, updated_at: null, label: SECTION_LABELS[key as SectionKey] };
      })
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  return (
    <>
      <PageHeader
        title="Website content"
        description="Edit the text, images and order of sections on the public pages. Changes appear on the site as soon as you save."
        actions={
          <Button asChild variant="outline">
            <Link href={current.path} target="_blank" rel="noopener">
              <ExternalLink /> View {current.label.toLowerCase()}
            </Link>
          </Button>
        }
      />
      <nav aria-label="Pages" className="mb-6 flex gap-1 border-b">
        {PAGES.map((p) => (
          <Link
            key={p.slug}
            href={`/admin/content?page=${p.slug}`}
            aria-current={p.slug === current.slug ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              p.slug === current.slug ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {p.label}
          </Link>
        ))}
      </nav>
      {!page ? (
        <EmptyState title="This page isn't set up" description="The seed data for this page is missing. Re-run the content seed migration." />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <SectionList pageId={page.id} sections={sections} />
          <PageSeoForm page={page as PageRow} />
        </div>
      )}
    </>
  );
}
