import Link from "next/link";
import { Newspaper } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ListToolbar } from "@/components/common/list-toolbar";
import { PaginationBar } from "@/components/common/pagination-bar";
import { StatusBadge } from "@/components/common/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NewPostDialog } from "@/components/admin/blog/post-editor";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { escapeLike, parseListParams } from "@/lib/list-params";
import { formatDateTime } from "@/lib/format";

export const instant = false;
export const metadata = { title: "Blog" };

interface Row {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  author_name: string | null;
  status: string;
  published_at: string | null;
  updated_at: string;
  reading_minutes: number | null;
}

export default async function BlogAdminPage({ searchParams }: PageProps<"/admin/blog">) {
  await requireAdmin("/admin/blog");
  const sp = await searchParams;
  const lp = parseListParams(sp, { filterKeys: ["status"] });
  const supabase = await createClient();
  let q = supabase
    .from("blog_posts")
    .select("id, title, slug, category, author_name, status, published_at, updated_at, reading_minutes", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(lp.from, lp.to);
  if (lp.filters.status) q = q.eq("status", lp.filters.status);
  if (lp.q) q = q.ilike("title", `%${escapeLike(lp.q)}%`);
  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];

  return (
    <>
      <PageHeader title="Blog" description="Articles and educational resources for the public website." actions={<NewPostDialog />} />
      <ListToolbar
        searchPlaceholder="Search titles"
        filters={[
          {
            key: "status",
            label: "Statuses",
            options: [
              { value: "draft", label: "Draft" },
              { value: "scheduled", label: "Scheduled" },
              { value: "published", label: "Published" },
              { value: "archived", label: "Archived" },
            ],
          },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState icon={Newspaper} title={lp.q || lp.filters.status ? "No posts match" : "No posts yet"} description="Write your first article." action={<NewPostDialog />} />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="max-md:hidden">Category</TableHead>
                  <TableHead className="max-sm:hidden">Publish date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/admin/blog/${p.id}`} className="font-medium hover:underline">
                        {p.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {p.author_name ?? "No author"}
                        {p.reading_minutes ? ` · ${p.reading_minutes} min read` : ""}
                      </p>
                    </TableCell>
                    <TableCell className="max-md:hidden">{p.category ?? "—"}</TableCell>
                    <TableCell className="max-sm:hidden">{p.published_at ? formatDateTime(p.published_at) : "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationBar basePath="/admin/blog" searchParams={sp} page={lp.page} pageSize={lp.pageSize} total={count ?? 0} />
        </>
      )}
    </>
  );
}
