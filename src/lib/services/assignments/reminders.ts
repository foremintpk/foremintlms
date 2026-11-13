import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/services/notifications";
import { appUrl } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { assignmentDueDate } from "./due";

const HOUR_MS = 3_600_000;
const WINDOW_HOURS = 24;

interface AssignmentRow {
  id: string;
  course_id: string;
  title: string;
  due_at: string | null;
  due_days_after_enrollment: number | null;
}

/**
 * Cron (hourly): remind learners about assignments due within 24 hours that
 * they haven't submitted. Each (assignment, learner, due date) is claimed in
 * assignment_deadline_reminders first, so repeated runs never double-send.
 */
export async function sendAssignmentDeadlineReminders(): Promise<number> {
  const admin = createAdminClient();
  const now = new Date();
  const horizon = new Date(now.getTime() + WINDOW_HOURS * HOUR_MS);

  const { data: assignmentRows } = await admin
    .from("assignments")
    .select("id, course_id, title, due_at, due_days_after_enrollment")
    .eq("status", "published")
    .or(
      `and(due_at.gt.${now.toISOString()},due_at.lte.${horizon.toISOString()}),and(due_at.is.null,due_days_after_enrollment.not.is.null)`,
    );
  const assignments = (assignmentRows ?? []) as AssignmentRow[];
  if (assignments.length === 0) return 0;

  const courseIds = [...new Set(assignments.map((a) => a.course_id))];
  const [{ data: courses }, { data: enrollments }, { data: entitlements }] = await Promise.all([
    admin.from("courses").select("id, title, slug, status").in("id", courseIds),
    admin.from("enrollments").select("user_id, course_id, enrolled_at, status").in("course_id", courseIds).eq("status", "active"),
    admin
      .from("course_entitlements")
      .select("user_id, course_id, scope, expires_at")
      .eq("status", "active")
      .lte("starts_at", now.toISOString())
      .or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`),
  ]);
  const courseById = new Map(((courses ?? []) as { id: string; title: string; slug: string; status: string }[]).map((c) => [c.id, c]));
  const entitled = (userId: string, courseId: string) =>
    ((entitlements ?? []) as { user_id: string; course_id: string | null; scope: string }[]).some(
      (e) => e.user_id === userId && (e.scope === "all_access" || e.course_id === courseId),
    );

  let sent = 0;
  for (const assignment of assignments) {
    const course = courseById.get(assignment.course_id);
    if (!course || !["published", "unpublished", "archived"].includes(course.status)) continue;
    const learners = ((enrollments ?? []) as { user_id: string; course_id: string; enrolled_at: string }[]).filter(
      (e) => e.course_id === assignment.course_id && entitled(e.user_id, e.course_id),
    );
    if (learners.length === 0) continue;

    const { data: subs } = await admin
      .from("assignment_submissions")
      .select("user_id")
      .eq("assignment_id", assignment.id)
      .in("user_id", learners.map((l) => l.user_id));
    const submitted = new Set(((subs ?? []) as { user_id: string }[]).map((s) => s.user_id));

    for (const learner of learners) {
      if (submitted.has(learner.user_id)) continue;
      const due = assignmentDueDate(assignment, learner.enrolled_at);
      if (!due || due <= now || due > horizon) continue;

      // Claim first: a conflict means this reminder was already sent.
      // assignment_deadline_reminders comes from migration 20261114102001; the
      // untyped view of the client keeps this compiling until types are regenerated.
      const { data: claimed } = await (admin as unknown as SupabaseClient)
        .from("assignment_deadline_reminders")
        .upsert(
          { assignment_id: assignment.id, user_id: learner.user_id, due_at: due.toISOString() },
          { onConflict: "assignment_id,user_id,due_at", ignoreDuplicates: true },
        )
        .select("assignment_id");
      if (!claimed || claimed.length === 0) continue;

      const hours = Math.max(1, Math.round((due.getTime() - now.getTime()) / HOUR_MS));
      const url = `/learn/courses/${course.slug}/assignments/${assignment.id}`;
      await notify(learner.user_id, {
        category: "learning",
        type: "assignment_deadline",
        title: `${assignment.title} is due in ${hours} hour${hours === 1 ? "" : "s"}`,
        body: course.title,
        url,
        email: {
          templateKey: "learning.assignment_deadline",
          idempotencyKey: `assignment-due:${assignment.id}:${due.toISOString()}`,
          payload: {
            assignment_title: assignment.title,
            course_title: course.title,
            due_in: `in ${hours} hour${hours === 1 ? "" : "s"}`,
            due_at: `${formatDateTime(due)} UTC`,
            cta_url: appUrl(url),
          },
        },
      });
      sent++;
    }
  }
  return sent;
}
