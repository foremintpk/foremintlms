import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserFacingError } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { formatMoney } from "@/lib/format";
import type { SessionUser } from "@/lib/auth/session";
import { centsToMajor } from "./mapping";
import { describeWhopError, getWhopClient } from "./whop";
import { applyPaymentObject } from "./sync";
import type { PaymentTransactionRow } from "./types";

/**
 * Refund through Whop's refund API. Access is revoked by applying the
 * refunded payment (the same path the refund webhook takes), so the webhook
 * arriving later changes nothing.
 */
export async function refundPayment(
  actor: SessionUser,
  transactionId: string,
  input: { amountCents: number | null; reason: string },
): Promise<{ status: string; refundedCents: number }> {
  const admin = createAdminClient();
  const { data } = await admin.from("payment_transactions").select("*").eq("id", transactionId).maybeSingle();
  const tx = data as PaymentTransactionRow | null;
  if (!tx) throw new UserFacingError("Payment not found.");
  if (tx.status !== "succeeded" && tx.status !== "partially_refunded") {
    throw new UserFacingError("Only paid payments that aren't already fully refunded can be refunded.");
  }
  const refundable = tx.total_cents - tx.refunded_cents;
  if (refundable <= 0) throw new UserFacingError("Nothing is left to refund on this payment.");
  if (input.amountCents !== null) {
    if (input.amountCents <= 0) throw new UserFacingError("Enter a refund amount above zero.");
    if (input.amountCents > refundable) {
      throw new UserFacingError(`You can refund at most ${formatMoney(refundable, tx.currency)}.`);
    }
  }

  const { client } = await getWhopClient();
  let payment;
  try {
    payment = await client.payments.refund(
      {
        id: tx.whop_payment_id,
        partial_amount: input.amountCents !== null && input.amountCents < refundable ? centsToMajor(input.amountCents) : undefined,
        metadata: { foremint_actor_id: actor.id, reason: input.reason.slice(0, 500) },
      },
      { idempotencyKey: `foremint-refund-${tx.id}-${tx.refunded_cents}-${input.amountCents ?? "rest"}` },
    );
  } catch (err) {
    throw new UserFacingError(describeWhopError(err));
  }

  const result = await applyPaymentObject(payment);
  const { data: after } = await admin.from("payment_transactions").select("status, refunded_cents").eq("id", tx.id).single();
  await audit({
    actor,
    action: "payment.refund",
    entityType: "payment_transaction",
    entityId: tx.id,
    summary: `Refunded ${formatMoney(input.amountCents ?? refundable, tx.currency)} on ${tx.whop_payment_id}`,
    metadata: { reason: input.reason, amount_cents: input.amountCents ?? refundable, status_after: result.status },
  });
  return { status: (after?.status as string) ?? result.status, refundedCents: Number(after?.refunded_cents ?? 0) };
}
