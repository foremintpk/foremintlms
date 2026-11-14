import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/security/crypto";
import { appUrl } from "@/lib/env";
import { REQUIRED_FIELDS, type IntegrationProvider } from "@/lib/services/integrations";
import type { Json } from "@/types/database";

/**
 * Admin-side view of integration credentials. Secret values never leave the
 * server: the UI receives only "set / not set", where the value comes from
 * (environment or admin-entered) and a masked preview.
 */

export interface FieldMeta {
  key: string;
  label: string;
  secret: boolean;
  envVar: string;
  kind?: "text" | "select" | "boolean" | "textarea";
  options?: { value: string; label: string }[];
  placeholder?: string;
  help?: string;
}

export interface ProviderMeta {
  id: IntegrationProvider;
  name: string;
  purpose: string;
  fields: FieldMeta[];
  urls: { label: string; path: string }[];
  steps: string[];
}

export const PROVIDERS: ProviderMeta[] = [
  {
    id: "whop",
    name: "Whop",
    purpose: "Payments, subscriptions, refunds and receipts.",
    fields: [
      { key: "apiKey", label: "API key", secret: true, envVar: "WHOP_API_KEY", placeholder: "Company API key" },
      { key: "companyId", label: "Company ID", secret: false, envVar: "WHOP_COMPANY_ID", placeholder: "biz_…" },
      {
        key: "webhookSecret",
        label: "Webhook signing secret",
        secret: true,
        envVar: "WHOP_WEBHOOK_SECRET",
        placeholder: "ws_…",
        help: "Whop → Developer → Webhooks → your endpoint: the signing secret starting with ws_ (not a delivery ID like whdel_…).",
      },
      {
        key: "environment",
        label: "Environment",
        secret: false,
        envVar: "WHOP_ENVIRONMENT",
        kind: "select",
        options: [
          { value: "production", label: "Production" },
          { value: "sandbox", label: "Sandbox (test payments)" },
        ],
      },
    ],
    urls: [{ label: "Webhook URL", path: "/api/webhooks/whop" }],
    steps: [
      "In the Whop developer dashboard, create a company API key with access to products, plans, checkout, payments, memberships, refunds and promo codes.",
      "Add a webhook pointing at the URL below and subscribe to payment, membership, refund and dispute events.",
      "Paste the API key, your company ID and the webhook signing secret here, then test the connection.",
    ],
  },
  {
    id: "resend",
    name: "Resend",
    purpose: "Transactional email: verification, receipts, reminders and notifications.",
    fields: [
      { key: "apiKey", label: "API key", secret: true, envVar: "RESEND_API_KEY", placeholder: "re_…" },
      { key: "fromEmail", label: "From address", secret: false, envVar: "EMAIL_FROM", placeholder: "Foremint Academy <hello@mail.yourdomain.com>" },
      { key: "webhookSecret", label: "Webhook signing secret", secret: true, envVar: "RESEND_WEBHOOK_SECRET", help: "Optional — records delivery, bounce and complaint events." },
    ],
    urls: [{ label: "Webhook URL", path: "/api/webhooks/resend" }],
    steps: [
      "Verify your sending domain in Resend and add its SPF, DKIM and DMARC DNS records.",
      "Create an API key with sending access and paste it here with a From address on the verified domain.",
      "Optionally add a webhook for email events and paste its signing secret.",
    ],
  },
  {
    id: "mux",
    name: "Mux",
    purpose: "Protected video hosting with signed playback and captions.",
    fields: [
      { key: "tokenId", label: "Access token ID", secret: false, envVar: "MUX_TOKEN_ID" },
      { key: "tokenSecret", label: "Access token secret", secret: true, envVar: "MUX_TOKEN_SECRET" },
      { key: "webhookSecret", label: "Webhook signing secret", secret: true, envVar: "MUX_WEBHOOK_SECRET" },
      { key: "signingKeyId", label: "Signing key ID", secret: false, envVar: "MUX_SIGNING_KEY_ID", help: "Enables signed (private) playback." },
      { key: "signingPrivateKey", label: "Signing private key", secret: true, envVar: "MUX_SIGNING_PRIVATE_KEY", kind: "textarea", help: "Base64 key exactly as Mux shows it." },
    ],
    urls: [{ label: "Webhook URL", path: "/api/webhooks/mux" }],
    steps: [
      "Create an access token with Mux Video read and write permissions.",
      "Create a signing key so lesson videos use signed playback URLs.",
      "Add a webhook for the URL below so processing status updates automatically.",
    ],
  },
  {
    id: "bunny",
    name: "Bunny Stream",
    purpose: "Lower-cost video hosting with token-protected embeds.",
    fields: [
      { key: "libraryId", label: "Video library ID", secret: false, envVar: "BUNNY_STREAM_LIBRARY_ID" },
      { key: "apiKey", label: "Library API key", secret: true, envVar: "BUNNY_STREAM_API_KEY" },
      { key: "tokenKey", label: "Token authentication key", secret: true, envVar: "BUNNY_STREAM_TOKEN_KEY", help: "Turn on embed token authentication in the library's security settings." },
      { key: "cdnHostname", label: "CDN hostname", secret: false, envVar: "BUNNY_STREAM_CDN_HOSTNAME", placeholder: "vz-xxxxxxxx-xxx.b-cdn.net" },
      { key: "webhookSecret", label: "Webhook secret", secret: true, envVar: "BUNNY_WEBHOOK_SECRET", help: "Any long random value; add it to the webhook URL as ?secret=…" },
    ],
    urls: [{ label: "Webhook URL (append ?secret=<your webhook secret>)", path: "/api/webhooks/bunny" }],
    steps: [
      "Create a Stream library and copy its ID and API key.",
      "Enable token authentication and copy the token key.",
      "Set the library's webhook URL to the address below with ?secret=<your webhook secret> appended.",
    ],
  },
  {
    id: "youtube",
    name: "YouTube (unlisted)",
    purpose: "Embed unlisted YouTube videos in lessons. No credentials needed.",
    fields: [{ key: "enabled", label: "Allow YouTube videos in lessons", secret: false, envVar: "", kind: "boolean" }],
    urls: [],
    steps: [
      "Upload videos to YouTube as Unlisted and paste their links in the lesson editor.",
      "Unlisted videos can be watched by anyone who has the link. Use Mux or Bunny for content that must stay private.",
    ],
  },
  {
    id: "zoom",
    name: "Zoom",
    purpose: "Create and manage live class meetings from each instructor's Zoom account.",
    fields: [
      { key: "clientId", label: "Client ID", secret: false, envVar: "ZOOM_CLIENT_ID" },
      { key: "clientSecret", label: "Client secret", secret: true, envVar: "ZOOM_CLIENT_SECRET" },
      { key: "redirectUri", label: "Redirect URL", secret: false, envVar: "ZOOM_REDIRECT_URI", placeholder: "https://…/api/integrations/zoom/callback" },
      { key: "webhookSecretToken", label: "Webhook secret token", secret: true, envVar: "ZOOM_WEBHOOK_SECRET_TOKEN" },
    ],
    urls: [
      { label: "OAuth redirect URL", path: "/api/integrations/zoom/callback" },
      { label: "Event notification URL", path: "/api/webhooks/zoom" },
    ],
    steps: [
      "Create a General (OAuth, user-managed) app in the Zoom App Marketplace.",
      "Add the redirect URL below and the meeting and recording scopes listed in docs/teaching-live.md.",
      "Add an event subscription to the notification URL and copy its secret token.",
      "Each instructor then connects their own Zoom account from their settings.",
    ],
  },
  {
    id: "google",
    name: "Google Meet",
    purpose: "Create Google Meet spaces for live classes from each instructor's Google account.",
    fields: [
      { key: "clientId", label: "OAuth client ID", secret: false, envVar: "GOOGLE_CLIENT_ID" },
      { key: "clientSecret", label: "OAuth client secret", secret: true, envVar: "GOOGLE_CLIENT_SECRET" },
      { key: "redirectUri", label: "Redirect URL", secret: false, envVar: "GOOGLE_REDIRECT_URI", placeholder: "https://…/api/integrations/google/callback" },
    ],
    urls: [{ label: "OAuth redirect URL", path: "/api/integrations/google/callback" }],
    steps: [
      "In Google Cloud, enable the Google Meet REST API and configure the OAuth consent screen.",
      "Create a Web OAuth client with the redirect URL below.",
      "Each instructor connects their own Google account from their settings.",
    ],
  },
];

