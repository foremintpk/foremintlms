import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";

export const SETTINGS_TAG = "platform-settings";

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

/** Every setting (server-only values included). Needs the secret key. */
async function loadAllSettings(): Promise<Record<string, Json>> {
  "use cache";
  cacheTag(SETTINGS_TAG);
  cacheLife("minutes");
  const { data, error } = await createAdminClient().from("platform_settings").select("key, value");
  if (error) throw new Error(`Could not load platform settings: ${error.message}`);
  return Object.fromEntries((data ?? []).map((row) => [row.key, row.value as Json]));
}

/**
 * Only settings flagged public, read with the anonymous key (RLS enforces
 * is_public). Public pages use this, so they never touch the secret key.
 */
async function loadPublicSettingsRows(): Promise<Record<string, Json>> {
  "use cache";
  cacheTag(SETTINGS_TAG);
  cacheLife("minutes");
  const { data, error } = await createPublicClient().from("platform_settings").select("key, value").eq("is_public", true);
  if (error) throw new Error(`Could not load public settings: ${error.message}`);
  return Object.fromEntries((data ?? []).map((row) => [row.key, row.value as Json]));
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const all = await loadAllSettings();
  const value = all[key];
  if (value === undefined || value === null || value === "") return fallback;
  return value as T;
}

/** A setting flagged public, read without the secret key (safe on public, prerendered pages). */
export async function getPublicSetting<T>(key: string, fallback: T): Promise<T> {
  const rows = await loadPublicSettingsRows();
  const value = rows[key];
  if (value === undefined || value === null || value === "") return fallback;
  return value as T;
}

export async function getAdminMfaRequired(): Promise<boolean> {
  return getSetting<boolean>("security.require_admin_mfa", true);
}

export interface PublicSettings {
  brandName: string;
  tagline: string;
  primaryColor: string;
  accentColor: string;
  logoUrl: string;
  supportEmail: string;
  phone: string;
  socialLinks: Record<string, string>;
  legalEntityName: string;
  businessAddress: string;
  jurisdiction: string;
  registrationNumber: string;
  allowGoogleLogin: boolean;
  gaMeasurementId: string;
  plausibleDomain: string;
}

/** Settings that are safe to render on public pages. */
export async function getPublicSettings(): Promise<PublicSettings> {
  const all = await loadPublicSettingsRows();
  const str = (k: string, d = "") => (typeof all[k] === "string" ? (all[k] as string) : d);
  return {
    brandName: str("brand.name", "Foremint Academy"),
    tagline: str("brand.tagline", "Build Skills. Create Opportunities. Grow Beyond Limits."),
    primaryColor: str("brand.primary_color", "#5B3DF5"),
    accentColor: str("brand.accent_color", "#3DDC97"),
    logoUrl: str("brand.logo_url"),
    supportEmail: str("contact.support_email") || process.env.SUPPORT_EMAIL || "",
    phone: str("contact.phone"),
    socialLinks: (all["contact.social_links"] as Record<string, string> | undefined) ?? {},
    legalEntityName: str("legal.entity_name"),
    businessAddress: str("legal.business_address"),
    jurisdiction: str("legal.jurisdiction"),
    registrationNumber: str("legal.registration_number"),
    allowGoogleLogin: all["security.allow_google_login"] === true,
    gaMeasurementId: str("analytics.ga_measurement_id"),
    plausibleDomain: str("analytics.plausible_domain"),
  };
}
