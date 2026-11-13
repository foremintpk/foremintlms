import Link from "next/link";
import { MailPlus, UserCheck } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { LocalTime } from "@/components/common/local-time";
import { ListToolbar } from "@/components/common/list-toolbar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InviteInstructorDialog, InvitationActions, PendingInstructorActions } from "@/components/admin/instructors/instructor-actions";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { escapeLike } from "@/lib/list-params";
import { cn } from "@/lib/utils";

export const instant = false;
export const metadata = { title: "Instructors" };

const TABS = [
  { key: "active", label: "Approved" },
  { key: "pending", label: "Waiting for approval" },
  { key: "invitations", label: "Invitations" },
  { key: "suspended", label: "Suspended" },
] as const;

interface TeacherRow {
  user_id: string;
  slug: string;
  public_name: string;
  headline: string | null;
  status: string;
  is_public: boolean;
  is_featured: boolean;
  can_create_courses: boolean;
  created_at: string;
}

interface InvitationRow {
  id: string;
  email: string;
  role: string;
  full_name: string | null;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export default async function InstructorsPage({ searchParams }: PageProps<"/admin/instructors">) {
  await requireAdmin("/admin/instructors");
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? "active";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const supabase = await createClient();
  const courses = await supabase.from("courses").select("id, title, status").order("title");
  const courseOptions = (courses.data ?? []) as { id: string; title: string; status: string }[];

  const header = (
    <>
      <PageHeader
        title="Instructors"
        description="Invite instructors, approve their accounts and choose which courses they teach."
        actions={<InviteInstructorDialog courses={courseOptions} />}
      />
      <nav aria-label="Instructor lists" className="mb-6 flex gap-1 overflow-x-auto border-b">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "active" ? "/admin/instructors" : `/admin/instructors?tab=${t.key}`}
            aria-current={t.key === tab ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              t.key === tab ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </>
  );

  if (tab === "invitations") {
    const { data, error } = await supabase
      .from("account_invitations")
      .select("id, email, role, full_name, expires_at, accepted_at, revoked_at, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as InvitationRow[];
    const nowIso = new Date().toISOString();
    const state = (r: InvitationRow) => (r.accepted_at ? "accepted" : r.revoked_at ? "revoked" : r.expires_at < nowIso ? "expired" : "pending");
    return (
      <>
        {header}
        {rows.length === 0 ? (
          <EmptyState icon={MailPlus} title="No invitations yet" description="Invite an instructor by email. They set a password and complete their profile." action={<InviteInstructorDialog courses={courseOptions} />} />
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead className="max-sm:hidden">Role</TableHead>
                  <TableHead className="max-md:hidden">Sent</TableHead>
                  <TableHead className="max-md:hidden">Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-40">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const s = state(r);
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <p className="font-medium">{r.email}</p>
                        {r.full_name ? <p className="text-xs text-muted-foreground">{r.full_name}</p> : null}
                      </TableCell>
                      <TableCell className="max-sm:hidden">{r.role === "admin" ? "Administrator" : "Instructor"}</TableCell>
                      <TableCell className="max-md:hidden">
                        <LocalTime value={r.created_at} format="date" />
                      </TableCell>
                      <TableCell className="max-md:hidden">
                        <LocalTime value={r.expires_at} format="date" />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={s === "accepted" ? "approved" : s === "pending" ? "invited" : s} label={s.charAt(0).toUpperCase() + s.slice(1)} />
                      </TableCell>
                      <TableCell>
                        {s === "pending" || s === "expired" ? <InvitationActions id={r.id} email={r.email} canRevoke={s === "pending"} /> : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </>
    );
  }

  const statuses = tab === "active" ? ["approved"] : tab === "pending" ? ["pending", "invited"] : ["suspended"];
  let query = supabase
    .from("teacher_profiles")
    .select("user_id, slug, public_name, headline, status, is_public, is_featured, can_create_courses, created_at")
    .in("status", statuses)
    .order("sort_order")
    .order("public_name");
  if (q) query = query.ilike("public_name", `%${escapeLike(q)}%`);
  const [{ data, error }, assignments] = await Promise.all([query, supabase.from("course_instructors").select("user_id")]);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as TeacherRow[];
  const courseCounts = new Map<string, number>();
  for (const a of (assignments.data ?? []) as { user_id: string }[]) courseCounts.set(a.user_id, (courseCounts.get(a.user_id) ?? 0) + 1);

  return (
    <>
      {header}
      <ListToolbar searchPlaceholder="Search instructors" />
      {rows.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title={tab === "pending" ? "Nobody is waiting for approval" : tab === "suspended" ? "No suspended instructors" : "No approved instructors yet"}
          description={tab === "active" ? "Invite an instructor, then approve them once they've accepted." : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Instructor</TableHead>
                <TableHead className="max-sm:hidden">Courses</TableHead>
                <TableHead className="max-md:hidden">Profile</TableHead>
                <TableHead>Status</TableHead>
                {tab === "pending" ? (
                  <TableHead className="w-48">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.user_id}>
                  <TableCell>
                    <Link href={`/admin/instructors/${t.user_id}`} className="font-medium hover:underline">
                      {t.public_name}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">{t.headline ?? `/instructors/${t.slug}`}</p>
                  </TableCell>
                  <TableCell className="tabular-nums max-sm:hidden">{courseCounts.get(t.user_id) ?? 0}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-md:hidden">
                    {[t.is_public ? "Public" : "Hidden", t.is_featured && "Featured", t.can_create_courses && "Can create courses"].filter(Boolean).join(" · ")}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={t.status === "approved" ? "approved" : t.status} />
                  </TableCell>
                  {tab === "pending" ? (
                    <TableCell>
                      <PendingInstructorActions userId={t.user_id} name={t.public_name} />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
