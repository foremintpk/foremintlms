import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AppRole = "admin" | "teacher" | "student";
export type TeacherStatus = "invited" | "pending" | "approved" | "suspended";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  displayName: string;
  avatarUrl: string | null;
  timezone: string;
  roles: AppRole[];
  /** Highest role: admin > teacher > student. */
  primaryRole: AppRole;
  teacherStatus: TeacherStatus | null;
  canCreateCourses: boolean;
  accountStatus: "active" | "suspended";
  /** Authenticator assurance level of the current session. */
  aal: "aal1" | "aal2";
  emailVerified: boolean;
}

const ROLE_RANK: Record<AppRole, number> = { student: 1, teacher: 2, admin: 3 };

export function highestRole(roles: AppRole[]): AppRole {
  return roles.reduce<AppRole>((best, r) => (ROLE_RANK[r] > ROLE_RANK[best] ? r : best), "student");
}

/**
 * The signed-in user, resolved once per request. Identity comes from the
 * verified JWT (getClaims), and roles always come from the database — never
 * from user-editable metadata.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const claims = data.claims;
  const userId = claims.sub;

  // Service-role read: the account may be suspended, in which case RLS would
  // hide rows we need in order to explain the state to the user.
  const admin = createAdminClient();
  const [profileRes, privateRes, rolesRes, teacherRes] = await Promise.all([
    admin.from("profiles").select("full_name, display_name, avatar_url, timezone").eq("id", userId).maybeSingle(),
    admin.from("profile_private").select("email, status").eq("user_id", userId).maybeSingle(),
    admin.from("user_roles").select("role").eq("user_id", userId),
    admin.from("teacher_profiles").select("status, can_create_courses").eq("user_id", userId).maybeSingle(),
  ]);

  if (!profileRes.data || !privateRes.data) return null;

  const roles = (rolesRes.data ?? []).map((r) => r.role as AppRole);
  const teacherStatus = (teacherRes.data?.status as TeacherStatus | undefined) ?? null;
  // A teacher role without approval behaves like a student until approved.
  const effectiveRoles = roles.filter((r) => r !== "teacher" || teacherStatus === "approved");
  const fullName = profileRes.data.full_name || "";

  return {
    id: userId,
    email: privateRes.data.email,
    fullName,
    displayName: profileRes.data.display_name || fullName.split(" ")[0] || privateRes.data.email.split("@")[0],
    avatarUrl: profileRes.data.avatar_url,
    timezone: profileRes.data.timezone || "UTC",
    roles: effectiveRoles.length ? effectiveRoles : ["student"],
    primaryRole: highestRole(effectiveRoles.length ? effectiveRoles : ["student"]),
    teacherStatus,
    canCreateCourses: Boolean(teacherRes.data?.can_create_courses),
    accountStatus: privateRes.data.status as "active" | "suspended",
    aal: (claims.aal as "aal1" | "aal2") ?? "aal1",
    emailVerified: Boolean((claims as Record<string, unknown>).email_verified ?? true),
  };
});

export function hasRole(user: SessionUser | null, role: AppRole): boolean {
  return Boolean(user?.roles.includes(role));
}

export function homePathFor(user: SessionUser): string {
  if (user.primaryRole === "admin") return "/admin";
  if (user.primaryRole === "teacher") return "/teach";
  return "/learn";
}
