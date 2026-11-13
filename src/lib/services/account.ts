import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { notify } from "@/lib/services/notifications";
import { getAdminMfaRequired } from "@/lib/settings";
import { getRequestMeta } from "@/lib/security/request";
import { highestRole, type AppRole } from "@/lib/auth/session";
import type { Json } from "@/types/database";
import type { ConfirmType } from "@/components/auth/utils";

export type AuthEventName =
  | "sign_in"
  | "sign_in_failed"
  | "sign_out"
  | "sign_up"
  | "password_reset_requested"
  | "password_changed"
  | "email_verified"
  | "mfa_enrolled"
  | "mfa_verified"
  | "mfa_removed"
  | "session_revoked"
  | "invitation_accepted";

/** Record an authentication event (never throws). */
export async function logAuthEvent(input: {
  userId?: string | null;
  email?: string | null;
  event: AuthEventName;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const meta = await getRequestMeta().catch(() => ({ ip: null, userAgent: null }));
    const { error } = await createAdminClient()
      .from("auth_events")
      .insert({
        user_id: input.userId ?? null,
        email: input.email?.toLowerCase() ?? null,
        event: input.event,
        ip_address: meta.ip,
        user_agent: meta.userAgent,
        metadata: (input.metadata ?? {}) as Json,
      });
    if (error) console.error("[auth-event] insert failed", error.message);
  } catch (err) {
    console.error("[auth-event] failed", err);
  }
}

/** Link to /auth/confirm for a token hash produced by auth.admin.generateLink. */
export function buildConfirmUrl(tokenHash: string, type: ConfirmType, next: string): string {
  const params = new URLSearchParams({ token_hash: tokenHash, type, next });
  return appUrl(`/auth/confirm?${params.toString()}`);
}

/**
 * Local development only: print auth links to the server console so sign-up
 * and password reset can be tested before Resend is configured. Never runs
 * in production.
 */
export function devLogLink(label: string, url: string): void {
  if (process.env.NODE_ENV !== "production") {
    console.info(`\n[dev] ${label}: ${url}\n`);
  }
}

export async function findUserIdByEmail(email: string): Promise<{ id: string; status: string } | null> {
  const { data } = await createAdminClient()
    .from("profile_private")
    .select("user_id, status")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  return data ? { id: data.user_id as string, status: data.status as string } : null;
}

export async function getFirstName(userId: string): Promise<string> {
  const { data } = await createAdminClient().from("profiles").select("full_name").eq("id", userId).maybeSingle();
  return ((data?.full_name as string | undefined) ?? "").trim().split(/\s+/)[0] || "there";
}

/** Where a user lands after signing in, and whether MFA must happen first. */
export async function postSignInDestination(userId: string, aal: string | undefined, next: string | null): Promise<string> {
  const admin = createAdminClient();
  const [{ data: roles }, { data: teacher }] = await Promise.all([
    admin.from("user_roles").select("role").eq("user_id", userId),
    admin.from("teacher_profiles").select("status").eq("user_id", userId).maybeSingle(),
  ]);
  const effective = ((roles ?? []) as { role: AppRole }[])
    .map((r) => r.role)
    .filter((r) => r !== "teacher" || teacher?.status === "approved");
  const primary = highestRole(effective.length ? effective : ["student"]);
  const home = primary === "admin" ? "/admin" : primary === "teacher" ? "/teach" : "/learn";
  const destination = next ?? home;

  const needsMfa = effective.includes("admin") && aal !== "aal2" && (await getAdminMfaRequired());
  if (needsMfa && (destination.startsWith("/admin") || primary === "admin")) {
    return `/mfa?next=${encodeURIComponent(destination)}`;
  }
  return destination;
}

/**
 * A sign-in counts as a new device when this user agent hasn't signed in
 * to the account in the last 90 days — and the account has signed in before
 * (the very first sign-in isn't suspicious).
 */
export async function isNewDevice(userId: string, userAgent: string | null): Promise<boolean> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const [{ count: previous }, { count: sameDevice }] = await Promise.all([
    admin.from("auth_events").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("event", "sign_in"),
    userAgent
      ? admin
          .from("auth_events")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("event", "sign_in")
          .eq("user_agent", userAgent)
          .gte("created_at", since)
      : Promise.resolve({ count: 0 }),
  ]);
  return (previous ?? 0) > 0 && (sameDevice ?? 0) === 0;
}

/** Security notice after any password change (in-app + required email). */
export async function notifyPasswordChanged(userId: string): Promise<void> {
  await notify(userId, {
    category: "system",
    type: "password_changed",
    title: "Your password was changed",
    url: "/learn/settings?tab=security",
    email: {
      templateKey: "auth.password_changed",
      required: true,
      idempotencyKey: `password-changed:${userId}:${Date.now()}`,
      payload: { changed_at: `${formatDateTime(new Date())} UTC`, cta_url: appUrl("/learn/settings?tab=security") },
    },
  });
}

export async function listAdminUserIds(): Promise<string[]> {
  const { data } = await createAdminClient().from("user_roles").select("user_id").eq("role", "admin");
  return [...new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id))];
}
