import { Quote } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ListToolbar } from "@/components/common/list-toolbar";
import { StatusBadge } from "@/components/common/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { TestimonialDeleteButton, TestimonialFormDialog, type TestimonialRow } from "@/components/admin/testimonials/testimonial-form";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { escapeLike, parseListParams } from "@/lib/list-params";

export const instant = false;
export const metadata = { title: "Testimonials" };

export default async function TestimonialsPage({ searchParams }: PageProps<"/admin/testimonials">) {
  await requireAdmin("/admin/testimonials");
  const sp = await searchParams;
  const lp = parseListParams(sp, { filterKeys: ["status"] });
  const supabase = await createClient();
  let q = supabase
    .from("testimonials")
    .select("id, person_name, person_role, company, avatar_url, quote, rating, category_id, course_id, consent_confirmed, is_featured, status, sort_order")
    .order("sort_order")
    .order("created_at", { ascending: false });
  if (lp.filters.status) q = q.eq("status", lp.filters.status);
  if (lp.q) q = q.or(`person_name.ilike.%${escapeLike(lp.q)}%,quote.ilike.%${escapeLike(lp.q)}%`);
  const [res, cats, courses] = await Promise.all([
    q,
    supabase.from("course_categories").select("id, name").order("sort_order"),
    supabase.from("courses").select("id, title").order("title"),
  ]);
  if (res.error) throw new Error(res.error.message);
  const rows = (res.data ?? []) as TestimonialRow[];
  const options = {
    categories: (cats.data ?? []) as { id: string; name: string }[],
    courses: (courses.data ?? []) as { id: string; title: string }[],
  };

  return (
    <>
      <PageHeader
        title="Testimonials"
        description="Only genuine feedback, published with the person's permission. The website hides this section when nothing is published."
        actions={<TestimonialFormDialog options={options} trigger={<Button>New testimonial</Button>} />}
      />
      <ListToolbar
        searchPlaceholder="Search name or quote"
        filters={[
          {
            key: "status",
            label: "Statuses",
            options: [
              { value: "draft", label: "Draft" },
              { value: "published", label: "Published" },
              { value: "archived", label: "Archived" },
            ],
          },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={Quote}
          title={lp.q || lp.filters.status ? "No testimonials match" : "No testimonials yet"}
          description="Add feedback from real learners once they've agreed to it being published."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead className="max-md:hidden">Quote</TableHead>
                <TableHead className="max-sm:hidden">Consent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <p className="font-medium">{t.person_name}</p>
                    <p className="text-xs text-muted-foreground">{[t.person_role, t.company].filter(Boolean).join(", ") || "—"}</p>
                  </TableCell>
                  <TableCell className="max-w-md max-md:hidden">
                    <p className="line-clamp-2 text-sm text-muted-foreground">“{t.quote}”</p>
                  </TableCell>
                  <TableCell className="max-sm:hidden">
                    <StatusBadge status={t.consent_confirmed ? "approved" : "pending"} label={t.consent_confirmed ? "Recorded" : "Missing"} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={t.status} />
                    {t.is_featured ? <span className="ml-2 text-xs text-muted-foreground">Featured</span> : null}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <TestimonialFormDialog
                        options={options}
                        testimonial={t}
                        trigger={
                          <Button size="sm" variant="ghost">
                            Edit
                          </Button>
                        }
                      />
                      <TestimonialDeleteButton id={t.id} name={t.person_name} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
