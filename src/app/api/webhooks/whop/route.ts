import { NextResponse } from "next/server";
import { receiveWhopWebhook } from "@/lib/services/payments/webhooks";

/**
 * Whop webhook endpoint. Configure in Whop → Developer → Webhooks:
 *   URL:  https://<your-domain>/api/webhooks/whop
 *   Events: see docs/payments-billing.md
 * The signature covers the exact bytes, so the raw body is read as text.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  try {
    const outcome = await receiveWhopWebhook(rawBody, req.headers);
    return NextResponse.json(outcome.body, { status: outcome.status });
  } catch (err) {
    console.error("[whop-webhook] unexpected error", err);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
