/**
 * Pure assignment rules (due dates, lateness, completion). No I/O, so both
 * server services and UI can use them; unit tested.
 */

const DAY_MS = 86_400_000;

export interface DueRule {
  due_at: string | null;
  due_days_after_enrollment: number | null;
}

/** Absolute due date, or one relative to when the learner enrolled. */
export function assignmentDueDate(rule: DueRule, enrolledAt: string | null | undefined): Date | null {
  if (rule.due_at) return new Date(rule.due_at);
  if (rule.due_days_after_enrollment && enrolledAt) {
    return new Date(new Date(enrolledAt).getTime() + rule.due_days_after_enrollment * DAY_MS);
  }
  return null;
}

export function isLate(due: Date | null, at: Date = new Date()): boolean {
  return Boolean(due && at.getTime() > due.getTime());
}

export interface SubmissionLike {
  status: "submitted" | "under_review" | "resubmission_requested" | "graded" | "approved";
  grade_points: number | null;
}

/** "Done" for completion and certificates: approved, or graded at/above the pass mark. */
export function isAssignmentSatisfied(sub: SubmissionLike | null | undefined, assignment: { passing_points: number | null }): boolean {
  if (!sub) return false;
  if (sub.status === "approved") return true;
  if (sub.status !== "graded") return false;
  if (assignment.passing_points === null || assignment.passing_points === undefined) return true;
  return Number(sub.grade_points ?? 0) >= Number(assignment.passing_points);
}

/** A learner may submit when nothing is pending and no final grade blocks it. */
export function canSubmitNew(latest: Pick<SubmissionLike, "status"> | null | undefined): { allowed: boolean; reason: string | null } {
  if (!latest) return { allowed: true, reason: null };
  switch (latest.status) {
    case "resubmission_requested":
      return { allowed: true, reason: null };
    case "submitted":
    case "under_review":
      return { allowed: false, reason: "Your submission is waiting for review." };
    case "graded":
    case "approved":
      return { allowed: false, reason: "This assignment has been reviewed." };
  }
}

/** Status shown to the learner for an assignment overall. */
export function learnerAssignmentStatus(
  latest: SubmissionLike | null | undefined,
  due: Date | null,
  now: Date = new Date(),
): "not_started" | "overdue" | "submitted" | "under_review" | "resubmission_requested" | "graded" | "approved" {
  if (!latest) return due && now > due ? "overdue" : "not_started";
  return latest.status;
}

/** Penalised score after a late penalty (percentage of max points). */
export function applyLatePenalty(points: number, maxPoints: number, penaltyPercent: number, late: boolean): number {
  if (!late || penaltyPercent <= 0) return points;
  return Math.max(0, Math.round((points - (maxPoints * penaltyPercent) / 100) * 100) / 100);
}
