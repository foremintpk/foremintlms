import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { LocalTime } from "@/components/common/local-time";
import { EmptyState } from "@/components/common/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AccountActions, GrantAccessDialog, RevokeEntitlementButton } from "@/components/admin/students/student-actions";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";

export const instant = false;
export const metadata = { title: "Student" };

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

export default async function StudentDetailPage({ params }: PageProps<"/admin/students/[id]">) {
  const me = await requireAdmin("/admin/students");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();

  const [profileRes, privRes, rolesRes, enrollRes, entRes, payRes, ticketRes, certRes, activityRes, eventsRes, coursesRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name, display_name, avatar_url, headline, timezone, created_at").eq("id", id).maybeSingle(),
    supabase.from("profile_private").select("email, phone, country, status, suspended_reason, last_sign_in_at, deletion_requested_at").eq("user_id", id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", id),
    supabase
      .from("enrollments")
      .select("id, course_id, status, source, enrolled_at, completed_at, progress_percent, last_accessed_at, courses(title)")
      .eq("user_id", id)
      .order("enrolled_at", { ascending: false }),
    supabase
      .from("course_entitlements")
      .select("id, scope, course_id, source, status, starts_at, expires_at, grant_reason, revoke_reason, created_at, courses(title)")
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("payment_transactions")
      .select("id, status, total_cents, refunded_cents, currency, paid_at, created_at, products(name)")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("support_tickets").select("id, ticket_number, subject, status, created_at").eq("requester_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("certificates").select("id, certificate_number, course_title, issued_at, status").eq("user_id", id).order("issued_at", { ascending: false }),
    supabase
      .from("lesson_progress")
      .select("id, status, last_viewed_at, lessons(title), courses(title)")
      .eq("user_id", id)
      .order("last_viewed_at", { ascending: false })
      .limit(8),
    supabase.from("auth_events").select("id, event, created_at, ip_address").eq("user_id", id).order("created_at", { ascending: false }).limit(8),
    supabase.from("courses").select("id, title, status").in("status", ["published", "unpublished", "archived"]).order("title"),
  ]);
  if (profileRes.error) throw new Error(profileRes.error.message);
  if (!profileRes.data || !privRes.data) notFound();

  const profile = profileRes.data as { id: string; full_name: string; display_name: string | null; headline: string | null; timezone: string; created_at: string };
  const priv = privRes.data as {
    email: string;
    phone: string | null;
    country: string | null;
    status: "active" | "suspended";
    suspended_reason: string | null;
    last_sign_in_at: string | null;
    deletion_requested_at: string | null;
  };
  const roles = ((rolesRes.data ?? []) as { role: string }[]).map((r) => r.role);
  const enrollments = (enrollRes.data ?? []) as unknown as {
    id: string;
    course_id: string;
    status: string;
    source: string;
    enrolled_at: string;
    completed_at: string | null;
    progress_percent: number;
    last_accessed_at: string | null;
    courses: { title: string } | { title: string }[] | null;
  }[];
  const entitlements = (entRes.data ?? []) as unknown as {
    id: string;
    scope: string;
    course_id: string | null;
    source: string;
    status: string;
    starts_at: string;
    expires_at: string | null;
    grant_reason: string | null;
    revoke_reason: string | null;
    courses: { title: string } | { title: string }[] | null;
  }[];
  const payments = (payRes.data ?? []) as unknown as {
    id: string;
    status: string;
    total_cents: number;
    refunded_cents: number;
    currency: string;
    paid_at: string | null;
    created_at: string;
    products: { name: string } | { name: string }[] | null;
  }[];
  const tickets = (ticketRes.data ?? []) as { id: string; ticket_number: string; subject: string; status: string; created_at: string }[];
  const certificates = (certRes.data ?? []) as { id: string; certificate_number: string; course_title: string; issued_at: string; status: string }[];
  const activity = (activityRes.data ?? []) as unknown as {
    id: string;
    status: string;
    last_viewed_at: string;
    lessons: { title: string } | { title: string }[] | null;
    courses: { title: string } | { title: string }[] | null;
  }[];
  const events = (eventsRes.data ?? []) as { id: string; event: string; created_at: string; ip_address: string | null }[];
  const courseOptions = (coursesRes.data ?? []) as { id: string; title: string; status: string }[];
  const nowIso = new Date().toISOString();

  return (
    <>
      <PageHeader
        title={profile.full_name || priv.email}
        description={priv.email}
        back={{ href: "/admin/students", label: "All students" }}
        actions={
          <AccountActions
            userId={profile.id}
            email={priv.email}
            name={profile.full_name || priv.email}
            status={priv.status}
            isSelf={me.id === profile.id}
            isAdmin={roles.includes("admin")}
            deletionRequested={Boolean(priv.deletion_requested_at)}
          />
        }
      />

      {priv.status === "suspended" ? (
        <p className="mb-6 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          Suspended{priv.suspended_reason ? `: ${priv.suspended_reason}` : ""}. They can’t sign in.
        </p>
      ) : null}
      {priv.deletion_requested_at ? (
        <p className="mb-6 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          Asked for their account to be deleted on <LocalTime value={priv.deletion_requested_at} format="date" />. Process the request within 30 days (see the privacy policy).
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>Course access</CardTitle>
                <CardDescription>Every grant of access, whatever its source. Revoking ends access immediately.</CardDescription>
              </div>
              <GrantAccessDialog userId={profile.id} courses={courseOptions} disabled={priv.status !== "active"} />
            </CardHeader>
            <CardContent>
              {entitlements.length === 0 ? (
                <EmptyState title="No access yet" description="Purchases, free enrollments and manual grants appear here." className="py-8" />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Course</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Ends</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-12">
                          <span className="sr-only">Revoke</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entitlements.map((e) => {
                        const expired = e.status === "active" && e.expires_at !== null && e.expires_at <= nowIso;
                        const label = e.scope === "all_access" ? "All courses" : (one(e.courses)?.title ?? "Deleted course");
                        return (
                          <TableRow key={e.id}>
                            <TableCell>
                              <p className="font-medium">{label}</p>
                              {e.grant_reason ? <p className="text-xs text-muted-foreground">Reason: {e.grant_reason}</p> : null}
                              {e.revoke_reason ? <p className="text-xs text-muted-foreground">Revoked: {e.revoke_reason}</p> : null}
                            </TableCell>
                            <TableCell className="capitalize">{e.source}</TableCell>
                            <TableCell>{e.expires_at ? <LocalTime value={e.expires_at} format="date" /> : "No end date"}</TableCell>
                            <TableCell>
                              <StatusBadge status={expired ? "expired" : e.status} />
                            </TableCell>
                            <TableCell>
                              {e.status === "active" && !expired ? <RevokeEntitlementButton userId={profile.id} entitlementId={e.id} label={label} /> : null}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Enrollments</CardTitle>
            </CardHeader>
            <CardContent>
              {enrollments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Not enrolled in any course.</p>
              ) : (
                <ul className="grid gap-4">
                  {enrollments.map((e) => (
                    <li key={e.id} className="grid gap-2">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <Link href={`/admin/courses/${e.course_id}`} className="min-w-0 truncate font-medium hover:underline">
                          {one(e.courses)?.title ?? "Deleted course"}
                        </Link>
                        <StatusBadge status={e.status} />
                      </div>
                      <Progress value={Number(e.progress_percent)} className="h-1.5" aria-label="Progress" />
                      <p className="text-xs text-muted-foreground">
                        {Math.round(Number(e.progress_percent))}% complete · enrolled <LocalTime value={e.enrolled_at} format="date" /> via {e.source}
                        {e.last_accessed_at ? (
                          <>
                            {" "}
                            · last opened <LocalTime value={e.last_accessed_at} format="relative" />
                          </>
                        ) : null}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payments</CardTitle>
              <CardDescription>Recorded from Whop.</CardDescription>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments recorded.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <Link href={`/admin/payments/${p.id}`} className="hover:underline">
                              {one(p.products)?.name ?? "Payment"}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <LocalTime value={p.paid_at ?? p.created_at} format="date" />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMoney(p.total_cents, p.currency)}
                            {p.refunded_cents > 0 ? <span className="block text-xs text-muted-foreground">−{formatMoney(p.refunded_cents, p.currency)} refunded</span> : null}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={p.status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid h-fit gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <StatusBadge status={priv.status} />
                </dd>
                <dt className="text-muted-foreground">Roles</dt>
                <dd className="capitalize">{roles.join(", ") || "—"}</dd>
                <dt className="text-muted-foreground">Joined</dt>
                <dd>
                  <LocalTime value={profile.created_at} format="date" />
                </dd>
                <dt className="text-muted-foreground">Last sign-in</dt>
                <dd>{priv.last_sign_in_at ? <LocalTime value={priv.last_sign_in_at} /> : "Never"}</dd>
                <dt className="text-muted-foreground">Time zone</dt>
                <dd>{profile.timezone}</dd>
                {priv.country ? (
                  <>
                    <dt className="text-muted-foreground">Country</dt>
                    <dd>{priv.country}</dd>
                  </>
                ) : null}
                {priv.phone ? (
                  <>
                    <dt className="text-muted-foreground">Phone</dt>
                    <dd>{priv.phone}</dd>
                  </>
                ) : null}
                <dt className="text-muted-foreground">User ID</dt>
                <dd className="truncate font-mono text-xs">{profile.id}</dd>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Recent learning</CardTitle>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No lessons opened yet.</p>
              ) : (
                <ul className="grid gap-3 text-sm">
                  {activity.map((a) => (
                    <li key={a.id}>
                      <p className="truncate font-medium">{one(a.lessons)?.title ?? "Lesson"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {one(a.courses)?.title} · {a.status === "completed" ? "completed" : "in progress"} · <LocalTime value={a.last_viewed_at} format="relative" />
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Certificates</CardTitle>
            </CardHeader>
            <CardContent>
              {certificates.length === 0 ? (
                <p className="text-sm text-muted-foreground">None issued yet.</p>
              ) : (
                <ul className="grid gap-2 text-sm">
                  {certificates.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{c.course_title}</span>
                        <span className="font-mono text-xs text-muted-foreground">{c.certificate_number}</span>
                      </span>
                      <StatusBadge status={c.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Support tickets</CardTitle>
            </CardHeader>
            <CardContent>
              {tickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tickets.</p>
              ) : (
                <ul className="grid gap-2 text-sm">
                  {tickets.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2">
                      <Link href={`/admin/support/${t.id}`} className="min-w-0 truncate hover:underline">
                        {t.ticket_number} · {t.subject}
                      </Link>
                      <StatusBadge status={t.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Sign-in activity</CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recorded activity.</p>
              ) : (
                <ul className="grid gap-2 text-sm">
                  {events.map((ev) => (
                    <li key={ev.id} className="flex items-center justify-between gap-2">
                      <span className="capitalize">{ev.event.replace(/_/g, " ")}</span>
                      <span className="text-xs text-muted-foreground">
                        <LocalTime value={ev.created_at} format="relative" />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
