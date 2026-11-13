import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/services/notifications";
import { appUrl } from "@/lib/env";
import { formatDate } from "@/lib/format";
import type { TablesUpdate } from "@/types/database";

/**
 * The entitlement system is the single source of truth for course access.
 * Payments, subscriptions, free enrollments and admin grants all end up here;
 * nothing else grants access. All writes use the service role and are only
 * reachable from trusted server code.
 */

export type EntitlementSource = "purchase" | "subscription" | "membership" | "bundle" | "free" | "manual";

export interface GrantInput {
  userId: string;
  courseIds: string[];
  allAccess?: boolean;
  source: EntitlementSource;
  startsAt?: Date;
  expiresAt: Date | null;
  productId?: string | null;
  planId?: string | null;
  checkoutSessionId?: string | null;
  paymentTransactionId?: string | null;
  subscriptionRecordId?: string | null;
  whopMembershipId?: string | null;
  grantedBy?: string | null;
  reason?: string | null;
  /** Send enrollment notifications/emails (default true). */
  notifyUser?: boolean;
}

export interface GrantResult {
  entitlementIds: string[];
  newlyEnrolledCourseIds: string[];
}

const ALL_ACCESS_KEY = "__all__";

async function upsertEnrollments(userId: string, courseIds: string[], source: EntitlementSource): Promise<string[]> {
  if (courseIds.length === 0) return [];
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("enrollments")
    .select("id, course_id, status")
    .eq("user_id", userId)
    .in("course_id", courseIds);
  const byCourse = new Map((existing ?? []).map((e) => [e.course_id, e]));
  const newly: string[] = [];

  const toInsert = courseIds.filter((id) => !byCourse.has(id)).map((course_id) => ({ user_id: userId, course_id, source, status: "active" }));
  if (toInsert.length) {
    const { data, error } = await admin.from("enrollments").upsert(toInsert, { onConflict: "user_id,course_id", ignoreDuplicates: true }).select("course_id");
    if (error) throw new Error(`enrollment insert failed: ${error.message}`);
    newly.push(...(data ?? []).map((d) => d.course_id));
  }
  const reactivate = (existing ?? []).filter((e) => e.status === "expired" || e.status === "revoked" || e.status === "archived").map((e) => e.id);
  if (reactivate.length) {
    await admin.from("enrollments").update({ status: "active" }).in("id", reactivate);
  }
  return newly;
}

