/**
 * Pure access rules. No I/O — these functions are unit tested and used by
 * both server services and the UI.
 */

export type EntitlementStatus = "active" | "expired" | "revoked" | "suspended";

export interface EntitlementLike {
  id?: string;
  status: EntitlementStatus;
  scope: "course" | "all_access";
  course_id: string | null;
  starts_at: string;
  expires_at: string | null;
}

export type CourseStatus = "draft" | "in_review" | "published" | "unpublished" | "archived";

/** Course states in which students holding an entitlement may study. */
export const STUDENT_VISIBLE_STATUSES: CourseStatus[] = ["published", "unpublished", "archived"];

export function isEntitlementActive(e: EntitlementLike, now: Date = new Date()): boolean {
  if (e.status !== "active") return false;
  if (new Date(e.starts_at).getTime() > now.getTime()) return false;
  if (e.expires_at && new Date(e.expires_at).getTime() <= now.getTime()) return false;
  return true;
}

export function entitlementCovers(e: EntitlementLike, courseId: string): boolean {
  return e.scope === "all_access" || e.course_id === courseId;
}

export type AccessReason = "staff" | "entitlement" | "expired" | "revoked" | "suspended" | "course_unavailable" | "none";

export interface AccessDecision {
  hasAccess: boolean;
  reason: AccessReason;
  /** When the best active entitlement ends (null = no end). */
  expiresAt: string | null;
  entitlementId: string | null;
}

/**
 * Decide whether a learner can open a course. The DB enforces the same rule
 * through RLS (private.has_course_access); this mirror explains *why* in UI.
 */
export function resolveCourseAccess(input: {
  courseId: string;
  courseStatus: CourseStatus;
  isStaff: boolean;
  entitlements: EntitlementLike[];
  now?: Date;
}): AccessDecision {
  const now = input.now ?? new Date();
  if (input.isStaff) return { hasAccess: true, reason: "staff", expiresAt: null, entitlementId: null };

  const relevant = input.entitlements.filter((e) => entitlementCovers(e, input.courseId));
  const active = relevant.filter((e) => isEntitlementActive(e, now));

  if (active.length > 0) {
    if (!STUDENT_VISIBLE_STATUSES.includes(input.courseStatus)) {
      return { hasAccess: false, reason: "course_unavailable", expiresAt: null, entitlementId: null };
    }
    // Prefer an open-ended grant, otherwise the one that lasts longest.
    const best = [...active].sort((a, b) => {
      if (!a.expires_at) return -1;
      if (!b.expires_at) return 1;
      return new Date(b.expires_at).getTime() - new Date(a.expires_at).getTime();
    })[0];
    return { hasAccess: true, reason: "entitlement", expiresAt: best.expires_at, entitlementId: best.id ?? null };
  }

  if (relevant.some((e) => e.status === "suspended")) return { hasAccess: false, reason: "suspended", expiresAt: null, entitlementId: null };
  if (relevant.some((e) => e.status === "revoked") && !relevant.some((e) => e.status === "expired" || (e.status === "active"))) {
    return { hasAccess: false, reason: "revoked", expiresAt: null, entitlementId: null };
  }
  if (relevant.length > 0) return { hasAccess: false, reason: "expired", expiresAt: null, entitlementId: null };
  return { hasAccess: false, reason: "none", expiresAt: null, entitlementId: null };
}

const DAY_MS = 86_400_000;

export interface PlanAccessInput {
  plan_type: "free" | "one_time" | "recurring";
  access_duration_days: number | null;
  billing_period_days: number | null;
  grace_period_days: number;
}

/**
 * Access window granted by a plan purchase. Recurring plans run to the end of
 * the paid period plus the grace period; renewals extend it.
 */
export function computeAccessWindow(
  plan: PlanAccessInput,
  startsAt: Date,
  periodEnd?: Date | null,
): { startsAt: Date; expiresAt: Date | null } {
  if (plan.plan_type === "recurring") {
    const end = periodEnd ?? new Date(startsAt.getTime() + (plan.billing_period_days ?? 30) * DAY_MS);
    return { startsAt, expiresAt: new Date(end.getTime() + plan.grace_period_days * DAY_MS) };
  }
  if (plan.access_duration_days) {
    return { startsAt, expiresAt: new Date(startsAt.getTime() + plan.access_duration_days * DAY_MS) };
  }
  return { startsAt, expiresAt: null };
}

export interface ReleaseRule {
  release_at: string | null;
  release_after_days: number | null;
}

/** When a lesson (and its module) becomes available to a learner. */
export function lessonReleaseDate(lesson: ReleaseRule, module: ReleaseRule, enrolledAt: Date | null): Date | null {
  const candidates: number[] = [];
  for (const rule of [lesson, module]) {
    if (rule.release_at) candidates.push(new Date(rule.release_at).getTime());
    if (rule.release_after_days !== null && rule.release_after_days !== undefined) {
      if (!enrolledAt) return new Date(8640000000000000); // unknown enrollment: not released
      candidates.push(enrolledAt.getTime() + rule.release_after_days * DAY_MS);
    }
  }
  if (candidates.length === 0) return null;
  return new Date(Math.max(...candidates));
}

export function isReleased(releaseDate: Date | null, now: Date = new Date()): boolean {
  return !releaseDate || releaseDate.getTime() <= now.getTime();
}

export interface OutlineLesson {
  id: string;
  prerequisite_lesson_id: string | null;
}

export type LockReason = "sequential" | "prerequisite" | null;

/**
 * Locks from completion rules. `lessons` must be in curriculum order.
 * Sequential: a lesson unlocks once every earlier lesson is complete.
 */
export function computeLessonLocks(
  lessons: OutlineLesson[],
  completed: Set<string>,
  sequential: boolean,
): Map<string, LockReason> {
  const locks = new Map<string, LockReason>();
  let allPreviousDone = true;
  for (const lesson of lessons) {
    let reason: LockReason = null;
    if (sequential && !allPreviousDone) reason = "sequential";
    else if (lesson.prerequisite_lesson_id && !completed.has(lesson.prerequisite_lesson_id)) reason = "prerequisite";
    locks.set(lesson.id, reason);
    if (!completed.has(lesson.id)) allPreviousDone = false;
  }
  return locks;
}

export function progressPercent(completedCount: number, totalCount: number): number {
  if (totalCount <= 0) return 0;
  return Math.round((Math.min(completedCount, totalCount) / totalCount) * 10000) / 100;
}
