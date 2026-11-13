import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ListToolbar } from "@/components/common/list-toolbar";
import { PaginationBar } from "@/components/common/pagination-bar";
import { LocalTime } from "@/components/common/local-time";
import { StatusBadge } from "@/components/common/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { JsonView } from "@/components/admin/json-view";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { escapeLike, parseListParams } from "@/lib/list-params";
import { cn } from "@/lib/utils";
import { daysAgoIso } from "@/lib/services/admin/metrics";

export const instant = false;
export const metadata = { title: "Security & audit" };

const SINCE: Record<string, number> = { "1d": 1, "7d": 7, "30d": 30, "90d": 90 };

const ENTITY_TYPES = [
  "user",
  "course",
  "course_category",
  "learning_path",
  "teacher_profile",
  "account_invitation",
  "payment",
  "pricing_plan",
  "integration",
  "platform_settings",
  "legal_document",
  "cms_section",
  "blog_post",
  "testimonial",
  "case_study",
  "announcement",
  "report",
];

const AUTH_EVENTS = [
  "sign_in",
  "sign_in_failed",
  "sign_out",
  "sign_up",
  "password_reset_requested",
  "password_changed",
  "email_verified",
  "mfa_enrolled",
  "mfa_verified",
  "mfa_removed",
  "session_revoked",
  "invitation_accepted",
];

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireAdmin("/admin/audit");
  const sp = await searchParams;
  const tab = sp.tab === "auth" ? "auth" : "audit";
  const lp = parseListParams(sp, { filterKeys: ["entity", "since", "event", "actor"], pageSize: 50 });
  const supabase = await createClient();
  const sinceIso = lp.filters.since && SINCE[lp.filters.since] ? daysAgoIso(SINCE[lp.filters.since]) : null;

  const tabs = (
    <nav aria-label="Logs" className="mb-6 flex gap-1 border-b">
      {[
        { key: "audit", label: "Admin activity", href: "/admin/audit" },
        { key: "auth", label: "Sign-in & security events", href: "/admin/audit?tab=auth" },
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
  const sinceFilter = {
    key: "since",
    label: "Time",
    options: [
      { value: "1d", label: "Last 24 hours" },
      { value: "7d", label: "Last 7 days" },
      { value: "30d", label: "Last 30 days" },
      { value: "90d", label: "Last 90 days" },
    ],
  };

  if (tab === "auth") {
    let q = supabase
      .from("auth_events")
      .select("id, user_id, email, event, ip_address, user_agent, metadata, created_at, profiles(full_name)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(lp.from, lp.to);
    if (lp.filters.event) q = q.eq("event", lp.filters.event);
    if (sinceIso) q = q.gte("created_at", sinceIso);
    if (lp.q) q = q.ilike("email", `%${escapeLike(lp.q)}%`);
    const { data, error, count } = await q;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as {
      id: string;
      user_id: string | null;
      email: string | null;
      event: string;
      ip_address: string | null;
      user_agent: string | null;
      metadata: unknown;
      created_at: string;
      profiles: { full_name: string } | { full_name: string }[] | null;
    }[];
    return (
      <>
        <PageHeader title="Security & audit" description="Sign-ins, failed attempts, MFA changes, password resets and revoked sessions." />
        {tabs}
        <ListToolbar
          searchPlaceholder="Search email"
          filters={[{ key: "event", label: "Events", options: AUTH_EVENTS.map((e) => ({ value: e, label: e.replace(/_/g, " ") })) }, sinceFilter]}
        />
        {rows.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No events match" />
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead className="max-md:hidden">IP address</TableHead>
                    <TableHead className="max-lg:hidden">Device</TableHead>
                    <TableHead className="w-24">
                      <span className="sr-only">Details</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">
                        <LocalTime value={r.created_at} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={r.event}
                          label={r.event.replace(/_/g, " ")}
                          tone={r.event === "sign_in_failed" ? "danger" : r.event.startsWith("mfa") || r.event === "session_revoked" ? "warning" : "neutral"}
                        />
                      </TableCell>
                      <TableCell>
                        {r.user_id ? (
                          <Link href={`/admin/students/${r.user_id}`} className="hover:underline">
                            {one(r.profiles)?.full_name || r.email || "Account"}
                          </Link>
                        ) : (
                          (r.email ?? "—")
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs max-md:hidden">{r.ip_address ?? "—"}</TableCell>
                      <TableCell className="max-w-56 truncate text-xs text-muted-foreground max-lg:hidden" title={r.user_agent ?? undefined}>
                        {r.user_agent ?? "—"}
                      </TableCell>
                      <TableCell>
                        <JsonView title={`Event: ${r.event}`} data={r.metadata} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <PaginationBar basePath="/admin/audit" searchParams={sp} page={lp.page} pageSize={lp.pageSize} total={count ?? 0} />
          </>
        )}
      </>
    );
  }

  let q = supabase
    .from("audit_logs")
    .select("id, actor_id, actor_role, action, entity_type, entity_id, summary, metadata, ip_address, created_at, profiles(full_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(lp.from, lp.to);
  if (lp.filters.entity) q = q.eq("entity_type", lp.filters.entity);
  if (lp.filters.actor && /^[0-9a-f-]{36}$/i.test(lp.filters.actor)) q = q.eq("actor_id", lp.filters.actor);
  if (sinceIso) q = q.gte("created_at", sinceIso);
  if (lp.q) q = q.or(`action.ilike.%${escapeLike(lp.q)}%,summary.ilike.%${escapeLike(lp.q)}%,entity_id.ilike.%${escapeLike(lp.q)}%`);
  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as {
    id: string;
    actor_id: string | null;
    actor_role: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    summary: string | null;
    metadata: unknown;
    ip_address: string | null;
    created_at: string;
    profiles: { full_name: string } | { full_name: string }[] | null;
  }[];

  return (
    <>
      <PageHeader
        title="Security & audit"
        description="Every sensitive change made by administrators, instructors and the system. Entries can't be edited or deleted."
      />
      {tabs}
      <ListToolbar
        searchPlaceholder="Search action, summary or ID"
        filters={[{ key: "entity", label: "Record types", options: ENTITY_TYPES.map((e) => ({ value: e, label: e.replace(/_/g, " ") })) }, sinceFilter]}
      />
      {rows.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No activity matches" description="Administrative changes are recorded here automatically." />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="max-md:hidden">Record</TableHead>
                  <TableHead className="w-24">
                    <span className="sr-only">Details</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">
                      <LocalTime value={r.created_at} />
                    </TableCell>
                    <TableCell>
                      {r.actor_id ? (
                        <Link href={`/admin/audit?actor=${r.actor_id}`} className="hover:underline">
                          {one(r.profiles)?.full_name || "Unknown"}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">System</span>
                      )}
                      {r.actor_role ? <span className="block text-xs text-muted-foreground capitalize">{r.actor_role}</span> : null}
                    </TableCell>
                    <TableCell className="max-w-sm">
                      <p className="font-mono text-xs">{r.action}</p>
                      {r.summary ? <p className="truncate text-sm text-muted-foreground">{r.summary}</p> : null}
                    </TableCell>
                    <TableCell className="max-md:hidden">
                      <span className="text-xs text-muted-foreground">{r.entity_type.replace(/_/g, " ")}</span>
                      {r.entity_id ? <span className="block max-w-40 truncate font-mono text-xs">{r.entity_id}</span> : null}
                    </TableCell>
                    <TableCell>
                      <JsonView title={r.action} data={{ ...((r.metadata as object) ?? {}), ...(r.ip_address ? { ip_address: r.ip_address } : {}) }} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationBar basePath="/admin/audit" searchParams={sp} page={lp.page} pageSize={lp.pageSize} total={count ?? 0} />
        </>
      )}
    </>
  );
}