/** Grant access. Idempotent per payment/subscription + course. */
export async function grantAccess(input: GrantInput): Promise<GrantResult> {
  const admin = createAdminClient();
  const startsAt = input.startsAt ?? new Date();
  const targets = input.allAccess ? [ALL_ACCESS_KEY] : [...new Set(input.courseIds)];
  if (targets.length === 0) return { entitlementIds: [], newlyEnrolledCourseIds: [] };

  const enrolledNow = input.allAccess ? [] : await upsertEnrollments(input.userId, targets, input.source);
  const ids: string[] = [];

  for (const target of targets) {
    const courseId = target === ALL_ACCESS_KEY ? null : target;

    // Idempotency: one entitlement per (payment|subscription) and course.
    let existingQuery = admin.from("course_entitlements").select("id").eq("user_id", input.userId);
    existingQuery = courseId ? existingQuery.eq("course_id", courseId) : existingQuery.is("course_id", null).eq("scope", "all_access");
    if (input.paymentTransactionId) existingQuery = existingQuery.eq("payment_transaction_id", input.paymentTransactionId);
    else if (input.subscriptionRecordId) existingQuery = existingQuery.eq("subscription_record_id", input.subscriptionRecordId);
    else existingQuery = existingQuery.eq("source", input.source).eq("status", "active").is("payment_transaction_id", null).is("subscription_record_id", null);
    const { data: existing } = await existingQuery.limit(1).maybeSingle();

    const values = {
      user_id: input.userId,
      scope: courseId ? "course" : "all_access",
      course_id: courseId,
      source: input.source,
      product_id: input.productId ?? null,
      pricing_plan_id: input.planId ?? null,
      checkout_session_id: input.checkoutSessionId ?? null,
      payment_transaction_id: input.paymentTransactionId ?? null,
      subscription_record_id: input.subscriptionRecordId ?? null,
      whop_membership_id: input.whopMembershipId ?? null,
      status: "active",
      starts_at: startsAt.toISOString(),
      expires_at: input.expiresAt ? input.expiresAt.toISOString() : null,
      granted_by: input.grantedBy ?? null,
      grant_reason: input.reason ?? null,
      revoked_at: null,
      revoked_by: null,
      revoke_reason: null,
    } as const;

    if (existing) {
      const { error } = await admin.from("course_entitlements").update(values).eq("id", existing.id);
      if (error) throw new Error(`entitlement update failed: ${error.message}`);
      ids.push(existing.id);
    } else {
      const { data, error } = await admin.from("course_entitlements").insert(values).select("id").single();
      if (error) {
        if (error.code === "23505") continue; // concurrent duplicate — already granted
        throw new Error(`entitlement insert failed: ${error.message}`);
      }
      ids.push(data.id);
    }
  }

  if (enrolledNow.length && input.notifyUser !== false) {
    const { data: courses } = await admin.from("courses").select("id, title, slug").in("id", enrolledNow);
    for (const course of courses ?? []) {
      await notify(input.userId, {
        category: "learning",
        type: "enrollment",
        title: `You're enrolled in ${course.title}`,
        body: input.expiresAt ? `Access until ${formatDate(input.expiresAt)}.` : "Start whenever you're ready.",
        url: `/learn/courses/${course.slug}`,
        email: {
          templateKey: "billing.enrollment_confirmation",
          idempotencyKey: `enrolled:${course.id}:${input.paymentTransactionId ?? input.subscriptionRecordId ?? input.source}`,
          payload: {
            course_title: course.title,
            access_summary: input.expiresAt
              ? `Your access runs until ${formatDate(input.expiresAt)}.`
              : input.source === "subscription" || input.source === "membership"
                ? "Your access continues while your subscription is active."
                : "Your access does not expire.",
            cta_url: appUrl(`/learn/courses/${course.slug}`),
          },
        },
      });
    }
  }

  return { entitlementIds: ids, newlyEnrolledCourseIds: enrolledNow };
}

/** Update every entitlement linked to a subscription (renewal, cancellation, dispute). */
export async function setSubscriptionAccess(
  subscriptionRecordId: string,
  target: { status: "active" | "expired" | "revoked" | "suspended"; expiresAt: Date | null; reason: string },
): Promise<number> {
  const admin = createAdminClient();
  const update: TablesUpdate<"course_entitlements"> = {
    status: target.status,
    expires_at: target.expiresAt ? target.expiresAt.toISOString() : null,
  };
  if (target.status === "revoked") {
    update.revoked_at = new Date().toISOString();
    update.revoke_reason = target.reason;
  }
  const { data, error } = await admin
    .from("course_entitlements")
    .update(update)
    .eq("subscription_record_id", subscriptionRecordId)
    .neq("status", "revoked")
    .select("user_id, course_id");
  if (error) throw new Error(`subscription access update failed: ${error.message}`);
  if (target.status !== "active") await syncEnrollmentStatuses(data ?? []);
  return data?.length ?? 0;
}

export interface RevokeInput {
  entitlementIds?: string[];
  paymentTransactionId?: string;
  whopMembershipId?: string;
  reason: string;
  revokedBy?: string | null;
}

/** Revoke access (refund, chargeback, admin action). Returns affected rows. */
export async function revokeAccess(input: RevokeInput): Promise<number> {
  const admin = createAdminClient();
  let query = admin
    .from("course_entitlements")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
      revoked_by: input.revokedBy ?? null,
      revoke_reason: input.reason,
    })
    .in("status", ["active", "suspended"]);
  if (input.entitlementIds?.length) query = query.in("id", input.entitlementIds);
  else if (input.paymentTransactionId) query = query.eq("payment_transaction_id", input.paymentTransactionId);
  else if (input.whopMembershipId) query = query.eq("whop_membership_id", input.whopMembershipId);
  else throw new Error("revokeAccess needs a target");
  const { data, error } = await query.select("user_id, course_id");
  if (error) throw new Error(`revoke failed: ${error.message}`);
  await syncEnrollmentStatuses(data ?? [], "revoked");
  return data?.length ?? 0;
}

