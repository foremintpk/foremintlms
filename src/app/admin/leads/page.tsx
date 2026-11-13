import Link from "next/link";
import { Download, Inbox, Mail } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ListToolbar } from "@/components/common/list-toolbar";
import { PaginationBar } from "@/components/common/pagination-bar";
import { StatusBadge } from "@/components/common/status-badge";
import { LocalTime } from "@/components/common/local-time";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LeadActions, LeadsBulkBar, UnsubscribeButton, type LeadRow } from "@/components/admin/leads/lead-actions";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { escapeLike, parseListParams } from "@/lib/list-params";
import { cn } from "@/lib/utils";

export const instant = false;
export const metadata = { title: "Leads & newsletter" };

interface SubscriberRow {
  id: string;
  email: string;
  status: string;
  source: string | null;
  consent_at: string;
  unsubscribed_at: string | null;
}

export default async function LeadsPage({ searchParams }: PageProps<"/admin/leads">) {
  await requireAdmin("/admin/leads");
  const sp = await searchParams;
  const tab = sp.tab === "newsletter" ? "newsletter" : "leads";
  const lp = parseListParams(sp, { filterKeys: ["status", "source"], pageSize: 25 });
  const supabase = await createClient();

  const tabs = (
    <nav aria-label="Lists" className="mb-6 flex gap-1 border-b">
      {[
        { key: "leads", label: "Enquiries", href: "/admin/leads" },
        { key: "newsletter", label: "Newsletter", href: "/admin/leads?tab=newsletter" },
      ].map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === tab ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            t.key === tab ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );

  if (tab === "newsletter") {
    let q = supabase
      .from("newsletter_subscriptions")
      .select("id, email, status, source, consent_at, unsubscribed_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(lp.from, lp.to);
    if (lp.filters.status) q = q.eq("status", lp.filters.status);
    if (lp.q) q = q.ilike("email", `%${escapeLike(lp.q)}%`);
    const { data, error, count } = await q;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as SubscriberRow[];
    return (
      <>
        <PageHeader
          title="Leads & newsletter"
          description="People who asked to hear from you."
          actions={
            <Button asChild variant="outline">
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download from a route handler, not a page */}
              <a href="/api/exports/newsletter">
                <Download /> Export CSV
              </a>
            </Button>
          }
        />
        {tabs}
        <ListToolbar
          searchPlaceholder="Search email"
          filters={[{ key: "status", label: "Statuses", options: [{ value: "subscribed", label: "Subscribed" }, { value: "unsubscribed", label: "Unsubscribed" }] }]}
        />
        {rows.length === 0 ? (
          <EmptyState icon={Mail} title="No subscribers yet" description="Newsletter sign-ups from the website footer and blog appear here." />
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead className="max-sm:hidden">Source</TableHead>
                    <TableHead className="max-md:hidden">Consent given</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-20">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.email}</TableCell>
                      <TableCell className="max-sm:hidden">{s.source ?? "—"}</TableCell>
                      <TableCell className="max-md:hidden">
                        <LocalTime value={s.consent_at} format="date" />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={s.status === "subscribed" ? "active" : "canceled"} label={s.status === "subscribed" ? "Subscribed" : "Unsubscribed"} />
                      </TableCell>
                      <TableCell>{s.status === "subscribed" ? <UnsubscribeButton id={s.id} email={s.email} /> : null}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <PaginationBar basePath="/admin/leads" searchParams={sp} page={lp.page} pageSize={lp.pageSize} total={count ?? 0} />
          </>
        )}
      </>
    );
  }

  let q = supabase
    .from("marketing_leads")
    .select("id, full_name, email, phone, subject, message, source, status, created_at, courses(title)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(lp.from, lp.to);
  if (lp.filters.status) q = q.eq("status", lp.filters.status);
  if (lp.filters.source) q = q.eq("source", lp.filters.source);
  if (lp.q) q = q.or(`full_name.ilike.%${escapeLike(lp.q)}%,email.ilike.%${escapeLike(lp.q)}%,subject.ilike.%${escapeLike(lp.q)}%`);
  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as unknown as (Omit<LeadRow, "course_title"> & { courses: { title: string } | { title: string }[] | null })[]).map((r) => ({
    ...r,
    course_title: Array.isArray(r.courses) ? (r.courses[0]?.title ?? null) : (r.courses?.title ?? null),
  }));

  return (
    <>
      <PageHeader
        title="Leads & newsletter"
        description="Enquiries from the contact form and course pages."
        actions={
          <Button asChild variant="outline">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download from a route handler, not a page */}
            <a href="/api/exports/leads">
              <Download /> Export CSV
            </a>
          </Button>
        }
      />
      {tabs}
      <ListToolbar
        searchPlaceholder="Search name, email or subject"
        filters={[
          {
            key: "status",
            label: "Statuses",
            options: [
              { value: "new", label: "New" },
              { value: "contacted", label: "Contacted" },
              { value: "closed", label: "Closed" },
              { value: "spam", label: "Spam" },
            ],
          },
          {
            key: "source",
            label: "Sources",
            options: [
              { value: "contact", label: "Contact form" },
              { value: "course_interest", label: "Course interest" },
              { value: "instructor_application", label: "Instructor application" },
              { value: "business", label: "Business" },
            ],
          },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState icon={Inbox} title="No enquiries" description="Messages sent from the contact form appear here." />
      ) : (
        <>
          <LeadsBulkBar ids={rows.filter((r) => r.status === "new").map((r) => r.id)} />
          <div className="overflow-hidden rounded-2xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead className="max-md:hidden">Subject</TableHead>
                  <TableHead className="max-sm:hidden">Received</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-36">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <p className="font-medium">{l.full_name}</p>
                      <a href={`mailto:${l.email}`} className="text-xs text-primary hover:underline">
                        {l.email}
                      </a>
                    </TableCell>
                    <TableCell className="max-w-xs max-md:hidden">
                      <p className="truncate">{l.subject || l.course_title || "—"}</p>
                      <p className="text-xs text-muted-foreground">{l.source.replace(/_/g, " ")}</p>
                    </TableCell>
                    <TableCell className="max-sm:hidden">
                      <LocalTime value={l.created_at} format="date" />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={l.status} />
                    </TableCell>
                    <TableCell>
                      <LeadActions lead={l} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationBar basePath="/admin/leads" searchParams={sp} page={lp.page} pageSize={lp.pageSize} total={count ?? 0} />
        </>
      )}
    </>
  );
}
