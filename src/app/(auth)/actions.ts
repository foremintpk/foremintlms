"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { assertUser } from "@/lib/auth/guards";
import { appUrl } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { getSetting } from "@/lib/settings";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { getRequestMeta } from "@/lib/security/request";
import { enqueueEmail } from "@/lib/services/email/outbox";
import { notify } from "@/lib/services/notifications";
import {
  buildConfirmUrl,
  devLogLink,
  findUserIdByEmail,
  getFirstName,
  isNewDevice,
  logAuthEvent,
  notifyPasswordChanged,
  postSignInDestination,
} from "@/lib/services/account";
import { describeUserAgent, isPasswordAcceptable, safeNextPath } from "@/components/auth/utils";

const email = z.email("Enter a valid email address").max(254).transform((v) => v.trim().toLowerCase());
const nextField = z.string().max(500).optional();

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(120),
  email,
  password: z.string().min(10, "Use at least 10 characters").max(128),
  acceptTerms: z.literal(true, { error: "Accept the terms and privacy policy to continue" }),
  next: nextField,
});

export async function registerAction(input: z.input<typeof registerSchema>): Promise<ActionResult<{ email: string }>> {
  return runAction(async () => {
    const data = registerSchema.parse(input);
    await enforceRateLimit("register", 5, 600);
    await enforceRateLimit("register-email", 3, 3600, data.email);
    if (!isPasswordAcceptable(data.password, [data.fullName, data.email.split("@")[0]])) {
      return fail("Choose a stronger password.", { password: ["Choose a stronger password — mix letters, numbers and symbols, and avoid your name."] });
    }
    const next = safeNextPath(data.next, "/learn");

    const admin = createAdminClient();
    const { data: link, error } = await admin.auth.admin.generateLink({
      type: "signup",
      email: data.email,
      password: data.password,
      options: { data: { full_name: data.fullName }, redirectTo: appUrl(next) },
    });

    if (error || !link?.properties?.hashed_token || !link.user) {
      // Existing accounts get the same response, so the form can't be used
      // to discover who is registered.
      const known = error?.code === "email_exists" || error?.code === "user_already_exists" || /already/i.test(error?.message ?? "");
      if (!known) {
        console.error("[register] generateLink failed", error?.code, error?.message);
        throw new UserFacingError("We couldn't create your account right now. Try again in a few minutes.");
      }
      return ok({ email: data.email });
    }

    const confirmUrl = buildConfirmUrl(link.properties.hashed_token, "signup", next);
    devLogLink(`Email verification link for ${data.email}`, confirmUrl);
    await enqueueEmail({
      templateKey: "auth.verify_email",
      to: data.email,
      userId: link.user.id,
      idempotencyKey: `verify:${link.user.id}:${link.properties.hashed_token.slice(0, 24)}`,
      payload: { first_name: data.fullName.split(/\s+/)[0], cta_url: confirmUrl },
    });
    await logAuthEvent({ userId: link.user.id, email: data.email, event: "sign_up" });
    return ok({ email: data.email });
  });
}

const resendSchema = z.object({ email });

/** New verification link. Always answers the same way. */
export async function resendVerificationAction(input: z.input<typeof resendSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { email: address } = resendSchema.parse(input);
    await enforceRateLimit("verify-resend", 5, 900);
    await enforceRateLimit("verify-resend-email", 3, 3600, address);

    const found = await findUserIdByEmail(address);
    if (found && found.status === "active") {
      const admin = createAdminClient();
      const { data: user } = await admin.auth.admin.getUserById(found.id);
      if (user?.user && !user.user.email_confirmed_at) {
        // A magic link verifies the address and signs the person in.
        const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: address });
        if (!error && link?.properties?.hashed_token) {
          const confirmUrl = buildConfirmUrl(link.properties.hashed_token, "magiclink", "/learn");
          devLogLink(`Email verification link for ${address}`, confirmUrl);
          await enqueueEmail({
            templateKey: "auth.verify_email",
            to: address,
            userId: found.id,
            idempotencyKey: `verify:${found.id}:${link.properties.hashed_token.slice(0, 24)}`,
            payload: { first_name: await getFirstName(found.id), cta_url: confirmUrl },
          });
        }
      }
    }
    return ok(null, "If that account needs verifying, a new link is on its way.");
  });
}

