"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { assertUser } from "@/lib/auth/guards";
import { getAdminMfaRequired } from "@/lib/settings";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { acceptInvitationForUser, findInvitationByToken, invitationState } from "@/lib/services/invitations";
import { logAuthEvent } from "@/lib/services/account";
import { isPasswordAcceptable } from "@/components/auth/utils";

const tokenSchema = z.string().min(20).max(100);

async function destinationFor(role: "teacher" | "admin"): Promise<string> {
  if (role === "admin") return (await getAdminMfaRequired()) ? "/mfa?next=%2Fadmin" : "/admin";
  return "/invite/accepted";
}

/** Accept while signed in with the invited email address. */
export async function acceptInvitationAction(input: { token: string }): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(async () => {
    const token = tokenSchema.parse(input.token);
    const user = await assertUser();
    await enforceRateLimit("invite-accept", 10, 900, user.id);
    const invitation = await findInvitationByToken(token);
    if (!invitation || invitationState(invitation) !== "valid") throw new UserFacingError("This invitation is no longer valid.");
    await acceptInvitationForUser(invitation, { id: user.id, email: user.email, fullName: user.fullName });
    return ok({ redirectTo: await destinationFor(invitation.role) });
  });
}

const newAccountSchema = z.object({
  token: tokenSchema,
  fullName: z.string().trim().min(2, "Enter your full name").max(120),
  password: z.string().min(10, "Use at least 10 characters").max(128),
});

/**
 * Accept by creating a new account. The emailed token proves the person
 * controls the address, so the account is created already confirmed.
 */
export async function acceptInvitationWithNewAccountAction(
  input: z.input<typeof newAccountSchema>,
): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(async () => {
    const data = newAccountSchema.parse(input);
    await enforceRateLimit("invite-accept", 10, 900);
    const invitation = await findInvitationByToken(data.token);
    if (!invitation || invitationState(invitation) !== "valid") throw new UserFacingError("This invitation is no longer valid.");
    if (!isPasswordAcceptable(data.password, [data.fullName, invitation.email.split("@")[0]])) {
      return fail("Choose a stronger password.", { password: ["Choose a stronger password — mix letters, numbers and symbols, and avoid your name."] });
    }

    const admin = createAdminClient();
    const { data: existing } = await admin.from("profile_private").select("user_id").eq("email", invitation.email).maybeSingle();
    if (existing) throw new UserFacingError("An account with this email already exists. Sign in to accept the invitation.");

    const { data: created, error } = await admin.auth.admin.createUser({
      email: invitation.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created.user) {
      console.error("[invite] createUser failed", error?.code, error?.message);
      throw new UserFacingError("We couldn't create your account. Try again, or ask for a new invitation.");
    }

    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: invitation.email, password: data.password });
    if (signInError) throw new UserFacingError("Your account was created, but we couldn't sign you in. Sign in to accept the invitation.");

    await logAuthEvent({ userId: created.user.id, email: invitation.email, event: "email_verified", metadata: { via: "invitation" } });
    await logAuthEvent({ userId: created.user.id, email: invitation.email, event: "sign_in", metadata: { method: "invitation" } });
    await acceptInvitationForUser(invitation, { id: created.user.id, email: invitation.email, fullName: data.fullName });
    return ok({ redirectTo: await destinationFor(invitation.role) });
  });
}
