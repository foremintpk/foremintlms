"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { assertUser } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { appUrl, publicEnv } from "@/lib/env";
import { getAdminMfaRequired, getPublicSettings } from "@/lib/settings";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { notify, notifyStaffEmail } from "@/lib/services/notifications";
import { listAdminUserIds, logAuthEvent, notifyPasswordChanged } from "@/lib/services/account";
import { isPasswordAcceptable } from "@/components/auth/utils";
import { NOTIFICATION_CATEGORIES } from "./constants";

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

function isValidTimeZone(tz: string): boolean {
  if (tz === "UTC") return true;
  try {
    return Intl.supportedValuesOf("timeZone").includes(tz);
  } catch {
    return false;
  }
}

const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(120),
  displayName: z.string().trim().max(80).optional(),
  headline: z.string().trim().max(160).optional(),
  bio: z.string().trim().max(4000).optional(),
  timezone: z.string().trim().max(64).refine(isValidTimeZone, "Choose a time zone from the list"),
});

export async function updateProfileAction(input: z.input<typeof profileSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const data = profileSchema.parse(input);
    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: data.fullName,
        display_name: data.displayName || null,
        headline: data.headline || null,
        bio: data.bio || null,
        timezone: data.timezone,
      })
      .eq("id", user.id);
    if (error) throw new Error(`profile update failed: ${error.message}`);
    return ok(null, "Profile saved");
  });
}

const avatarSchema = z.object({ url: z.url().max(2048) });

export async function updateAvatarAction(input: z.input<typeof avatarSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const { url } = avatarSchema.parse(input);
    const prefix = `${publicEnv().NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/avatars/${user.id}/`;
    if (!url.startsWith(prefix)) throw new UserFacingError("Upload the photo here first, then save it.");
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
    if (error) throw new Error(`avatar update failed: ${error.message}`);
    return ok(null, "Profile photo updated");
  });
}

export async function removeAvatarAction(): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
    if (error) throw new Error(`avatar removal failed: ${error.message}`);
    return ok(null, "Profile photo removed");
  });
}

// ---------------------------------------------------------------------------
// Security
// ---------------------------------------------------------------------------

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password").max(128),
    newPassword: z.string().min(10, "Use at least 10 characters").max(128),
    confirm: z.string(),
    signOutOthers: z.boolean().default(true),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "Passwords don't match" })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ["newPassword"], message: "Choose a password different from your current one" });

/**
 * Confirm the current password with a throwaway, cookie-less client so the
 * check doesn't disturb the real session, then end that temporary session.
 */
async function verifyCurrentPassword(email: string, password: string): Promise<boolean> {
  const env = publicEnv();
  const temp = createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await temp.auth.signInWithPassword({ email, password });
  if (error || !data.session) return false;
  await temp.auth.signOut({ scope: "local" });
  return true;
}

export async function changePasswordAction(input: z.input<typeof passwordSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    await enforceRateLimit("password-change", 5, 900, user.id);
    const data = passwordSchema.parse(input);
    if (!isPasswordAcceptable(data.newPassword, [user.fullName, user.email.split("@")[0]])) {
      return fail("Choose a stronger password.", { newPassword: ["Choose a stronger password — mix letters, numbers and symbols, and avoid your name."] });
    }
    if (!(await verifyCurrentPassword(user.email, data.currentPassword))) {
      return fail("Your current password is incorrect.", { currentPassword: ["Your current password is incorrect."] });
    }
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password: data.newPassword });
    if (error) {
      if (error.code === "reauthentication_needed") {
        throw new UserFacingError("For security, sign out and sign back in, then change your password.");
      }
      if (error.code === "weak_password") return fail("Choose a stronger password.", { newPassword: [error.message] });
      if (error.code === "same_password") return fail("Choose a new password.", { newPassword: ["That's your current password."] });
      throw new Error(`password update failed: ${error.code} ${error.message}`);
    }
    if (data.signOutOthers) await supabase.auth.signOut({ scope: "others" });
    await logAuthEvent({ userId: user.id, email: user.email, event: "password_changed", metadata: { via: "settings", signedOutOthers: data.signOutOthers } });
    await notifyPasswordChanged(user.id);
    return ok(null, "Password changed");
  });
}

