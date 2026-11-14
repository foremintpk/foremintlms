"use server";

import { updateTag } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/guards";
import { ok, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { INTEGRATIONS_TAG, type IntegrationProvider } from "@/lib/services/integrations";
import { PROVIDERS, recordTestResult, saveProviderValues } from "@/lib/services/admin/integrations-admin";
import { isWhopReady, testWhopConnection } from "@/lib/services/payments/whop";
import { syncPendingProducts } from "@/lib/services/payments/catalog";
import { testResendConnection } from "@/lib/services/email/resend";
import { testVideoProvider } from "@/lib/services/video";
import { testMeetingProvider } from "@/lib/services/live/providers";

const providerIds = PROVIDERS.map((p) => p.id) as [IntegrationProvider, ...IntegrationProvider[]];

const saveSchema = z.object({
  provider: z.enum(providerIds),
  values: z.record(z.string(), z.string().max(8000)),
  clear: z.array(z.string().max(60)).max(20).default([]),
});

export async function saveIntegration(input: z.input<typeof saveSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = saveSchema.parse(input);
    const whopSecret = data.provider === "whop" ? data.values.webhookSecret?.trim() : undefined;
    if (whopSecret && !whopSecret.startsWith("ws_")) {
      // A delivery ID (whdel_…) or API key here makes every webhook fail its signature check.
      throw new UserFacingError("That isn't a Whop webhook signing secret. In Whop → Developer → Webhooks, open your endpoint and copy the secret that starts with ws_.");
    }
    const { changedKeys } = await saveProviderValues(data.provider, data.values, data.clear, user.id);
    // Names of changed fields only — never values.
    await audit({ actor: user, action: "integration.updated", entityType: "integration", entityId: data.provider, metadata: { changedKeys, cleared: data.clear } });
    updateTag(INTEGRATIONS_TAG);
    if (data.provider === "whop") {
      // Push every product and plan Whop doesn't have yet, so checkout works
      // as soon as payments are connected. Runs after the response is sent.
      after(async () => {
        try {
          if (!(await isWhopReady())) return;
          const result = await syncPendingProducts();
          if (result.failed > 0) console.error("[whop] catalogue sync after connecting:", result.messages.join(" | "));
        } catch (err) {
          console.error("[whop] catalogue sync after connecting failed", err);
        }
      });
    }
    return ok(null, "Integration settings saved");
  });
}

export async function testIntegration(input: { provider: IntegrationProvider }): Promise<ActionResult<{ ok: boolean; message: string }>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const { provider } = z.object({ provider: z.enum(providerIds) }).parse(input);
    let result: { ok: boolean; message: string };
    try {
      switch (provider) {
        case "whop":
          result = await testWhopConnection();
          break;
        case "resend":
          result = await testResendConnection();
          break;
        case "mux":
        case "bunny":
        case "youtube":
          result = await testVideoProvider(provider);
          break;
        case "zoom":
          result = await testMeetingProvider("zoom");
          break;
        case "google":
          result = await testMeetingProvider("google_meet");
          break;
      }
    } catch (err) {
      result = { ok: false, message: err instanceof Error ? err.message : "The connection test failed." };
    }
    await recordTestResult(provider, result);
    await audit({ actor: user, action: "integration.tested", entityType: "integration", entityId: provider, metadata: { ok: result.ok } });
    updateTag(INTEGRATIONS_TAG);
    return ok(result, result.ok ? "Connection works" : undefined);
  });
}
