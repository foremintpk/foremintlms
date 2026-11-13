"use server";

import { z } from "zod";
import { assertAdmin } from "@/lib/auth/guards";
import { fail, ok, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { grantAccess, revokeAccess } from "@/lib/services/entitlements";
import { enqueueEmail } from "@/lib/services/email/outbox";
import { deleteMediaFile } from "@/lib/services/storage";
import { buildConfirmUrl, devLogLink, getFirstName, logAuthEvent } from "@/lib/services/account";
import { reactivateAccount, suspendAccount } from "@/lib/services/admin/accounts";
import { searchUsers } from "@/lib/services/admin/users";
import { accessExpiryFromDuration } from "@/lib/services/admin/metrics";
import { sha256 } from "@/lib/security/crypto";

export async function searchUsersAction(input: { q: string; role?: "student" | "teacher" | "admin" }): Promise<
  ActionResult<{ id: string; full_name: string; email: string; status: string }[]>
> {
  return runAction(async () => {
    await assertAdmin();
    const data = z.object({ q: z.string().trim().max(120), role: z.enum(["student", "teacher", "admin"]).optional() }).parse(input);
    const { rows } = await searchUsers({ role: data.role ?? null, q: data.q, limit: 10 });
    return ok(rows.map((r) => ({ id: r.id, full_name: r.full_name, email: r.email, status: r.status })));
  });
}

export async function suspendUser(input: { userId: string; reason?: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = z.object({ userId: z.uuid(), reason: z.string().trim().min(3, "Give a reason").max(1000) }).parse(input);
    await suspendAccount(user, data.userId, data.reason);
    return ok(null, "Account suspended");
  });
}

export async function reactivateUser(input: { userId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const { userId } = z.object({ userId: z.uuid() }).parse(input);
    await reactivateAccount(user, userId);
    return ok(null, "Account reactivated");
  });
}

export async function sendPasswordReset(input: { userId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const { userId } = z.object({ userId: z.uuid() }).parse(input);
    const admin = createAdminClient();
    const { data: priv } = await admin.from("profile_private").select("email, status").eq("user_id", userId).maybeSingle();
    if (!priv) throw new UserFacingError("Account not found.");
    if (priv.status !== "active") throw new UserFacingError("Reactivate the account before sending a reset link.");
    const email = priv.email as string;
    const { data: link, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
    if (error || !link?.properties?.hashed_token) throw new Error(`generateLink failed: ${error?.message}`);
    const url = buildConfirmUrl(link.properties.hashed_token, "recovery", "/reset-password");
    devLogLink(`Admin-sent password reset for ${email}`, url);
    await enqueueEmail({
      templateKey: "auth.password_reset",
      to: email,
      userId,
      idempotencyKey: `recovery:${userId}:${link.properties.hashed_token.slice(0, 24)}`,
      payload: { first_name: await getFirstName(userId), cta_url: url },
    });
    await logAuthEvent({ userId, email, event: "password_reset_requested", metadata: { by: user.id } });
    await audit({ actor: user, action: "account.password_reset_sent", entityType: "user", entityId: userId });
    return ok(null, "Password reset email queued");
  });
}

const grantSchema = z
  .object({
    userId: z.uuid(),
    target: z.enum(["course", "all_access"]),
    courseId: z.union([z.literal(""), z.uuid()]).default(""),
    duration: z.enum(["30", "60", "90", "180", "365", "lifetime", "custom"]),
    customUntil: z.string().default(""),
    reason: z.string().trim().min(5, "Explain why access is being granted").max(1000),
  })
  .refine((g) => g.target !== "course" || g.courseId, { path: ["courseId"], message: "Choose a course" });

