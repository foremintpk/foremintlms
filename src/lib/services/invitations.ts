import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserFacingError } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { appUrl } from "@/lib/env";
import { formatDate, slugify } from "@/lib/format";
import { randomToken, sha256 } from "@/lib/security/crypto";
import { enqueueEmail } from "@/lib/services/email/outbox";
import { notify } from "@/lib/services/notifications";
import { listAdminUserIds, logAuthEvent } from "@/lib/services/account";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Staff onboarding. Admins invite instructors (or other admins); the
 * emailed link carries a random token whose SHA-256 is stored, so the
 * database never holds a usable token. Invitations expire after 7 days.
 */

const INVITE_TTL_DAYS = 7;

export interface InvitationRow {
  id: string;
  email: string;
  role: "teacher" | "admin";
  token_hash: string;
  full_name: string | null;
  message: string | null;
  course_ids: string[];
  invited_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  revoked_at: string | null;
  created_at: string;
}

export type InvitationState = "valid" | "expired" | "revoked" | "accepted" | "invalid";

export function invitationState(row: Pick<InvitationRow, "expires_at" | "accepted_at" | "revoked_at"> | null, now = new Date()): InvitationState {
  if (!row) return "invalid";
  if (row.accepted_at) return "accepted";
  if (row.revoked_at) return "revoked";
  if (new Date(row.expires_at).getTime() <= now.getTime()) return "expired";
  return "valid";
}

const createSchema = z.object({
  email: z.email().max(254).transform((v) => v.trim().toLowerCase()),
  fullName: z.string().trim().max(120).optional(),
  message: z.string().trim().max(1000).optional(),
  courseIds: z.array(z.uuid()).max(50).default([]),
  role: z.enum(["teacher", "admin"]).default("teacher"),
});

function assertAdminActor(actor: SessionUser) {
  if (!actor.roles.includes("admin")) throw new UserFacingError("Only administrators can manage invitations.");
}

async function sendInvitationEmail(row: InvitationRow, token: string, actor: SessionUser, attemptKey: string) {
  await enqueueEmail({
    templateKey: "auth.teacher_invitation",
    to: row.email,
    idempotencyKey: `invite:${row.id}:${attemptKey}`,
    payload: {
      first_name: row.full_name?.split(/\s+/)[0] || "there",
      inviter_name: actor.fullName || actor.displayName,
      message: row.message ?? "",
      expires_at: formatDate(row.expires_at),
      cta_url: appUrl(`/invite/${token}`),
      details: [{ label: "Role", value: row.role === "admin" ? "Administrator" : "Instructor" }],
    },
  });
}

export async function createTeacherInvitation(
  actor: SessionUser,
  input: { email: string; fullName?: string; message?: string; courseIds?: string[]; role?: "teacher" | "admin" },
): Promise<{ id: string }> {
  assertAdminActor(actor);
  const data = createSchema.parse(input);
  const admin = createAdminClient();

  const { data: pending } = await admin
    .from("account_invitations")
    .select("id")
    .eq("email", data.email)
    .eq("role", data.role)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .limit(1);
  if (pending && pending.length > 0) {
    throw new UserFacingError("This person already has an open invitation. Resend it instead.");
  }

  const { data: existing } = await admin.from("profile_private").select("user_id").eq("email", data.email).maybeSingle();
  if (existing) {
    const userId = existing.user_id as string;
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    const has = ((roles ?? []) as { role: string }[]).some((r) => r.role === data.role);
    if (has && data.role === "admin") throw new UserFacingError("This person is already an administrator.");
    if (has && data.role === "teacher") {
      const { data: tp } = await admin.from("teacher_profiles").select("status").eq("user_id", userId).maybeSingle();
      if (tp?.status === "approved") throw new UserFacingError("This person is already an approved instructor.");
    }
  }

  if (data.courseIds.length) {
    const { data: courses } = await admin.from("courses").select("id").in("id", data.courseIds);
    if ((courses ?? []).length !== data.courseIds.length) throw new UserFacingError("One of the selected courses no longer exists.");
  }

  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000).toISOString();
  const { data: row, error } = await admin
    .from("account_invitations")
    .insert({
      email: data.email,
      role: data.role,
      token_hash: sha256(token),
      full_name: data.fullName || null,
      message: data.message || null,
      course_ids: data.courseIds,
      invited_by: actor.id,
      expires_at: expiresAt,
    })
    .select("*")
    .single();
  if (error || !row) throw new Error(`invitation insert failed: ${error?.message}`);

  await sendInvitationEmail(row as InvitationRow, token, actor, "1");
  await audit({
    actor,
    action: "invitation.created",
    entityType: "account_invitation",
    entityId: row.id as string,
    summary: `Invited ${data.email} as ${data.role}`,
    metadata: { role: data.role, courseIds: data.courseIds },
  });
  return { id: row.id as string };
}

