import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { UserFacingError } from "@/lib/actions";
import { logAuthEvent } from "@/lib/services/account";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Account suspension. A suspended account:
 *  - has profile_private.status = 'suspended' (RLS helpers deny it everything),
 *  - is banned in Supabase Auth, so its refresh tokens stop working.
 * Existing access tokens expire on their own within the JWT lifetime.
 */
export async function suspendAccount(actor: SessionUser, userId: string, reason: string) {
  if (actor.id === userId) throw new UserFacingError("You can't suspend your own account.");
  const admin = createAdminClient();
  const { error } = await admin
    .from("profile_private")
    .update({ status: "suspended", suspended_reason: reason })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
  if (banError) throw new Error(`Could not ban user in auth: ${banError.message}`);
  await logAuthEvent({ userId, event: "session_revoked", metadata: { scope: "suspension", by: actor.id } });
  await audit({ actor, action: "account.suspended", entityType: "user", entityId: userId, summary: reason, metadata: { reason } });
}

export async function reactivateAccount(actor: SessionUser, userId: string) {
  const admin = createAdminClient();
  const { error } = await admin.from("profile_private").update({ status: "active", suspended_reason: null }).eq("user_id", userId);
  if (error) throw new Error(error.message);
  const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
  if (banError) throw new Error(`Could not lift auth ban: ${banError.message}`);
  await audit({ actor, action: "account.reactivated", entityType: "user", entityId: userId });
}
