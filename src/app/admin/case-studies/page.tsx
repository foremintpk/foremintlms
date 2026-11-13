import Link from "next/link";
import { Trophy } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ListToolbar } from "@/components/common/list-toolbar";
import { StatusBadge } from "@/components/common/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NewCaseStudyDialog } from "@/components/admin/case-studies/case-study-editor";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { escapeLike, parseListParams } from "@/lib/list-params";
import { formatDate } from "@/lib/format";

export const instant = false;
export const metadata = { title: "Case studies" };

interface Row {
  id: string;
  kind: string;
  title: string;
  slug: string;
  customer_name: string | null;
  business_name: string | null;
  consent_confirmed: boolean;
  status: string;
  published_at: string | null;
  updated_at: string;
}

export default async function CaseStudiesPage({ searchParams }: PageProps<"/admin/case-studies">) {
  await requireAdmin("/admin/case-studies");
  const sp = await searchParams;
  const lp = parseListParams(sp, { filterKeys: ["kind", "status"] });
  const supabase = await createClient();
  let q = supabase
    .from("case_studies")
    .select("id, kind, title, slug, customer_name, business_name, consent_confirmed, status, published_at, updated_at")
    .order("updated_at", { ascending: false });
  if (lp.filters.kind) q = q.eq("kind", lp.filters.kind);
  if (lp.filters.status) q = q.eq("status", lp.filters.status);
  if (lp.q) q = q.ilike("title", `%${escapeLike(lp.q)}%`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];

  return (
    <>
      <PageHeader
        title="Case studies & success stories"
        description="Real learning journeys, published only with the person's or business's permission. Never include results you can't verify."
        actions={<NewCaseStudyDialog />}
      />
      <ListToolbar
        searchPlaceholder="Search titles"
        filters={[
          { key: "kind", label: "Types", options: [{ value: "case_study", label: "Case studies" }, { value: "success_story", label: "Success stories" }] },
          { key: "status", label: "Statuses", options: [{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }, { value: "archived", label: "Archived" }] },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState icon={Trophy} title="Nothing here yet" description="Write up a learner's journey once they've agreed to share it." action={<NewCaseStudyDialog />} />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="max-sm:hidden">Type</TableHead>
                <TableHead className="max-md:hidden">Consent</TableHead>
                <TableHead className="max-md:hidden">Published</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/admin/case-studies/${r.id}`} className="font-medium hover:underline">
                      {r.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">{[r.customer_name, r.business_name].filter(Boolean).join(" · ") || "—"}</p>
                  </TableCell>
                  <TableCell className="max-sm:hidden">{r.kind === "case_study" ? "Case study" : "Success story"}</TableCell>
                  <TableCell className="max-md:hidden">
                    <StatusBadge status={r.consent_confirmed ? "approved" : "pending"} label={r.consent_confirmed ? "Recorded" : "Missing"} />
                  </TableCell>
                  <TableCell className="max-md:hidden">{r.published_at ? formatDate(r.published_at) : "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
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