/** Rotate the token, extend the expiry and email a fresh link. */
export async function resendInvitation(actor: SessionUser, id: string): Promise<void> {
  assertAdminActor(actor);
  const admin = createAdminClient();
  const { data: row } = await admin.from("account_invitations").select("*").eq("id", z.uuid().parse(id)).maybeSingle();
  const state = invitationState(row as InvitationRow | null);
  if (!row || state === "accepted" || state === "revoked" || state === "invalid") {
    throw new UserFacingError("This invitation can't be resent. Create a new one instead.");
  }
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000).toISOString();
  const { data: updated, error } = await admin
    .from("account_invitations")
    .update({ token_hash: sha256(token), expires_at: expiresAt })
    .eq("id", row.id)
    .select("*")
    .single();
  if (error || !updated) throw new Error(`invitation update failed: ${error?.message}`);
  await sendInvitationEmail(updated as InvitationRow, token, actor, String(Date.now()));
  await audit({ actor, action: "invitation.resent", entityType: "account_invitation", entityId: row.id as string, summary: `Resent invitation to ${row.email}` });
}

export async function revokeInvitation(actor: SessionUser, id: string): Promise<void> {
  assertAdminActor(actor);
  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("account_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", z.uuid().parse(id))
    .is("accepted_at", null)
    .is("revoked_at", null)
    .select("id, email")
    .maybeSingle();
  if (error) throw new Error(`invitation revoke failed: ${error.message}`);
  if (!row) throw new UserFacingError("This invitation was already used or revoked.");
  await audit({ actor, action: "invitation.revoked", entityType: "account_invitation", entityId: row.id as string, summary: `Revoked invitation to ${row.email}` });
}

/** Look up an invitation by the raw token from the link. */
export async function findInvitationByToken(token: string): Promise<InvitationRow | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const { data } = await createAdminClient().from("account_invitations").select("*").eq("token_hash", sha256(token)).maybeSingle();
  return (data as InvitationRow | null) ?? null;
}

async function uniqueTeacherSlug(name: string, userId: string): Promise<string> {
  const admin = createAdminClient();
  const base = slugify(name) || `instructor-${userId.slice(0, 8)}`;
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const { data } = await admin.from("teacher_profiles").select("user_id").eq("slug", candidate).maybeSingle();
    if (!data || data.user_id === userId) return candidate;
  }
  return `${base}-${userId.slice(0, 6)}`;
}

/**
 * Apply an accepted invitation to an account. Instructors start as
 * "pending" and only gain instructor access once an admin approves them.
 */
export async function acceptInvitationForUser(invitation: InvitationRow, user: { id: string; email: string; fullName: string }): Promise<void> {
  const admin = createAdminClient();
  if (invitationState(invitation) !== "valid") throw new UserFacingError("This invitation is no longer valid.");
  if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
    throw new UserFacingError("This invitation was sent to a different email address.");
  }

  // Claim the invitation first so it can't be used twice concurrently.
  const { data: claimed } = await admin
    .from("account_invitations")
    .update({ accepted_at: new Date().toISOString(), accepted_by: user.id })
    .eq("id", invitation.id)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (!claimed) throw new UserFacingError("This invitation has already been used.");

  const name = user.fullName.trim() || invitation.full_name || user.email.split("@")[0];

  if (invitation.role === "teacher") {
    const { data: existing } = await admin.from("teacher_profiles").select("user_id, status").eq("user_id", user.id).maybeSingle();
    if (!existing) {
      const { error } = await admin.from("teacher_profiles").insert({
        user_id: user.id,
        slug: await uniqueTeacherSlug(name, user.id),
        public_name: name.slice(0, 120),
        status: "pending",
      });
      if (error) throw new Error(`teacher profile insert failed: ${error.message}`);
    } else if (existing.status === "invited") {
      await admin.from("teacher_profiles").update({ status: "pending" }).eq("user_id", user.id);
    }
    await admin.from("user_roles").upsert({ user_id: user.id, role: "teacher", granted_by: invitation.invited_by }, { onConflict: "user_id,role", ignoreDuplicates: true });
    if (invitation.course_ids.length) {
      await admin
        .from("course_instructors")
        .upsert(
          invitation.course_ids.map((courseId) => ({ course_id: courseId, user_id: user.id, role: "lead", can_edit: true })),
          { onConflict: "course_id,user_id", ignoreDuplicates: true },
        );
    }
  } else {
    await admin.from("user_roles").upsert({ user_id: user.id, role: "admin", granted_by: invitation.invited_by }, { onConflict: "user_id,role", ignoreDuplicates: true });
  }

  await logAuthEvent({ userId: user.id, email: user.email, event: "invitation_accepted", metadata: { role: invitation.role } });
  await audit({
    actor: null,
    action: "invitation.accepted",
    entityType: "account_invitation",
    entityId: invitation.id,
    summary: `${user.email} accepted an invitation as ${invitation.role}`,
    metadata: { userId: user.id },
  });

  const admins = await listAdminUserIds();
  await notify(
    admins.filter((id) => id !== user.id),
    invitation.role === "teacher"
      ? {
          category: "system",
          type: "instructor_pending",
          title: `${name} accepted their instructor invitation`,
          body: "Review and approve their instructor account.",
          url: "/admin/instructors",
        }
      : { category: "system", type: "admin_added", title: `${name} joined as an administrator`, url: "/admin/audit" },
  );
}
