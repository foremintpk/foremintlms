import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { LocalTime } from "@/components/common/local-time";
import { EmptyState } from "@/components/common/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CourseAssignments,
  InstructorProfileForm,
  TeachingStatusActions,
  type Assignment,
  type InstructorProfile,
} from "@/components/admin/instructors/instructor-actions";
import { AccountActions } from "@/components/admin/students/student-actions";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/format";

export const instant = false;
export const metadata = { title: "Instructor" };

export default async function InstructorDetailPage({ params }: PageProps<"/admin/instructors/[id]">) {
  const me = await requireAdmin("/admin/instructors");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [tpRes, privRes, rolesRes, assignRes, coursesRes, profileRes] = await Promise.all([
    supabase
      .from("teacher_profiles")
      .select("user_id, slug, public_name, headline, bio, avatar_url, expertise, website_url, social_links, status, is_public, is_featured, can_create_courses, sort_order, approved_at, created_at")
      .eq("user_id", id)
      .maybeSingle(),
    supabase.from("profile_private").select("email, status, suspended_reason, last_sign_in_at, deletion_requested_at").eq("user_id", id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", id),
    supabase.from("course_instructors").select("course_id, role, can_edit, courses(title, status)").eq("user_id", id),
    supabase.from("courses").select("id, title, status").order("title"),
    supabase.from("profiles").select("full_name").eq("id", id).maybeSingle(),
  ]);
  if (tpRes.error) throw new Error(tpRes.error.message);
  if (!tpRes.data || !privRes.data) notFound();

  const tp = tpRes.data as InstructorProfile & { status: string; approved_at: string | null; created_at: string };
  const priv = privRes.data as { email: string; status: "active" | "suspended"; suspended_reason: string | null; last_sign_in_at: string | null; deletion_requested_at: string | null };
  const roles = ((rolesRes.data ?? []) as { role: string }[]).map((r) => r.role);
  const assignments: Assignment[] = ((assignRes.data ?? []) as unknown as {
    course_id: string;
    role: "lead" | "assistant";
    can_edit: boolean;
    courses: { title: string; status: string } | { title: string; status: string }[] | null;
  }[]).map((a) => {
    const c = Array.isArray(a.courses) ? a.courses[0] : a.courses;
    return { course_id: a.course_id, role: a.role, can_edit: a.can_edit, title: c?.title ?? "Deleted course", status: c?.status ?? "archived" };
  });
  const courseIds = assignments.map((a) => a.course_id);
  const { count: studentCount } = courseIds.length
    ? await supabase.from("enrollments").select("user_id", { count: "exact", head: true }).in("course_id", courseIds)
    : { count: 0 };

  return (
    <>
      <PageHeader
        title={tp.public_name}
        description={priv.email}
        back={{ href: "/admin/instructors", label: "Instructors" }}
        actions={
          <>
            <TeachingStatusActions userId={id} name={tp.public_name} status={tp.status} />
            <AccountActions
              userId={id}
              email={priv.email}
              name={(profileRes.data?.full_name as string) || tp.public_name}
              status={priv.status}
              isSelf={me.id === id}
              isAdmin={roles.includes("admin")}
              deletionRequested={Boolean(priv.deletion_requested_at)}
            />
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Courses</CardTitle>
              <CardDescription>Instructors only see the courses and students listed here. “Can edit” allows changing course content.</CardDescription>
            </CardHeader>
            <CardContent>
              <CourseAssignments userId={id} assignments={assignments} courses={(coursesRes.data ?? []) as { id: string; title: string; status: string }[]} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Public profile</CardTitle>
              <CardDescription>Shown on course pages and the Instructors page when public.</CardDescription>
            </CardHeader>
            <CardContent>
              <InstructorProfileForm profile={tp} />
            </CardContent>
          </Card>
        </div>
        <div className="grid h-fit gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Teaching</dt>
                <dd>
                  <StatusBadge status={tp.status === "approved" ? "approved" : tp.status} />
                </dd>
                <dt className="text-muted-foreground">Account</dt>
                <dd>
                  <StatusBadge status={priv.status} />
                  {priv.suspended_reason ? <span className="mt-1 block text-xs text-muted-foreground">{priv.suspended_reason}</span> : null}
                </dd>
                <dt className="text-muted-foreground">Approved</dt>
                <dd>{tp.approved_at ? <LocalTime value={tp.approved_at} format="date" /> : "—"}</dd>
                <dt className="text-muted-foreground">Last sign-in</dt>
                <dd>{priv.last_sign_in_at ? <LocalTime value={priv.last_sign_in_at} format="relative" /> : "Never"}</dd>
                <dt className="text-muted-foreground">Students</dt>
                <dd className="tabular-nums">{formatNumber(studentCount ?? 0)} enrollments</dd>
                <dt className="text-muted-foreground">Roles</dt>
                <dd className="capitalize">{roles.join(", ")}</dd>
              </dl>
              <Link href={`/admin/students/${id}`} className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
                View as a student account
              </Link>
            </CardContent>
          </Card>
          {tp.is_public && tp.status === "approved" ? (
            <Card>
              <CardContent className="pt-6 text-sm">
                <Link href={`/instructors/${tp.slug}`} target="_blank" className="font-medium text-primary hover:underline">
                  Open public profile
                </Link>
              </CardContent>
            </Card>
          ) : (
            <EmptyState title="Not visible publicly" description="Approve the instructor and turn on “Show on the public Instructors page”." className="py-6" />
          )}
        </div>
      </div>
    </>
  );
}