export async function grantManualAccess(input: z.input<typeof grantSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = grantSchema.parse(input);
    let expiresAt: Date | null;
    try {
      expiresAt = accessExpiryFromDuration(data.duration, data.customUntil);
    } catch (err) {
      return fail("Check the highlighted fields.", { customUntil: [(err as Error).message] });
    }
    const admin = createAdminClient();
    const { data: account } = await admin.from("profile_private").select("status").eq("user_id", data.userId).maybeSingle();
    if (!account) throw new UserFacingError("Account not found.");
    if (account.status !== "active") throw new UserFacingError("This account is suspended. Reactivate it first.");
    let courseTitle = "all courses";
    if (data.target === "course") {
      const { data: course } = await admin.from("courses").select("title, status").eq("id", data.courseId).maybeSingle();
      if (!course) throw new UserFacingError("Course not found.");
      if (!["published", "unpublished", "archived"].includes(course.status as string)) {
        throw new UserFacingError("Students can't open draft or in-review courses. Publish the course first.");
      }
      courseTitle = course.title as string;
    }
    const result = await grantAccess({
      userId: data.userId,
      courseIds: data.target === "course" ? [data.courseId] : [],
      allAccess: data.target === "all_access",
      source: "manual",
      expiresAt,
      grantedBy: user.id,
      reason: data.reason,
    });
    await audit({
      actor: user,
      action: "entitlement.granted",
      entityType: "user",
      entityId: data.userId,
      summary: `Manual access to ${courseTitle}`,
      metadata: {
        target: data.target,
        courseId: data.courseId || null,
        expiresAt: expiresAt?.toISOString() ?? null,
        reason: data.reason,
        entitlementIds: result.entitlementIds,
      },
    });
    return ok(null, `Access granted to ${courseTitle}`);
  });
}

export async function revokeEntitlement(input: { entitlementId: string; userId: string; reason?: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = z
      .object({ entitlementId: z.uuid(), userId: z.uuid(), reason: z.string().trim().min(3, "Give a reason").max(1000) })
      .parse(input);
    const supabase = await createClient();
    const { data: ent } = await supabase.from("course_entitlements").select("user_id, course_id, source").eq("id", data.entitlementId).maybeSingle();
    if (!ent || ent.user_id !== data.userId) throw new UserFacingError("Access record not found.");
    const count = await revokeAccess({ entitlementIds: [data.entitlementId], reason: data.reason, revokedBy: user.id });
    if (count === 0) throw new UserFacingError("This access has already ended.");
    await audit({
      actor: user,
      action: "entitlement.revoked",
      entityType: "user",
      entityId: data.userId,
      summary: data.reason,
      metadata: { entitlementId: data.entitlementId, courseId: ent.course_id, source: ent.source, reason: data.reason },
    });
    return ok(null, "Access revoked");
  });
}

const PERSONAL_PURPOSES = ["avatar", "submission", "message_attachment", "ticket_attachment"];

/**
 * Delete an account permanently (privacy request). Payment and billing
 * records are kept for tax/accounting law but lose their link to the person.
 */
export async function deleteUserAccount(input: { userId: string; confirmEmail: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = z.object({ userId: z.uuid(), confirmEmail: z.string().trim().toLowerCase() }).parse(input);
    if (data.userId === user.id) throw new UserFacingError("You can't delete your own account here.");
    const admin = createAdminClient();
    const [{ data: priv }, { data: roles }] = await Promise.all([
      admin.from("profile_private").select("email").eq("user_id", data.userId).maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", data.userId),
    ]);
    if (!priv) throw new UserFacingError("Account not found.");
    if (((roles ?? []) as { role: string }[]).some((r) => r.role === "admin")) {
      throw new UserFacingError("Administrator accounts can't be deleted from here. Remove the admin role first.");
    }
    if ((priv.email as string).toLowerCase() !== data.confirmEmail) {
      return fail("Check the highlighted fields.", { confirmEmail: ["Type the account's email exactly to confirm"] });
    }

    const { data: files } = await admin.from("media_files").select("id").eq("uploaded_by", data.userId).in("purpose", PERSONAL_PURPOSES);
    for (const f of (files ?? []) as { id: string }[]) await deleteMediaFile(f.id);

    // Record the deletion before the account (and its foreign keys) disappear.
    await audit({
      actor: user,
      action: "account.deleted",
      entityType: "user",
      entityId: data.userId,
      summary: "Account deleted on request",
      metadata: { emailSha256: sha256(priv.email as string), personalFilesRemoved: files?.length ?? 0 },
    });
    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(`deleteUser failed: ${error.message}`);
    return ok(null, "Account deleted");
  });
}

export async function clearDeletionRequest(input: { userId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const { userId } = z.object({ userId: z.uuid() }).parse(input);
    const supabase = await createClient();
    const { error } = await supabase.from("profile_private").update({ deletion_requested_at: null }).eq("user_id", userId);
    if (error) throw error;
    await audit({ actor: user, action: "account.deletion_request_cleared", entityType: "user", entityId: userId });
    return ok(null, "Deletion request cleared");
  });
}
