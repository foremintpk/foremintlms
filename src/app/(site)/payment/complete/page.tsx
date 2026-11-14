import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, CircleAlert, Clock } from "lucide-react";
import { Container, ctaClass } from "@/components/site/primitives";
import { CheckoutStatusPoller } from "@/components/billing/checkout-status-poller";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { refreshInvoiceStatus } from "@/lib/services/invoicing/invoices";

// Status of one custom-invoice payment; rendered per request.
export const instant = false;

export const metadata: Metadata = {
  title: "Confirming your payment",
  robots: { index: false, follow: false },
};

/**
 * Where Whop sends a client after paying a custom invoice's payment link.
 * The page only reports state: nothing here grants access. The `ref` merely
 * says which invoice to look at; the status always comes from Whop's API
 * through the verified payment path (rate limited), never from the URL.
 */
export default async function PaymentCompletePage({ searchParams }: PageProps<"/payment/complete">) {
  const params = await searchParams;
  const ref = typeof params.ref === "string" && /^[0-9a-f-]{36}$/i.test(params.ref) ? params.ref : null;
  const admin = createAdminClient();
  let invoice = ref
    ? (await admin.from("custom_invoices").select("id, status, invoice_type, customer_user_id").eq("id", ref).maybeSingle()).data
    : null;

  if (invoice && ["awaiting_payment", "past_due", "failed"].includes(invoice.status) && (await checkRateLimit(`invoice-confirm:${invoice.id}`, 1, 8))) {
    try {
      await refreshInvoiceStatus(null, invoice.id);
      invoice = (await admin.from("custom_invoices").select("id, status, invoice_type, customer_user_id").eq("id", invoice.id).maybeSingle()).data;
    } catch (err) {
      console.error("[payment-complete] status check failed", err);
    }
  }

  const paid = invoice && ["paid", "partially_refunded"].includes(invoice.status);
  const held = invoice?.status === "under_review";
  const closed = invoice && ["voided", "cancelled", "expired", "refunded"].includes(invoice.status);

  return (
    <Container className="max-w-2xl py-16 sm:py-24">
      <div className="rounded-3xl border bg-card p-8 shadow-card sm:p-10">
        {!invoice ? (
          <>
            <CircleAlert className="size-9 text-muted-foreground" aria-hidden />
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">We couldn&apos;t find that payment</h1>
            <p className="mt-2 text-muted-foreground">If you completed a payment, you&apos;ll receive a confirmation email with the next steps as soon as it&apos;s confirmed.</p>
          </>
        ) : paid ? (
          <>
            <CheckCircle2 className="size-9 text-success" aria-hidden />
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">Payment confirmed</h1>
            <p className="mt-2 text-muted-foreground">
              Thank you. We&apos;ve emailed the next steps{invoice.invoice_type === "company" ? " to your company contact, including how to invite your team" : ""}. If you
              already have a Foremint Academy account, your courses are ready.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={invoice.invoice_type === "company" ? "/learn/company" : "/learn/courses"} className={ctaClass("primary")}>
                Go to my courses
              </Link>
            </div>
          </>
        ) : held ? (
          <>
            <Clock className="size-9 text-primary" aria-hidden />
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">Payment received</h1>
            <p className="mt-2 text-muted-foreground">Our team is completing a quick check before your access is set up. We&apos;ll email you shortly.</p>
          </>
        ) : closed ? (
          <>
            <CircleAlert className="size-9 text-muted-foreground" aria-hidden />
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">This invoice is closed</h1>
            <p className="mt-2 text-muted-foreground">If you were charged, reply to your invoice email and we&apos;ll sort it out.</p>
          </>
        ) : (
          <>
            <Clock className="size-9 text-primary" aria-hidden />
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">Confirming your payment</h1>
            <p className="mt-2 text-muted-foreground">Thanks! We&apos;re waiting for Whop to confirm the payment — usually a few seconds. You&apos;ll also get an email once it&apos;s confirmed.</p>
            <div className="mt-6">
              <CheckoutStatusPoller />
            </div>
          </>
        )}
      </div>
    </Container>
  );
}
