import { z } from "zod";

/**
 * Admin platform settings: one zod schema per settings section plus the
 * mapping from form fields to `platform_settings` keys. Pure — unit tested.
 */

const optionalEmail = z.union([z.literal(""), z.email("Enter a valid email address")]).default("");
const optionalHttps = z
  .union([z.literal(""), z.url({ protocol: /^https$/, message: "Use an https:// link" })])
  .default("");
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour like #5B3DF5");

export const KNOWN_EXTENSIONS = [
  "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "csv", "txt", "zip", "png", "jpg", "jpeg", "webp", "gif", "mp3",
] as const;

const extList = z.array(z.enum(KNOWN_EXTENSIONS)).min(1, "Allow at least one file type");

export const SOCIAL_NETWORKS = ["linkedin", "instagram", "youtube", "x", "facebook", "tiktok"] as const;

export const settingsSchemas = {
  brand: z.object({
    name: z.string().trim().min(1, "Enter the brand name").max(80),
    tagline: z.string().trim().max(160).default(""),
    primary_color: hex,
    accent_color: hex,
    logo_url: z.union([z.literal(""), z.string().trim().max(500).refine((v) => v.startsWith("/") || v.startsWith("https://"), "Use an https:// URL or a site path")]).default(""),
  }),
  contact: z.object({
    support_email: optionalEmail,
    phone: z.string().trim().max(40).default(""),
    social_links: z.object(Object.fromEntries(SOCIAL_NETWORKS.map((n) => [n, optionalHttps])) as Record<(typeof SOCIAL_NETWORKS)[number], typeof optionalHttps>),
  }),
  legal: z.object({
    entity_name: z.string().trim().max(200).default(""),
    business_address: z.string().trim().max(500).default(""),
    jurisdiction: z.string().trim().max(200).default(""),
    registration_number: z.string().trim().max(80).default(""),
    tax_id: z.string().trim().max(80).default(""),
  }),
  billing: z.object({
    default_currency: z.string().trim().toLowerCase().regex(/^[a-z]{3}$/, "Use a 3-letter currency code"),
    default_grace_period_days: z.coerce.number().int().min(0).max(60),
    send_foremint_receipts: z.boolean(),
    invoice_footer: z.string().trim().max(600).default(""),
  }),
  security: z.object({
    require_admin_mfa: z.boolean(),
    allow_google_login: z.boolean(),
  }),
  messaging: z.object({
    students_can_message_any_teacher: z.boolean(),
  }),
  uploads: z.object({
    limits_mb: z.object({
      course_content: z.coerce.number().int().min(1).max(500),
      submission: z.coerce.number().int().min(1).max(200),
      attachment: z.coerce.number().int().min(1).max(50),
      image: z.coerce.number().int().min(1).max(20),
    }),
    allowed_extensions: z.object({ course_content: extList, submission: extList, attachment: extList }),
  }),
  learning: z.object({
    live_reminder_offsets_minutes: z
      .array(z.coerce.number().int().min(5).max(10_080))
      .min(1, "Add at least one reminder")
      .max(3, "Use up to three reminders")
      .transform((v) => [...new Set(v)].sort((a, b) => b - a)),
    access_expiry_reminder_days: z.coerce.number().int().min(1).max(60),
  }),
  analytics: z.object({
    ga_measurement_id: z.union([z.literal(""), z.string().trim().regex(/^G-[A-Z0-9]{4,20}$/, "GA4 IDs look like G-XXXXXXX")]).default(""),
    plausible_domain: z
      .union([z.literal(""), z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Enter a domain like academy.example.com")])
      .default(""),
  }),
} as const;

export type SettingsSection = keyof typeof settingsSchemas;

/** Where each field lives in platform_settings. */
export const SETTINGS_KEYS: { [S in SettingsSection]: Record<string, { key: string; isPublic: boolean; description: string }> } = {
  brand: {
    name: { key: "brand.name", isPublic: true, description: "Brand name shown across the site, emails and documents." },
    tagline: { key: "brand.tagline", isPublic: true, description: "Primary tagline." },
    primary_color: { key: "brand.primary_color", isPublic: true, description: "Primary brand colour used in emails, certificates and invoices." },
    accent_color: { key: "brand.accent_color", isPublic: true, description: "Accent colour used for progress and success states." },
    logo_url: { key: "brand.logo_url", isPublic: true, description: "Optional uploaded logo (leave empty to use the built-in mark)." },
  },
  contact: {
    support_email: { key: "contact.support_email", isPublic: true, description: "Support address shown to customers." },
    phone: { key: "contact.phone", isPublic: true, description: "Optional phone number shown on the contact page." },
    social_links: { key: "contact.social_links", isPublic: true, description: "Social profile URLs." },
  },
  legal: {
    entity_name: { key: "legal.entity_name", isPublic: true, description: "Registered legal entity that operates the academy." },
    business_address: { key: "legal.business_address", isPublic: true, description: "Registered business address." },
    jurisdiction: { key: "legal.jurisdiction", isPublic: true, description: "Governing law and jurisdiction for the terms." },
    registration_number: { key: "legal.registration_number", isPublic: true, description: "Company registration number, if applicable." },
    tax_id: { key: "legal.tax_id", isPublic: false, description: "Tax / VAT registration number, only if registered." },
  },
  billing: {
    default_currency: { key: "billing.default_currency", isPublic: false, description: "Default currency for new pricing plans." },
    default_grace_period_days: { key: "billing.default_grace_period_days", isPublic: false, description: "Days a recurring entitlement stays valid after a missed renewal." },
    send_foremint_receipts: { key: "billing.send_foremint_receipts", isPublic: false, description: "Also email a Foremint receipt when Whop already sends its own." },
    invoice_footer: { key: "billing.invoice_footer", isPublic: false, description: "Extra text printed at the bottom of Foremint-branded receipts." },
  },
  security: {
    require_admin_mfa: { key: "security.require_admin_mfa", isPublic: false, description: "Require administrators to verify with an authenticator app." },
    allow_google_login: { key: "security.allow_google_login", isPublic: true, description: 'Show "Continue with Google" on login and registration.' },
  },
  messaging: {
    students_can_message_any_teacher: {
      key: "messaging.students_can_message_any_teacher",
      isPublic: false,
      description: "Allow students to message any approved teacher, not just their own.",
    },
  },
  uploads: {
    limits_mb: { key: "uploads.limits_mb", isPublic: false, description: "Maximum upload size per purpose in megabytes." },
    allowed_extensions: { key: "uploads.allowed_extensions", isPublic: false, description: "Allowed file extensions per purpose." },
  },
  learning: {
    live_reminder_offsets_minutes: { key: "live.reminder_offsets_minutes", isPublic: false, description: "When to remind students before a live class." },
    access_expiry_reminder_days: { key: "learning.access_expiry_reminder_days", isPublic: false, description: "Days before access expires to send a reminder." },
  },
  analytics: {
    ga_measurement_id: { key: "analytics.ga_measurement_id", isPublic: true, description: "Google Analytics 4 measurement ID (loaded only after consent)." },
    plausible_domain: { key: "analytics.plausible_domain", isPublic: true, description: "Plausible Analytics domain (loaded only after consent)." },
  },
};

export const SETTINGS_SECTION_LABELS: Record<SettingsSection, string> = {
  brand: "Brand",
  contact: "Contact",
  legal: "Legal entity",
  billing: "Billing",
  security: "Security",
  messaging: "Messaging",
  uploads: "Uploads",
  learning: "Live classes & access",
  analytics: "Analytics",
};

/** Rows to upsert for a validated section. */
export function settingsRows<S extends SettingsSection>(section: S, values: z.infer<(typeof settingsSchemas)[S]>) {
  const map = SETTINGS_KEYS[section];
  return Object.entries(map).map(([field, meta]) => ({
    key: meta.key,
    value: (values as Record<string, unknown>)[field] ?? null,
    is_public: meta.isPublic,
    description: meta.description,
  }));
}

/** Build a section's current values from the flat key/value map. */
export function sectionValues(section: SettingsSection, all: Record<string, unknown>): Record<string, unknown> {
  const map = SETTINGS_KEYS[section];
  return Object.fromEntries(Object.entries(map).map(([field, meta]) => [field, all[meta.key]]));
}