/**
 * After entitlements end, mark enrollments expired/revoked when no other
 * active entitlement still covers the course. Completed enrollments keep
 * their completed status (the record of achievement stays).
 */
async function syncEnrollmentStatuses(rows: { user_id: string; course_id: string | null }[], endStatus: "expired" | "revoked" = "expired") {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  for (const row of rows) {
    if (!row.course_id) continue;
    const { count } = await admin
      .from("course_entitlements")
      .select("id", { count: "exact", head: true })
      .eq("user_id", row.user_id)
      .eq("status", "active")
      .lte("starts_at", now)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .or(`course_id.eq.${row.course_id},scope.eq.all_access`);
    if ((count ?? 0) === 0) {
      await admin
        .from("enrollments")
        .update({ status: endStatus })
        .eq("user_id", row.user_id)
        .eq("course_id", row.course_id)
        .eq("status", "active");
    }
  }
}

/** Cron: flip time-expired entitlements to "expired" and tell the learner. */
export async function expireDueEntitlements(): Promise<number> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("course_entitlements")
    .update({ status: "expired" })
    .eq("status", "active")
    .lte("expires_at", now)
    .select("id, user_id, course_id, expires_at, source");
  if (error) throw new Error(`expire entitlements failed: ${error.message}`);
  const rows = data ?? [];
  await syncEnrollmentStatuses(rows);

  const courseIds = [...new Set(rows.map((r) => r.course_id).filter(Boolean))] as string[];
  const { data: courses } = courseIds.length
    ? await admin.from("courses").select("id, title, slug").in("id", courseIds)
    : { data: [] };
  const byId = new Map((courses ?? []).map((c) => [c.id, c]));
  for (const row of rows) {
    const course = row.course_id ? byId.get(row.course_id) : null;
    if (!course || row.source === "subscription") continue; // subscription endings are announced by billing events
    await notify(row.user_id, {
      category: "billing",
      type: "access_expired",
      title: `Your access to ${course.title} has ended`,
      url: "/learn/billing",
      email: {
        templateKey: "billing.access_expired",
        idempotencyKey: `access-expired:${row.id}`,
        payload: { course_title: course.title, ended_at: formatDate(row.expires_at), cta_url: appUrl(`/courses/${course.slug}`) },
      },
    });
  }
  return rows.length;
}

/** Cron: remind learners a few days before fixed-term access ends. */
export async function remindExpiringEntitlements(daysAhead: number): Promise<number> {
  const admin = createAdminClient();
  const now = new Date();
  const horizon = new Date(now.getTime() + daysAhead * 86_400_000).toISOString();
  const { data } = await admin
    .from("course_entitlements")
    .select("id, user_id, course_id, expires_at")
    .eq("status", "active")
    .neq("source", "subscription")
    .is("expiry_reminder_sent_at", null)
    .gt("expires_at", now.toISOString())
    .lte("expires_at", horizon)
    .not("course_id", "is", null)
    .limit(500);
  let sent = 0;
  for (const row of data ?? []) {
    const [{ data: course }, { data: enrollment }] = await Promise.all([
      admin.from("courses").select("title, slug").eq("id", row.course_id!).single(),
      admin.from("enrollments").select("progress_percent").eq("user_id", row.user_id).eq("course_id", row.course_id!).maybeSingle(),
    ]);
    if (!course) continue;
    await notify(row.user_id, {
      category: "billing",
      type: "access_expiring",
      title: `Access to ${course.title} ends ${formatDate(row.expires_at)}`,
      url: `/learn/courses/${course.slug}`,
      email: {
        templateKey: "billing.access_expiring",
        idempotencyKey: `access-expiring:${row.id}`,
        payload: {
          course_title: course.title,
          ends_at: formatDate(row.expires_at),
          progress: `${Math.round(Number(enrollment?.progress_percent ?? 0))}%`,
          cta_url: appUrl(`/learn/courses/${course.slug}`),
        },
      },
    });
    await admin.from("course_entitlements").update({ expiry_reminder_sent_at: new Date().toISOString() }).eq("id", row.id);
    sent++;
  }
  return sent;
}