export async function removeFactorAction(input: { factorId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const factorId = z.string().min(1).max(100).parse(input.factorId);
    const supabase = await createClient();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const verified = (factors?.totp ?? []).filter((f) => f.status === "verified");
    if (!verified.some((f) => f.id === factorId)) throw new UserFacingError("That authenticator isn't on your account.");
    if (user.aal !== "aal2") throw new UserFacingError("Verify with your authenticator app before removing it.");
    if (user.roles.includes("admin") && verified.length <= 1 && (await getAdminMfaRequired())) {
      throw new UserFacingError("Administrators must keep at least one authenticator. Add a new one before removing this one.");
    }
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) throw new UserFacingError("We couldn't remove that authenticator. Verify again and retry.");
    await logAuthEvent({ userId: user.id, email: user.email, event: "mfa_removed", metadata: { factorId } });
    await audit({ actor: user, action: "account.mfa_removed", entityType: "user", entityId: user.id, summary: "Removed an authenticator app" });
    return ok(null, "Authenticator removed");
  });
}

export async function signOutOtherDevicesAction(): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: "others" });
    if (error) throw new Error(`sign out others failed: ${error.message}`);
    await logAuthEvent({ userId: user.id, email: user.email, event: "session_revoked", metadata: { scope: "others" } });
    return ok(null, "Signed out of all other devices");
  });
}

// ---------------------------------------------------------------------------
// Notification preferences
// ---------------------------------------------------------------------------

const prefsSchema = z.object({
  preferences: z
    .array(
      z.object({
        category: z.enum(NOTIFICATION_CATEGORIES.map((c) => c.key) as [string, ...string[]]),
        email_enabled: z.boolean(),
        in_app_enabled: z.boolean(),
      }),
    )
    .max(NOTIFICATION_CATEGORIES.length),
});

export async function updateNotificationPreferencesAction(input: z.input<typeof prefsSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const { preferences } = prefsSchema.parse(input);
    const supabase = await createClient();
    const { error } = await supabase
      .from("notification_preferences")
      .upsert(
        preferences.map((p) => ({ user_id: user.id, category: p.category, email_enabled: p.email_enabled, in_app_enabled: p.in_app_enabled })),
        { onConflict: "user_id,category" },
      );
    if (error) throw new Error(`preferences update failed: ${error.message}`);
    const marketing = preferences.find((p) => p.category === "marketing");
    if (marketing) {
      await supabase.from("user_preferences").update({ marketing_emails: marketing.email_enabled }).eq("user_id", user.id);
    }
    return ok(null, "Notification preferences saved");
  });
}

// ---------------------------------------------------------------------------
// Privacy
// ---------------------------------------------------------------------------

const deletionSchema = z.object({ reason: z.string().trim().max(1000).optional(), confirm: z.literal("DELETE", { error: "Type DELETE to confirm" }) });

/**
 * Record a deletion request and open a support ticket so the team can
 * process it (billing records may have to be retained by law).
 */
export async function requestAccountDeletionAction(input: z.input<typeof deletionSchema>): Promise<ActionResult<{ ticketNumber: string | null }>> {
  return runAction(async () => {
    const user = await assertUser();
    await enforceRateLimit("account-deletion", 3, 86_400, user.id);
    const data = deletionSchema.parse(input);
    const supabase = await createClient();

    const { data: current } = await supabase.from("profile_private").select("deletion_requested_at").eq("user_id", user.id).maybeSingle();
    if (current?.deletion_requested_at) throw new UserFacingError("You've already asked us to delete your account. We'll be in touch by email.");

    const { error: updateError } = await supabase
      .from("profile_private")
      .update({ deletion_requested_at: new Date().toISOString() })
      .eq("user_id", user.id);
    if (updateError) throw new Error(`deletion request failed: ${updateError.message}`);

    const { data: ticket, error: ticketError } = await supabase
      .from("support_tickets")
      .insert({
        requester_id: user.id,
        subject: "Account deletion request",
        description: `Please delete my account and personal data.${data.reason ? `\n\nReason: ${data.reason}` : ""}`,
        category: "account",
        priority: "normal",
      })
      .select("id, ticket_number")
      .single();
    if (ticketError) console.error("[account] deletion ticket failed", ticketError.message);

    await audit({ actor: user, action: "account.deletion_requested", entityType: "user", entityId: user.id, summary: "Requested account deletion" });
    const admins = await listAdminUserIds();
    await notify(admins, {
      category: "support",
      type: "account_deletion_requested",
      title: `${user.fullName || user.email} asked to delete their account`,
      url: ticket ? `/admin/support/${ticket.id}` : "/admin/support",
    });
    const settings = await getPublicSettings();
    if (ticket) {
      await notifyStaffEmail(settings.supportEmail, "communication.staff_ticket_alert", `deletion-request:${user.id}`, {
        requester_name: user.fullName || user.email,
        ticket_number: ticket.ticket_number,
        ticket_priority: "normal",
        ticket_subject: "Account deletion request",
        cta_url: appUrl(`/admin/support/${ticket.id}`),
      });
    }
    return ok({ ticketNumber: (ticket?.ticket_number as string | undefined) ?? null }, "Deletion request sent");
  });
}