// ---------------------------------------------------------------------------
// Sign in
// ---------------------------------------------------------------------------

const loginSchema = z.object({ email, password: z.string().min(1, "Enter your password").max(128), next: nextField });

export async function loginAction(input: z.input<typeof loginSchema>): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(async () => {
    const data = loginSchema.parse(input);
    await enforceRateLimit("login", 20, 900);
    await enforceRateLimit("login-email", 8, 900, data.email);

    const supabase = await createClient();
    const { data: session, error } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password });

    if (error || !session.user) {
      await logAuthEvent({ email: data.email, event: "sign_in_failed", metadata: { code: error?.code ?? "unknown" } });
      if (error?.code === "email_not_confirmed") {
        return fail("Confirm your email address first.", {
          email: ["Confirm your email address first — use the link we sent, or request a new one below."],
        });
      }
      return fail("Email or password is incorrect.");
    }

    const userId = session.user.id;
    const { data: account } = await createAdminClient().from("profile_private").select("status").eq("user_id", userId).maybeSingle();
    if (account?.status !== "active") {
      await supabase.auth.signOut({ scope: "local" });
      await logAuthEvent({ userId, email: data.email, event: "sign_in_failed", metadata: { code: "account_suspended" } });
      return fail("This account is suspended. Contact support if you think this is a mistake.");
    }

    const meta = await getRequestMeta();
    const newDevice = await isNewDevice(userId, meta.userAgent);
    await logAuthEvent({ userId, email: data.email, event: "sign_in", metadata: { method: "password" } });
    if (newDevice) {
      const when = `${formatDateTime(new Date())} UTC`;
      const device = describeUserAgent(meta.userAgent);
      await notify(userId, {
        category: "system",
        type: "new_sign_in",
        title: "New sign-in to your account",
        body: `${device} · ${when}`,
        url: "/learn/settings?tab=security",
        email: {
          templateKey: "auth.new_account_security",
          required: true,
          idempotencyKey: `new-device:${userId}:${Date.now()}`,
          payload: {
            signed_in_at: when,
            device,
            details: [
              { label: "Device", value: device },
              ...(meta.ip ? [{ label: "IP address", value: meta.ip }] : []),
            ],
            cta_url: appUrl("/learn/settings?tab=security"),
          },
        },
      });
    }

    const claims = (await supabase.auth.getClaims()).data?.claims;
    const next = data.next ? safeNextPath(data.next, "") || null : null;
    return ok({ redirectTo: await postSignInDestination(userId, claims?.aal as string | undefined, next) });
  });
}

export async function googleSignInAction(input: { next?: string }): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(async () => {
    const enabled = await getSetting<boolean>("security.allow_google_login", false);
    if (!enabled) return fail("Google sign-in isn't available.");
    await enforceRateLimit("oauth", 20, 900);
    const next = safeNextPath(input.next, "");
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: appUrl(`/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`) },
    });
    if (error || !data.url) {
      console.error("[oauth] google start failed", error?.message);
      return fail("Google sign-in isn't available right now. Use your email and password instead.");
    }
    return ok({ redirectTo: data.url });
  });
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

const forgotSchema = z.object({ email });

