import "server-only";
import { WhopClient, WhopEnvironment, WhopError } from "@whop/sdk";
import { getIntegration, IntegrationNotConfiguredError } from "@/lib/services/integrations";

/**
 * Whop API access. Credentials come from env vars or Admin → Integrations
 * (encrypted); see src/lib/services/integrations.ts.
 *
 * API facts this module relies on (from @whop/sdk 2.8 type docs and
 * docs.whop.com):
 * - Prices on the API are decimal major units ("10.43" = $10.43); Money
 *   objects carry `amount` as an exact decimal string.
 * - Pricing options are "variants" (IDs prefixed `plan_`); the legacy
 *   `plans.create` endpoint is deprecated.
 * - Checkout configuration metadata is inherited by the payments and
 *   memberships created from that checkout.
 */

export const WHOP_API_VERSION = "2026-11-10-1";

export interface WhopConfig {
  apiKey: string;
  companyId: string;
  webhookSecret: string | undefined;
  environment: "production" | "sandbox";
}

export async function getWhopConfig(): Promise<WhopConfig> {
  const values = await getIntegration("whop");
  if (!values.apiKey || !values.companyId) throw new IntegrationNotConfiguredError("whop");
  return {
    apiKey: values.apiKey,
    companyId: values.companyId,
    webhookSecret: values.webhookSecret,
    environment: values.environment === "sandbox" ? "sandbox" : "production",
  };
}

export async function isWhopReady(): Promise<boolean> {
  const values = await getIntegration("whop");
  return Boolean(values.apiKey && values.companyId);
}

/** A configured Whop client. Throws IntegrationNotConfiguredError when credentials are missing. */
export async function getWhopClient(): Promise<{ client: WhopClient; config: WhopConfig }> {
  const config = await getWhopConfig();
  const client = new WhopClient({
    token: config.apiKey,
    environment: config.environment === "sandbox" ? WhopEnvironment.Sandbox : WhopEnvironment.Production,
    apiVersionDate: WHOP_API_VERSION,
    timeoutInSeconds: 20,
    maxRetries: 2,
  });
  return { client, config };
}

export async function testWhopConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const { client, config } = await getWhopClient();
    const account = await client.accounts.retrieve({ id: config.companyId });
    const name = (account as { title?: string | null; business_name?: string | null }).title ?? config.companyId;
    const missingSecret = config.webhookSecret ? "" : " Add the webhook signing secret so payments can be confirmed.";
    return {
      ok: true,
      message: `Connected to ${name} (${config.environment === "sandbox" ? "sandbox" : "live"}).${missingSecret}`,
    };
  } catch (err) {
    if (err instanceof IntegrationNotConfiguredError) return { ok: false, message: err.message };
    return { ok: false, message: describeWhopError(err) };
  }
}

/** A short, safe description of a Whop API error (no secrets, no raw bodies). */
export function describeWhopError(err: unknown): string {
  if (err instanceof WhopError) {
    const status = err.statusCode;
    if (status === 401) return "Whop rejected the API key. Check it in Admin → Integrations.";
    if (status === 403) return "The Whop API key is missing a required permission (see docs/payments-billing.md).";
    if (status === 404) return "Whop could not find that record.";
    if (status === 409) return "Whop reported a conflict with an existing record.";
    if (status === 422 || status === 400) {
      const body = err.body as { error?: { message?: string }; message?: string } | undefined;
      const detail = body?.error?.message ?? body?.message;
      return detail ? `Whop rejected the request: ${String(detail).slice(0, 240)}` : "Whop rejected the request.";
    }
    if (status === 429) return "Whop is rate limiting requests. Try again in a minute.";
    if (status && status >= 500) return "Whop is having trouble right now. Try again shortly.";
    return `Whop request failed${status ? ` (${status})` : ""}.`;
  }
  if (err instanceof Error && err.name === "WhopTimeoutError") return "Whop did not respond in time.";
  return "Could not reach Whop.";
}

export function isWhopNotFound(err: unknown): boolean {
  return err instanceof WhopError && err.statusCode === 404;
}
