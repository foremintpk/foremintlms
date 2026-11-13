import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/security/crypto";
import { serverEnv } from "@/lib/env";

/**
 * Integration credentials. Environment variables win; values entered in
 * Admin → Integrations are stored AES-GCM encrypted and used when the env
 * var is absent. Nothing here is ever sent to the browser unmasked.
 */

export type IntegrationProvider = "whop" | "resend" | "mux" | "bunny" | "youtube" | "zoom" | "google";

export interface IntegrationValues {
  whop: { apiKey?: string; companyId?: string; webhookSecret?: string; environment: "production" | "sandbox" };
  resend: { apiKey?: string; webhookSecret?: string; fromEmail?: string };
  mux: { tokenId?: string; tokenSecret?: string; webhookSecret?: string; signingKeyId?: string; signingPrivateKey?: string };
  bunny: { libraryId?: string; apiKey?: string; tokenKey?: string; cdnHostname?: string; webhookSecret?: string };
  youtube: { enabled: boolean };
  zoom: { clientId?: string; clientSecret?: string; redirectUri?: string; webhookSecretToken?: string };
  google: { clientId?: string; clientSecret?: string; redirectUri?: string };
}

/** Which fields are required for each integration to be usable. */
export const REQUIRED_FIELDS: { [K in IntegrationProvider]: (keyof IntegrationValues[K])[] } = {
  whop: ["apiKey", "companyId", "webhookSecret"],
  resend: ["apiKey", "fromEmail"],
  mux: ["tokenId", "tokenSecret"],
  bunny: ["libraryId", "apiKey"],
  youtube: [],
  zoom: ["clientId", "clientSecret", "redirectUri"],
  google: ["clientId", "clientSecret", "redirectUri"],
};

/** Fields that are secrets (stored encrypted, shown masked). */
export const SECRET_FIELDS: Record<IntegrationProvider, string[]> = {
  whop: ["apiKey", "webhookSecret"],
  resend: ["apiKey", "webhookSecret"],
  mux: ["tokenSecret", "webhookSecret", "signingPrivateKey"],
  bunny: ["apiKey", "tokenKey", "webhookSecret"],
  youtube: [],
  zoom: ["clientSecret", "webhookSecretToken"],
  google: ["clientSecret"],
};

export const INTEGRATIONS_TAG = "integration-settings";

async function loadStored(): Promise<Record<string, { config: Record<string, unknown>; secrets: Record<string, string> }>> {
  "use cache";
  cacheTag(INTEGRATIONS_TAG);
  cacheLife("minutes");
  const { data } = await createAdminClient().from("integration_settings").select("provider, config, secrets_enc");
  const out: Record<string, { config: Record<string, unknown>; secrets: Record<string, string> }> = {};
  for (const row of data ?? []) {
    let secrets: Record<string, string> = {};
    if (row.secrets_enc) {
      try {
        secrets = JSON.parse(decryptSecret(row.secrets_enc));
      } catch (err) {
        console.error(`[integrations] could not decrypt ${row.provider} secrets`, err);
      }
    }
    out[row.provider] = { config: (row.config as Record<string, unknown>) ?? {}, secrets };
  }
  return out;
}

function pick(...values: (string | undefined | null | unknown)[]): string | undefined {
  for (const v of values) if (typeof v === "string" && v.trim() !== "") return v.trim();
  return undefined;
}

export async function getIntegration<K extends IntegrationProvider>(provider: K): Promise<IntegrationValues[K]> {
  const env = serverEnv();
  const stored = (await loadStored())[provider] ?? { config: {}, secrets: {} };
  const c = stored.config;
  const s = stored.secrets;
  const values: IntegrationValues = {
    whop: {
      apiKey: pick(env.WHOP_API_KEY, s.apiKey),
      companyId: pick(env.WHOP_COMPANY_ID, c.companyId),
      webhookSecret: pick(env.WHOP_WEBHOOK_SECRET, s.webhookSecret),
      environment: (pick(process.env.WHOP_ENVIRONMENT, c.environment) as "production" | "sandbox") ?? "production",
    },
    resend: {
      apiKey: pick(env.RESEND_API_KEY, s.apiKey),
      webhookSecret: pick(env.RESEND_WEBHOOK_SECRET, s.webhookSecret),
      fromEmail: pick(env.EMAIL_FROM, c.fromEmail),
    },
    mux: {
      tokenId: pick(env.MUX_TOKEN_ID, c.tokenId),
      tokenSecret: pick(env.MUX_TOKEN_SECRET, s.tokenSecret),
      webhookSecret: pick(env.MUX_WEBHOOK_SECRET, s.webhookSecret),
      signingKeyId: pick(env.MUX_SIGNING_KEY_ID, c.signingKeyId),
      signingPrivateKey: pick(env.MUX_SIGNING_PRIVATE_KEY, s.signingPrivateKey),
    },
    bunny: {
      libraryId: pick(env.BUNNY_STREAM_LIBRARY_ID, c.libraryId),
      apiKey: pick(env.BUNNY_STREAM_API_KEY, s.apiKey),
      tokenKey: pick(env.BUNNY_STREAM_TOKEN_KEY, s.tokenKey),
      cdnHostname: pick(env.BUNNY_STREAM_CDN_HOSTNAME, c.cdnHostname),
      webhookSecret: pick(env.BUNNY_WEBHOOK_SECRET, s.webhookSecret),
    },
    youtube: { enabled: c.enabled !== false },
    zoom: {
      clientId: pick(env.ZOOM_CLIENT_ID, c.clientId),
      clientSecret: pick(env.ZOOM_CLIENT_SECRET, s.clientSecret),
      redirectUri: pick(env.ZOOM_REDIRECT_URI, c.redirectUri),
      webhookSecretToken: pick(env.ZOOM_WEBHOOK_SECRET_TOKEN, s.webhookSecretToken),
    },
    google: {
      clientId: pick(env.GOOGLE_CLIENT_ID, c.clientId),
      clientSecret: pick(env.GOOGLE_CLIENT_SECRET, s.clientSecret),
      redirectUri: pick(env.GOOGLE_REDIRECT_URI, c.redirectUri),
    },
  };
  return values[provider];
}

export async function isIntegrationConfigured(provider: IntegrationProvider): Promise<boolean> {
  const values = (await getIntegration(provider)) as Record<string, unknown>;
  return (REQUIRED_FIELDS[provider] as string[]).every((f) => typeof values[f] === "string" && (values[f] as string).length > 0);
}

/** Thrown when an action needs an integration that has no credentials yet. */
export class IntegrationNotConfiguredError extends Error {
  constructor(public readonly provider: IntegrationProvider) {
    super(`${provider} is not connected. An administrator can add its credentials in Admin → Integrations.`);
    this.name = "IntegrationNotConfiguredError";
  }
}
