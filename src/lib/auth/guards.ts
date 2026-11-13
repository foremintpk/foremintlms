import "server-only";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminMfaRequired } from "@/lib/settings";
import { getSessionUser, type AppRole, type SessionUser } from "./session";

/** Error thrown by guards used inside server actions and route handlers. */
export class AuthError extends Error {
  constructor(
    public readonly code: "unauthenticated" | "forbidden" | "mfa_required" | "suspended",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "AuthError";
  }
}

// ---------------------------------------------------------------------------
// Page guards (redirect)
// ---------------------------------------------------------------------------

export async function requireUser(nextPath?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  if (user.accountStatus !== "active") redirect("/account-suspended");
  return user;
}

export async function requireRole(role: AppRole, nextPath?: string): Promise<SessionUser> {
  const user = await requireUser(nextPath);
  if (!user.roles.includes(role)) redirect("/access-denied");
  if (role === "admin" && (await adminNeedsMfa(user))) redirect("/mfa?next=/admin");
  return user;
}

/** Admin pages (except the MFA screen itself). */
export async function requireAdmin(nextPath?: string) {
  return requireRole("admin", nextPath);
}

export async function requireTeacher(nextPath?: string) {
  return requireRole("teacher", nextPath);
}

export async function adminNeedsMfa(user: SessionUser): Promise<boolean> {
  if (!user.roles.includes("admin")) return false;
  if (user.aal === "aal2") return false;
  return getAdminMfaRequired();
}

// ---------------------------------------------------------------------------
// Action guards (throw)
// ---------------------------------------------------------------------------

export async function assertUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError("unauthenticated", "Sign in to continue.");
  if (user.accountStatus !== "active") throw new AuthError("suspended", "This account is suspended.");
  return user;
}

export async function assertAdmin(): Promise<SessionUser> {
  const user = await assertUser();
  if (!user.roles.includes("admin")) throw new AuthError("forbidden", "Administrator access required.");
  if (await adminNeedsMfa(user)) throw new AuthError("mfa_required", "Verify with your authenticator app first.");
  return user;
}

export async function assertTeacherOrAdmin(): Promise<SessionUser> {
  const user = await assertUser();
  if (user.roles.includes("admin")) {
    if (await adminNeedsMfa(user)) throw new AuthError("mfa_required", "Verify with your authenticator app first.");
    return user;
  }
  if (!user.roles.includes("teacher")) throw new AuthError("forbidden", "Instructor access required.");
  return user;
}

export interface CourseRole {
  isAdmin: boolean;
  isInstructor: boolean;
  canEdit: boolean;
}

/** How the user relates to a course as staff. */
export async function getCourseRole(user: SessionUser, courseId: string): Promise<CourseRole> {
  const isAdmin = user.roles.includes("admin") && !(await adminNeedsMfa(user));
  if (isAdmin) return { isAdmin: true, isInstructor: false, canEdit: true };
  if (!user.roles.includes("teacher")) return { isAdmin: false, isInstructor: false, canEdit: false };
  const { data } = await createAdminClient()
    .from("course_instructors")
    .select("can_edit")
    .eq("course_id", courseId)
    .eq("user_id", user.id)
    .maybeSingle();
  return { isAdmin: false, isInstructor: Boolean(data), canEdit: Boolean(data?.can_edit) };
}

/** Admin, or an approved instructor assigned to the course. */
export async function assertCourseStaff(courseId: string): Promise<{ user: SessionUser; role: CourseRole }> {
  const user = await assertTeacherOrAdmin();
  const role = await getCourseRole(user, courseId);
  if (!role.isAdmin && !role.isInstructor) throw new AuthError("forbidden", "You are not assigned to this course.");
  return { user, role };
}

/** Admin, or an assigned instructor with edit rights. */
export async function assertCourseEditor(courseId: string): Promise<{ user: SessionUser; role: CourseRole }> {
  const result = await assertCourseStaff(courseId);
  if (!result.role.canEdit) throw new AuthError("forbidden", "You do not have edit access to this course.");
  return result;
}