export async function forgotPasswordAction(input: z.input<typeof forgotSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { email: address } = forgotSchema.parse(input);
    await enforceRateLimit("password-reset", 5, 900);
    await enforceRateLimit("password-reset-email", 3, 3600, address);

    const found = await findUserIdByEmail(address);
    if (found && found.status === "active") {
      const { data: link, error } = await createAdminClient().auth.admin.generateLink({ type: "recovery", email: address });
      if (!error && link?.properties?.hashed_token) {
        const resetUrl = buildConfirmUrl(link.properties.hashed_token, "recovery", "/reset-password");
        devLogLink(`Password reset link for ${address}`, resetUrl);
        await enqueueEmail({
          templateKey: "auth.password_reset",
          to: address,
          userId: found.id,
          idempotencyKey: `recovery:${found.id}:${link.properties.hashed_token.slice(0, 24)}`,
          payload: { first_name: await getFirstName(found.id), cta_url: resetUrl },
        });
        await logAuthEvent({ userId: found.id, email: address, event: "password_reset_requested" });
      } else if (error) {
        console.error("[password-reset] generateLink failed", error.code, error.message);
      }
    }
    return ok(null, "If an account exists for that email, a reset link is on its way.");
  });
}

const resetSchema = z
  .object({ password: z.string().min(10, "Use at least 10 characters").max(128), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });

/** Set a new password during a recovery session, then end every other session. */
export async function resetPasswordAction(input: z.input<typeof resetSchema>): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(async () => {
    const data = resetSchema.parse(input);
    const user = await assertUser();
    await enforceRateLimit("password-update", 10, 900, user.id);
    if (!isPasswordAcceptable(data.password, [user.fullName, user.email.split("@")[0]])) {
      return fail("Choose a stronger password.", { password: ["Choose a stronger password — mix letters, numbers and symbols."] });
    }
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password: data.password });
    if (error) {
      if (error.code === "same_password") return fail("Choose a password you haven't used for this account.", { password: ["Choose a new password."] });
      if (error.code === "weak_password") return fail("Choose a stronger password.", { password: [error.message] });
      throw new UserFacingError("We couldn't update your password. Request a new reset link and try again.");
    }
    await supabase.auth.signOut({ scope: "others" });
    await logAuthEvent({ userId: user.id, email: user.email, event: "password_changed", metadata: { via: "reset" } });
    await notifyPasswordChanged(user.id);
    return ok({ redirectTo: await postSignInDestination(user.id, user.aal, null) }, "Password updated");
  });
}

// ---------------------------------------------------------------------------
// Multi-factor authentication (TOTP)
// ---------------------------------------------------------------------------

export async function startTotpEnrollmentAction(): Promise<ActionResult<{ factorId: string; qrCode: string; secret: string }>> {
  return runAction(async () => {
    const user = await assertUser();
    await enforceRateLimit("mfa-enroll", 10, 900, user.id);
    const supabase = await createClient();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    // Clear abandoned, never-verified attempts so enrolment can start fresh.
    for (const f of factors?.all ?? []) {
      if (f.factor_type === "totp" && f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Authenticator app ${new Date().toISOString().slice(0, 10)}`,
      issuer: "Foremint Academy",
    });
    if (error || !data) {
      console.error("[mfa] enroll failed", error?.code, error?.message);
      throw new UserFacingError("We couldn't start authenticator setup. Make sure MFA is enabled for the project and try again.");
    }
    const qr = data.totp.qr_code.startsWith("data:") ? data.totp.qr_code : `data:image/svg+xml;utf-8,${encodeURIComponent(data.totp.qr_code)}`;
    return ok({ factorId: data.id, qrCode: qr, secret: data.totp.secret });
  });
}

const verifySchema = z.object({
  factorId: z.string().min(1).max(100),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from your app"),
  enrolling: z.boolean().default(false),
  next: nextField,
});

export async function verifyTotpAction(input: z.input<typeof verifySchema>): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(async () => {
    const data = verifySchema.parse(input);
    const user = await assertUser();
    await enforceRateLimit("mfa-verify", 10, 300, user.id);
    const supabase = await createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: data.factorId, code: data.code });
    if (error) {
      return fail("That code didn't work. Check your authenticator app and try the newest code.", { code: ["Invalid or expired code"] });
    }
    await logAuthEvent({ userId: user.id, email: user.email, event: data.enrolling ? "mfa_enrolled" : "mfa_verified" });
    const next = data.next ? safeNextPath(data.next, "") || null : null;
    return ok({ redirectTo: next ?? (await postSignInDestination(user.id, "aal2", null)) });
  });
}
