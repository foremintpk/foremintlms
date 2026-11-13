import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getAdminMfaRequired } from "@/lib/settings";
import type { SessionUser } from "@/lib/auth/session";
import { AccountTabs } from "./account-tabs";
import { NOTIFICATION_CATEGORIES, type AccountTab } from "./constants";
import { PreferencesPanel, type PreferenceMap } from "./preferences-panel";
import { PrivacyPanel } from "./privacy-panel";
import { ProfilePanel } from "./profile-panel";
import { SecurityPanel, type FactorView } from "./security-panel";

/**
 * Personal account settings: profile, security (password, MFA, devices),
 * notification preferences and privacy. Used by every workspace.
 */
export async function AccountSettings({
  user,
  defaultTab = "profile",
  settingsPath = "/learn/settings",
}: {
  user: SessionUser;
  defaultTab?: AccountTab;
  settingsPath?: string;
}) {
  const supabase = await createClient();
  const [profileRes, privateRes, prefsRes, factorsRes, mfaSetting] = await Promise.all([
    supabase.from("profiles").select("full_name, display_name, headline, bio, timezone, avatar_url").eq("id", user.id).maybeSingle(),
    supabase.from("profile_private").select("deletion_requested_at").eq("user_id", user.id).maybeSingle(),
    supabase.from("notification_preferences").select("category, email_enabled, in_app_enabled").eq("user_id", user.id),
    supabase.auth.mfa.listFactors(),
    getAdminMfaRequired(),
  ]);

  const profile = profileRes.data as {
    full_name: string;
    display_name: string | null;
    headline: string | null;
    bio: string | null;
    timezone: string;
    avatar_url: string | null;
  } | null;

  const prefRows = (prefsRes.data ?? []) as { category: string; email_enabled: boolean; in_app_enabled: boolean }[];
  const prefs = Object.fromEntries(
    NOTIFICATION_CATEGORIES.map((c) => {
      const row = prefRows.find((r) => r.category === c.key);
      // Marketing is opt-in; everything else defaults to on.
      return [c.key, { email: row ? row.email_enabled : c.key !== "marketing", inApp: row ? row.in_app_enabled : c.key !== "marketing" }];
    }),
  ) as PreferenceMap;

  const factors: FactorView[] = (factorsRes.data?.totp ?? [])
    .filter((f) => f.status === "verified")
    .map((f) => ({ id: f.id, name: f.friendly_name || "Authenticator app", createdAt: f.created_at }));

  return (
    <AccountTabs
      defaultTab={defaultTab}
      panels={{
        profile: (
          <ProfilePanel
            initial={{
              email: user.email,
              fullName: profile?.full_name ?? user.fullName,
              displayName: profile?.display_name ?? "",
              headline: profile?.headline ?? "",
              bio: profile?.bio ?? "",
              timezone: profile?.timezone ?? "UTC",
              avatarUrl: profile?.avatar_url ?? null,
            }}
          />
        ),
        security: (
          <SecurityPanel
            factors={factors}
            aal={user.aal}
            mfaRequired={user.roles.includes("admin") && mfaSetting}
            passwordContext={[user.fullName, user.email.split("@")[0]]}
            settingsPath={settingsPath}
          />
        ),
        notifications: <PreferencesPanel initial={prefs} />,
        privacy: <PrivacyPanel deletionRequestedAt={(privateRes.data?.deletion_requested_at as string | null | undefined) ?? null} />,
      }}
    />
  );
}
