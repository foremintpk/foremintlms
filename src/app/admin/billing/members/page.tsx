import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ListToolbar } from "@/components/common/list-toolbar";
import { PaginationBar } from "@/components/common/pagination-bar";
import { EmptyState } from "@/components/common/empty-state";
import { LocalTime } from "@/components/common/local-time";
import { StatusBadge } from "@/components/common/status-badge";
import { requireAdmin } from "@/lib/auth/guards";
import { parseListParams } from "@/lib/list-params";
import { listCompanyMembers } from "@/lib/services/invoicing/queries";
import { createAdminClient } from "@/lib/supabase/admin";

export const instant = false;

export const metadata: Metadata = { title: "Company members" };

export default async function CompanyMembersPage({ searchParams }: PageProps<"/admin/billing/members">) {
  await requireAdmin("/admin/billing/members");
  const raw = await searchParams;
  const params = parseListParams(raw, { filterKeys: ["status", "company", "role"], pageSize: 25 });
  const [{ rows, total }, { data: companies }] = await Promise.all([
    listCompanyMembers({ ...params, filters: { status: "active", ...params.filters } }),
    createAdminClient().from("companies").select("id, name").neq("status", "archived").order("name").limit(300),
  ]);

  return (
    <>
      <PageHeader title="Company members" description="Everyone who has access through a company. Each person has their own Student account and progress." />
      <ListToolbar
        searchPlaceholder="Name, email or company"
        filters={[
          { key: "status", label: "Statuses", options: [{ value: "active", label: "Active" }, { value: "removed", label: "Removed" }] },
          { key: "role", label: "Roles", options: [{ value: "manager", label: "Team managers" }] },
          { key: "company", label: "Companies", options: (companies ?? []).map((c) => ({ value: c.id, label: c.name })) },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState icon={Users} title="No members found" description="People appear here once they accept a company invitation." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/students/${m.user_id}`} className="font-medium hover:underline">
                      {m.name || m.email}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{m.email}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/billing/companies/${m.company.id}?tab=members`} className="text-primary hover:underline">
                      {m.company.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs">{m.can_invite_members ? "Team manager" : "Employee"}</td>
                  <td className="px-4 py-3 text-xs">
                    <LocalTime value={m.joined_at} format="date" />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={m.membership_status === "active" ? (m.company.access_status === "active" && m.company.status === "active" ? "active" : "expired") : "removed"} label={m.membership_status !== "active" ? "Removed" : m.company.status === "suspended" ? "Company suspended" : m.company.access_status === "active" ? "Has access" : "No active package"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <PaginationBar basePath="/admin/billing/members" searchParams={raw} page={params.page} pageSize={params.pageSize} total={total} />
    </>
  );
}
