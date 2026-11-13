import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCourseRole } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";
import { resolveCourseAccess, type AccessDecision, type CourseStatus, type EntitlementLike } from "@/lib/domain/access";
import { grantAccess } from "@/lib/services/entitlements";
import { UserFacingError } from "@/lib/actions";

export interface CourseAccess extends AccessDecision {
  isStaff: boolean;
  canEdit: boolean;
  enrollment: { id: string; enrolled_at: string; status: string; progress_percent: number; last_lesson_id: string | null } | null;
}

/** Explains whether (and why) a user can open a course. */
export async function getCourseAccess(user: SessionUser, course: { id: string; status: string }): Promise<CourseAccess> {
  const admin = createAdminClient();
  const role = await getCourseRole(user, course.id);
  const isStaff = role.isAdmin || role.isInstructor;
  const [entRes, enrRes] = await Promise.all([
    admin
      .from("course_entitlements")
      .select("id, status, scope, course_id, starts_at, expires_at")
      .eq("user_id", user.id)
      .or(`course_id.eq.${course.id},scope.eq.all_access`),
    admin
      .from("enrollments")
      .select("id, enrolled_at, status, progress_percent, last_lesson_id")
      .eq("user_id", user.id)
      .eq("course_id", course.id)
      .maybeSingle(),
  ]);
  const decision = resolveCourseAccess({
    courseId: course.id,
    courseStatus: course.status as CourseStatus,
    isStaff,
    entitlements: (entRes.data ?? []) as EntitlementLike[],
  });
  return {
    ...decision,
    isStaff,
    canEdit: role.canEdit,
    enrollment: enrRes.data
      ? { ...enrRes.data, progress_percent: Number(enrRes.data.progress_percent) }
      : null,
  };
}

/**
 * All-access members get an enrollment row the first time they open a
 * course (drip schedules count from that moment).
 */
export async function ensureEnrollment(userId: string, courseId: string, source: "membership" | "free" | "manual" = "membership") {
  const admin = createAdminClient();
  const { data } = await admin.from("enrollments").select("id").eq("user_id", userId).eq("course_id", courseId).maybeSingle();
  if (data) return data.id;
  const { data: created, error } = await admin
    .from("enrollments")
    .upsert({ user_id: userId, course_id: courseId, source, status: "active" }, { onConflict: "user_id,course_id", ignoreDuplicates: true })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`ensureEnrollment failed: ${error.message}`);
  return created?.id ?? null;
}

/** Enroll in a free course (published + marked free, or with an active free plan). */
export async function enrollInFreeCourse(user: SessionUser, courseId: string) {
  const admin = createAdminClient();
  const { data: course } = await admin
    .from("courses")
    .select("id, status, visibility, is_free")
    .eq("id", courseId)
    .maybeSingle();
  if (!course || course.status !== "published" || course.visibility === "private") {
    throw new UserFacingError("This course isn't available.");
  }
  let accessDays: number | null = null;
  let planId: string | null = null;
  let productId: string | null = null;
  if (!course.is_free) {
    const { data: plan } = await admin
      .from("pricing_plans")
      .select("id, access_duration_days, product_id, products!inner(course_id, status)")
      .eq("plan_type", "free")
      .eq("visibility", "public")
      .eq("products.course_id", courseId)
      .eq("products.status", "active")
      .limit(1)
      .maybeSingle();
    if (!plan) throw new UserFacingError("This course isn't free.");
    accessDays = plan.access_duration_days;
    planId = plan.id;
    productId = plan.product_id;
  }
  return grantAccess({
    userId: user.id,
    courseIds: [courseId],
    source: "free",
    expiresAt: accessDays ? new Date(Date.now() + accessDays * 86_400_000) : null,
    planId,
    productId,
  });
}
