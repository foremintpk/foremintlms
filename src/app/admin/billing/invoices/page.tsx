import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, FilePlus2, Receipt } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ListToolbar } from "@/components/common/list-toolbar";
import { PaginationBar } from "@/components/common/pagination-bar";
import { EmptyState } from "@/components/common/empty-state";
import { LocalTime } from "@/components/common/local-time";
import { DateRangeFilter } from "@/components/billing/date-range-filter";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/invoicing/copy-button";
import { InvoiceStatusBadge } from "@/components/invoicing/invoice-status-badge";
import { requireAdmin } from "@/lib/auth/guards";
import { parseListParams } from "@/lib/list-params";
import { listCustomInvoices, listInvoiceCreators } from "@/lib/services/invoicing/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { INVOICE_CURRENCIES, INVOICE_STATUS_LABEL, accessTermsLabel, formatMinor, isPayable, type CourseSnapshotItem, type InvoiceStatus } from "@/lib/domain/invoicing";

export const instant = false;

export const metadata: Metadata = { title: "Custom invoices" };

export default async function CustomInvoicesPage({ searchParams }: PageProps<"/admin/billing/invoices">) {
  await requireAdmin("/admin/billing/invoices");
  const raw = await searchParams;
  const params = parseListParams(raw, {
    filterKeys: ["type", "status", "currency", "billing", "company", "course", "creator", "from", "to"],
    sortable: ["created_at", "due_at", "paid_at", "amount_minor"],
    defaultSort: "created_at",
  });
  const admin = createAdminClient();
  const [{ rows, total }, creators, { data: companies }, { data: courses }] = await Promise.all([
    listCustomInvoices(params),
    listInvoiceCreators(),
    admin.from("companies").select("id, name").neq("status", "archived").order("name").limit(200),
    admin.from("courses").select("id, title").order("title").limit(300),
  ]);

  return (
    <>
      <PageHeader
        title="Custom invoices"
        description="Invoices with negotiated prices and access terms. Each has its own Whop invoice and payment link."
        actions={
          <Button asChild>
            <Link href="/admin/billing/invoices/new">
              <FilePlus2 aria-hidden />
              Create custom invoice
            </Link>
          </Button>
        }
      />
      <ListToolbar
        searchPlaceholder="Number, customer, company or description"
        filters={[
          { key: "status", label: "Statuses", options: [{ value: "open", label: "Open (unpaid)" }, ...Object.entries(INVOICE_STATUS_LABEL).map(([value, label]) => ({ value, label }))] },
          { key: "type", label: "Customer types", options: [{ value: "individual", label: "Individuals" }, { value: "company", label: "Companies" }] },
          { key: "billing", label: "Payment types", options: [{ value: "one_time", label: "One-time" }, { value: "recurring", label: "Recurring" }] },
          { key: "currency", label: "Currencies", options: INVOICE_CURRENCIES.map((c) => ({ value: c.code, label: c.code.toUpperCase() })) },
          { key: "company", label: "Companies", options: (companies ?? []).map((c) => ({ value: c.id, label: c.name })) },
          { key: "course", label: "Courses", options: (courses ?? []).map((c) => ({ value: c.id, label: c.title })) },
          { key: "creator", label: "Created by", options: creators.map((c) => ({ value: c.id, label: c.name })) },
        ]}
      >
        <DateRangeFilter />
      </ListToolbar>

      {rows.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={params.q || Object.keys(params.filters).length ? "No invoices match" : "No custom invoices yet"}
          description="Create an invoice for a negotiated individual or company package; Whop handles the payment."
          action={
            <Button asChild>
              <Link href="/admin/billing/invoices/new">Create custom invoice</Link>
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[1180px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Description & courses</th>
                <th className="px-4 py-3 font-medium">Terms</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Dates</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((inv) => {
                const snapshot = (inv.selected_course_snapshot as unknown as CourseSnapshotItem[]) ?? [];
                const link = inv.mapping?.payment_url && isPayable(inv.status as InvoiceStatus) ? inv.mapping.payment_url : null;
                return (
                  <tr key={inv.id} className="align-top">
                    <td className="px-4 py-3">
                      <Link href={`/admin/billing/invoices/${inv.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
                        {inv.invoice_number}
                      </Link>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{inv.invoice_type === "company" ? "Company" : "Individual"}</span>
                    </td>
                    <td className="max-w-[200px] px-4 py-3">
                      <p className="truncate font-medium">{inv.company_name ?? inv.customer_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{inv.customer_email}</p>
                    </td>
                    <td className="max-w-[260px] px-4 py-3">
                      <p className="line-clamp-2">{inv.invoice_description}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {inv.includes_future_courses ? "All courses + future" : `${snapshot.length} course${snapshot.length === 1 ? "" : "s"}`}
                      </p>
                    </td>
                    <td className="max-w-[200px] px-4 py-3 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">{inv.billing_type === "recurring" ? "Recurring" : "One-time"}</p>
                      <p>{accessTermsLabel(inv as never)}</p>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                      {formatMinor(inv.amount_minor, inv.currency)}
                      <span className="block text-xs text-muted-foreground">{inv.currency.toUpperCase()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <InvoiceStatusBadge status={inv.status} />
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap text-muted-foreground">
                      <p>
                        Created <LocalTime value={inv.created_at} format="date" />
                      </p>
                      {inv.due_at ? (
                        <p>
                          Due <LocalTime value={inv.due_at} format="date" />
                        </p>
                      ) : null}
                      {inv.paid_at ? (
                        <p className="text-success">
                          Paid <LocalTime value={inv.paid_at} format="date" />
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {link ? (
                          <>
                            <CopyButton value={link} label="Copy link" size="xs" variant="ghost" />
                            <Button asChild size="icon-sm" variant="ghost" title="Open payment link">
                              <a href={link} target="_blank" rel="noopener noreferrer" aria-label={`Open payment link for ${inv.invoice_number}`}>
                                <ExternalLink aria-hidden />
                              </a>
                            </Button>
                          </>
                        ) : null}
                        <Button asChild size="xs" variant="outline">
                          <Link href={`/admin/billing/invoices/${inv.id}`}>View</Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <PaginationBar basePath="/admin/billing/invoices" searchParams={raw} page={params.page} pageSize={params.pageSize} total={total} />
    </>
  );
}