export type FieldSource = "env" | "admin" | "missing";

export interface FieldState {
  key: string;
  label: string;
  secret: boolean;
  kind: NonNullable<FieldMeta["kind"]>;
  options?: { value: string; label: string }[];
  placeholder?: string;
  help?: string;
  envVar: string;
  source: FieldSource;
  /** Non-secret value, or a masked preview for secrets. Never a full secret. */
  display: string;
  /** Current value for non-secret, admin-entered fields (to pre-fill the form). */
  editableValue: string;
}

export interface ProviderState {
  id: IntegrationProvider;
  name: string;
  purpose: string;
  status: "not_configured" | "configured" | "connected" | "error";
  lastCheckedAt: string | null;
  lastError: string | null;
  fields: FieldState[];
  urls: { label: string; url: string }[];
  steps: string[];
  missingRequired: string[];
}

interface StoredRow {
  provider: string;
  config: Record<string, unknown> | null;
  secrets_enc: string | null;
  status: string;
  last_checked_at: string | null;
  last_error: string | null;
}

export function decryptStored(row: Pick<StoredRow, "secrets_enc"> | undefined): Record<string, string> {
  if (!row?.secrets_enc) return {};
  try {
    return JSON.parse(decryptSecret(row.secrets_enc)) as Record<string, string>;
  } catch {
    return {};
  }
}

