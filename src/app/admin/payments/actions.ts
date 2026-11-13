"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/guards";
import { fail, ok, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { refundPayment } from "@/lib/services/payments/refunds";
import { reconcileWhopPayments, retryWebhookEvent } from "@/lib/services/payments/reconcile";
import { syncMembershipFromWhop, syncPaymentFromWhop } from "@/lib/services/payments/sync";
import { describeWhopError, isWhopReady } from "@/lib/services/payments/whop";
import { IntegrationNotConfiguredError } from "@/lib/services/integrations";

const refundSchema = z.object({
  amountCents: z.number().int().positive().nullable(),
  reason: z.string().trim().min(3, "Explain why — it's recorded in the audit log").max(500),
});

export async function refundPaymentAction(transactionIdArg: string, input: z.input<typeof refundSchema>): Promise<ActionResult<{ status: string }>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const transactionId = z.uuid().parse(transactionIdArg);
    const data = refundSchema.parse(input);
    const result = await refundPayment(actor, transactionId, data);
    revalidatePath("/admin/payments");
    revalidatePath(`/admin/payments/${transactionId}`);
    return ok({ status: result.status }, result.status === "refunded" ? "Payment refunded and access revoked" : "Partial refund issued");
  });
}

export async function resyncPaymentAction(input: { transactionId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const transactionId = z.uuid().parse(input.transactionId);
    const { data } = await createAdminClient().from("payment_transactions").select("whop_payment_id").eq("id", transactionId).single();
    if (!data) throw new UserFacingError("Payment not found.");
    try {
      await syncPaymentFromWhop(data.whop_payment_id as string);
    } catch (err) {
      if (err instanceof IntegrationNotConfiguredError) throw new UserFacingError(err.message);
      throw new UserFacingError(describeWhopError(err));
    }
    await audit({ actor, action: "payment.resync", entityType: "payment_transaction", entityId: transactionId, summary: `Re-synced ${data.whop_payment_id} from Whop` });
    revalidatePath(`/admin/payments/${transactionId}`);
    revalidatePath("/admin/payments");
    return ok(null, "Payment refreshed from Whop");
  });
}

export async function runReconciliationAction(): Promise<ActionResult<{ checked: number; updated: number; mismatches: number }>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    if (!(await isWhopReady())) throw new UserFacingError("Connect Whop in Admin → Integrations first.");
    let summary;
    try {
      summary = await reconcileWhopPayments({ trigger: "manual", actorId: actor.id });
    } catch (err) {
      return fail(`Reconciliation stopped: ${describeWhopError(err)}`);
    }
    await audit({ actor, action: "payments.reconcile", entityType: "payment_reconciliation", summary: `Checked ${summary.checked}, updated ${summary.updated}`, metadata: { ...summary } });
    revalidatePath("/admin/payments/reconciliation");
    revalidatePath("/admin/payments");
    revalidatePath("/admin/subscriptions");
    return ok(summary, `Checked ${summary.checked} records — ${summary.mismatches} difference${summary.mismatches === 1 ? "" : "s"} fixed`);
  });
}

export async function retryWebhookEventAction(input: { eventId: string }): Promise<ActionResult<{ outcome: string }>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const eventId = z.uuid().parse(input.eventId);
    const outcome = await retryWebhookEvent(eventId);
    await audit({ actor, action: "webhook.retry", entityType: "webhook_event", entityId: eventId, summary: `Retried Whop event: ${outcome}` });
    revalidatePath("/admin/payments/webhooks");
    if (outcome === "failed") return fail("The event failed again. Check the error shown on the event.");
    return ok({ outcome }, outcome === "processed" ? "Event processed" : "Event ignored — it needs no action");
  });
}

export async function syncSubscriptionAction(input: { subscriptionId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const subscriptionId = z.uuid().parse(input.subscriptionId);
    const { data } = await createAdminClient().from("subscription_records").select("whop_membership_id").eq("id", subscriptionId).single();
    if (!data) throw new UserFacingError("Subscription not found.");
    try {
      await syncMembershipFromWhop(data.whop_membership_id as string);
    } catch (err) {
      if (err instanceof IntegrationNotConfiguredError) throw new UserFacingError(err.message);
      throw new UserFacingError(describeWhopError(err));
    }
    await audit({ actor, action: "subscription.resync", entityType: "subscription_record", entityId: subscriptionId, summary: `Re-synced ${data.whop_membership_id}` });
    revalidatePath("/admin/subscriptions");
    return ok(null, "Subscription refreshed from Whop");
  });
}
