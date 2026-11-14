import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ListToolbar } from "@/components/common/list-toolbar";
import { PaginationBar } from "@/components/common/pagination-bar";
import { EmptyState } from "@/components/common/empty-state";
import { LocalTime } from "@/components/common/local-time";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { CreateCompanyDialog } from "@/components/invoicing/company-admin";
import { requireAdmin } from "@/lib/auth/guards";
import { parseListParams } from "@/lib/list-params";
import { listCompanies } from "@/lib/services/invoicing/queries";

export const instant = false;

export const metadata: Metadata = { title: "Company accounts" };

function companyState(c: { status: string; access_status: string }) {
  if (c.status === "suspended") return { status: "suspended", label: "Suspended", tone: "danger" as const };
  if (c.status === "archived") return { status: "archived", label: "Archived", tone: "neutral" as const };
  if (c.access_status === "active") return { status: "active", label: "Active", tone: "success" as const };
  if (c.access_status === "expired") return { status: "expired", label: "Access ended", tone: "neutral" as const };
  return { status: "pending", label: "No paid package yet", tone: "info" as const };
}

export default async function CompaniesPage({ searchParams }: PageProps<"/admin/billing/companies">) {
  await requireAdmin("/admin/billing/companies");
  const raw = await searchParams;
  const params = parseListParams(raw, { filterKeys: ["status"], sortable: ["created_at", "name"], defaultSort: "created_at" });
  const { rows, total } = await listCompanies(params);

  return (
    <>
      <PageHeader
        title="Company accounts"
        description="Company workspaces created from paid company invoices. Members share the company's package with their own logins."
        actions={
          <>
            <CreateCompanyDialog />
            <Button asChild>
              <Link href="/admin/billing/invoices/new">Create company invoice</Link>
            </Button>
          </>
        }
      />
      <ListToolbar
        searchPlaceholder="Company, contact or invoice number"
        filters={[
          {
            key: "status",
            label: "Statuses",
            options: [
              { value: "active", label: "Active" },
              { value: "expired", label: "Access ended" },
              { value: "pending", label: "No paid package" },
              { value: "suspended", label: "Suspended" },
              { value: "archived", label: "Archived" },
            ],
          },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState icon={Building2} title="No companies found" description="A company is created automatically when its first company invoice is paid." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Primary contact</th>
                <th className="px-4 py-3 text-right font-medium">Members</th>
                <th className="px-4 py-3 font-medium">Access until</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((c) => {
                const st = companyState(c);
                return (
                  <tr key={c.id}>
                    <td className="px-4 py-3">
                      <Link href={`/admin/billing/companies/${c.id}`} className="font-medium text-primary hover:underline">
                        {c.name}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        Since <LocalTime value={c.created_at} format="date" />
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p>{c.primary_contact_name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{c.primary_contact_email}</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {c.memberCount}
                      {c.seat_limit ? <span className="text-muted-foreground"> / {c.seat_limit}</span> : null}
                    </td>
                    <td className="px-4 py-3">{c.unlimited ? "No end date" : c.accessEndsAt ? <LocalTime value={c.accessEndsAt} format="date" /> : "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={st.status} label={st.label} tone={st.tone} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button asChild size="xs" variant="outline">
                        <Link href={`/admin/billing/companies/${c.id}`}>Open</Link>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <PaginationBar basePath="/admin/billing/companies" searchParams={raw} page={params.page} pageSize={params.pageSize} total={total} />
    </>
  );
}