function envValue(name: string): string {
  return name ? (process.env[name] ?? "").trim() : "";
}

export async function getProviderStates(): Promise<ProviderState[]> {
  const { data, error } = await createAdminClient().from("integration_settings").select("provider, config, secrets_enc, status, last_checked_at, last_error");
  if (error) throw new Error(error.message);
  const rows = new Map(((data ?? []) as StoredRow[]).map((r) => [r.provider, r]));

  return PROVIDERS.map((p) => {
    const row = rows.get(p.id);
    const config = (row?.config ?? {}) as Record<string, unknown>;
    const secrets = decryptStored(row);
    const fields: FieldState[] = p.fields.map((f) => {
      const env = envValue(f.envVar);
      const stored = f.secret ? (secrets[f.key] ?? "") : config[f.key];
      const storedText = typeof stored === "string" ? stored : typeof stored === "boolean" ? String(stored) : "";
      const source: FieldSource = env ? "env" : storedText ? "admin" : "missing";
      const raw = env || storedText;
      return {
        key: f.key,
        label: f.label,
        secret: f.secret,
        kind: f.kind ?? "text",
        options: f.options,
        placeholder: f.placeholder,
        help: f.help,
        envVar: f.envVar,
        source: f.kind === "boolean" && !raw ? "admin" : source,
        display: f.secret ? maskSecret(raw) : f.kind === "boolean" ? (config[f.key] === false ? "Off" : "On") : raw,
        editableValue: f.secret ? "" : f.kind === "boolean" ? String(config[f.key] !== false) : storedText,
      };
    });
    const required = REQUIRED_FIELDS[p.id] as string[];
    const missingRequired = required.filter((k) => fields.find((f) => f.key === k)?.source === "missing");
    const configured = missingRequired.length === 0;
    let status: ProviderState["status"] = configured ? "configured" : "not_configured";
    if (configured && row?.status === "connected") status = "connected";
    if (configured && row?.status === "error") status = "error";
    return {
      id: p.id,
      name: p.name,
      purpose: p.purpose,
      status,
      lastCheckedAt: row?.last_checked_at ?? null,
      lastError: row?.last_error ?? null,
      fields,
      urls: p.urls.map((u) => ({ label: u.label, url: appUrl(u.path) })),
      steps: p.steps,
      missingRequired: missingRequired.map((k) => p.fields.find((f) => f.key === k)?.label ?? k),
    };
  });
}

/**
 * Merge submitted values into stored config/secrets. Blank secret inputs keep
 * the current value; `clear` lists keys to remove.
 */
export async function saveProviderValues(provider: IntegrationProvider, values: Record<string, string>, clear: string[], actorId: string) {
  const meta = PROVIDERS.find((p) => p.id === provider);
  if (!meta) throw new Error("Unknown provider");
  const admin = createAdminClient();
  const { data: row } = await admin.from("integration_settings").select("config, secrets_enc").eq("provider", provider).maybeSingle();
  const config = { ...((row?.config as Record<string, unknown> | null) ?? {}) };
  const secrets = decryptStored(row as StoredRow | undefined);

  for (const f of meta.fields) {
    const incoming = values[f.key];
    if (clear.includes(f.key)) {
      if (f.secret) delete secrets[f.key];
      else delete config[f.key];
      continue;
    }
    if (incoming === undefined) continue;
    if (f.kind === "boolean") {
      config[f.key] = incoming === "true";
    } else if (f.secret) {
      if (incoming.trim()) secrets[f.key] = incoming.trim();
    } else {
      if (incoming.trim()) config[f.key] = incoming.trim();
      else delete config[f.key];
    }
  }

  const { error } = await admin.from("integration_settings").upsert(
    {
      provider,
      config: config as Json,
      secrets_enc: Object.keys(secrets).length ? encryptSecret(JSON.stringify(secrets)) : null,
      status: "configured",
      last_error: null,
      updated_by: actorId,
    },
    { onConflict: "provider" },
  );
  if (error) throw new Error(error.message);
  return {
    changedKeys: meta.fields.filter((f) => clear.includes(f.key) || (values[f.key] !== undefined && (f.secret ? values[f.key].trim() !== "" : true))).map((f) => f.key),
  };
}

export async function recordTestResult(provider: IntegrationProvider, result: { ok: boolean; message: string }) {
  await createAdminClient()
    .from("integration_settings")
    .upsert(
      {
        provider,
        status: result.ok ? "connected" : "error",
        last_checked_at: new Date().toISOString(),
        last_error: result.ok ? null : result.message.slice(0, 500),
      },
      { onConflict: "provider" },
    );
}
