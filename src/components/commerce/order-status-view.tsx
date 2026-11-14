import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleAlert, Clock, CreditCard, FileDown, MailCheck, ShieldAlert, Undo2, XCircle } from "lucide-react";
import { Container, ctaClass } from "@/components/site/primitives";
import { CheckoutStatusPoller } from "@/components/billing/checkout-status-poller";
import { getSessionUser } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { formatMinor } from "@/lib/domain/invoicing";
import { durationAccessLabel, durationKeyFromDays, isOrderPayable, maskEmail, orderAccessSummary } from "@/lib/domain/commerce";
import { formatDateTime } from "@/lib/format";
import { refreshOrderFromWhop } from "@/lib/services/commerce/orders";
import { loadOrderByToken, loadOrderItems, type OrderRow } from "@/lib/services/commerce/store";
import { cn } from "@/lib/utils";
import { PaymentLinkActions } from "./copy-share";
import { ResendActivationButton, RetryLinkButton } from "./order-status-actions";

type View =
  | "fulfilled"
  | "awaiting_activation"
  | "provisioning"
  | "confirming"
  | "awaiting_payment"
  | "failed"
  | "expired"
  | "cancelled"
  | "refunded"
  | "review"
  | "link_failed";

function viewFor(order: OrderRow, returnedFromCheckout: boolean, now: Date): View {
  switch (order.status) {
    case "fulfilled":
      return "fulfilled";
    case "paid":
      return order.fulfillment_status === "awaiting_activation" ? "awaiting_activation" : "provisioning";
    case "fulfillment_pending":
      return "provisioning";
    case "payment_processing":
      return "confirming";
    case "failed":
      return isOrderPayable(order, now) ? "failed" : "expired";
    case "expired":
      return "expired";
    case "cancelled":
      return "cancelled";
    case "refunded":
    case "partially_refunded":
      return order.status === "refunded" ? "refunded" : order.fulfillment_status === "awaiting_activation" ? "awaiting_activation" : "fulfilled";
    case "under_review":
      return "review";
    case "draft":
      return "link_failed";
    case "pending_payment":
    default:
      if (!isOrderPayable(order, now)) return "expired";
      return returnedFromCheckout ? "confirming" : "awaiting_payment";
  }
}

const COPY: Record<View, { icon: typeof CheckCircle2; tone: string; title: string }> = {
  fulfilled: { icon: CheckCircle2, tone: "text-success", title: "Payment confirmed — your courses are ready" },
  awaiting_activation: { icon: MailCheck, tone: "text-success", title: "Payment confirmed" },
  provisioning: { icon: Clock, tone: "text-primary", title: "Payment confirmed — setting up access" },
  confirming: { icon: Clock, tone: "text-primary", title: "Your payment is being confirmed" },
  awaiting_payment: { icon: CreditCard, tone: "text-primary", title: "Waiting for payment" },
  failed: { icon: CircleAlert, tone: "text-destructive", title: "The payment didn't go through" },
  expired: { icon: XCircle, tone: "text-muted-foreground", title: "This payment link has expired" },
  cancelled: { icon: XCircle, tone: "text-muted-foreground", title: "This order was cancelled" },
  refunded: { icon: Undo2, tone: "text-muted-foreground", title: "This order was refunded" },
  review: { icon: ShieldAlert, tone: "text-warning", title: "We're checking this payment" },
  link_failed: { icon: AlertTriangle, tone: "text-warning", title: "We couldn't create the payment link" },
};

/**
 * Order status for guests, authorised by the unguessable token in the URL.
 * Only verified server state is shown: the Whop return parameter is a hint
 * that a payment may be on its way, never proof — access is reported active
 * only once fulfilment has actually created it.
 */
export async function OrderStatusView({ token, providerStatus, returnedFromCheckout }: { token: string; providerStatus?: string | null; returnedFromCheckout: boolean }) {
  let order = await loadOrderByToken(token);
  if (!order) {
    return (
      <Container className="max-w-2xl py-16 sm:py-24">
        <div className="rounded-3xl border bg-card p-8 shadow-card sm:p-10" data-testid="order-status" data-state="invalid">
          <CircleAlert className="size-9 text-muted-foreground" aria-hidden />
          <h1 className="mt-5 font-heading text-2xl font-semibold tracking-tight">We couldn&apos;t find that order</h1>
          <p className="mt-2 text-muted-foreground">Check that you opened the full link. If you paid, the student will receive an email as soon as the payment is confirmed.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/courses/select" className={ctaClass("primary")}>
              Build your learning plan
            </Link>
            <Link href="/contact" className={ctaClass("secondary")}>
              Contact support
            </Link>
          </div>
        </div>
      </Container>
    );
  }

  // Waiting on Whop: ask it directly (rate-limited per order) instead of relying on the webhook alone.
  const waiting = ["pending_payment", "payment_processing", "failed"].includes(order.status) && order.whop_plan_id;
  if (waiting && (returnedFromCheckout || order.status === "payment_processing") && (await checkRateLimit(`order-confirm:${order.id}`, 1, 8))) {
    try {
      order = await refreshOrderFromWhop(order);
    } catch (err) {
      console.error("[orders] direct confirmation failed", err);
    }
  }

  const now = new Date();
  const items = await loadOrderItems(order.id);
  const view = viewFor(order, returnedFromCheckout && providerStatus !== "failed" && providerStatus !== "canceled", now);
  const copy = COPY[view];
  const Icon = copy.icon;
  const viewer = await getSessionUser().catch(() => null);
  const viewerIsLearner = Boolean(viewer && viewer.email.toLowerCase() === order.learner_email.toLowerCase());
  const paidAt = order.paid_at ? new Date(order.paid_at) : null;
  const providerFailed = providerStatus === "failed" || providerStatus === "canceled";

  return (
    <Container className="max-w-3xl py-12 sm:py-20">
      <div className="rounded-3xl border bg-card p-6 shadow-card sm:p-10" data-testid="order-status" data-state={view}>
        <Icon className={cn("size-9", copy.tone)} aria-hidden />
        <h1 className="mt-5 font-heading text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{copy.title}</h1>

        <div className="mt-3 text-muted-foreground">
          {view === "fulfilled" ? (
            <p>The courses below are active on the student account {viewerIsLearner ? order.learner_email : maskEmail(order.learner_email)}. A confirmation email is on its way.</p>
          ) : view === "awaiting_activation" ? (
            <p>
              We&apos;ve emailed a secure activation link to <strong className="text-foreground">{maskEmail(order.learner_email)}</strong>. Open it to create a password —
              the courses are waiting in the account. We never send passwords by email.
            </p>
          ) : view === "provisioning" ? (
            <p>The payment is confirmed and we&apos;re adding the courses to the student account. This usually takes a few seconds.</p>
          ) : view === "confirming" ? (
            <p>Your payment is being confirmed. We will activate your course access once the payment provider verifies it.</p>
          ) : view === "awaiting_payment" ? (
            <p>
              This order hasn&apos;t been paid yet{providerFailed ? " — the last attempt was cancelled or declined" : ""}. Pay now, or share the link with whoever is paying. It
              works until {formatDateTime(order.expires_at)} UTC.
            </p>
          ) : view === "failed" ? (
            <p>No access was granted and nothing was charged for this attempt. You can try again with the same link{order.status_reason ? ` (the provider said: ${order.status_reason})` : ""}.</p>
          ) : view === "expired" ? (
            <p>Nothing was charged. Payment links stay valid for a limited time — start a new checkout to get a fresh link with today&apos;s prices.</p>
          ) : view === "cancelled" ? (
            <p>Nothing was charged and the payment link no longer works.</p>
          ) : view === "refunded" ? (
            <p>The payment was refunded and the course access it paid for has ended.</p>
          ) : view === "review" ? (
            <p>Something about this payment needs a quick manual check, so access isn&apos;t active yet. We&apos;ll email the student as soon as it&apos;s resolved — usually within one business day.</p>
          ) : (
            <p>Our payment provider didn&apos;t respond in time. Nothing was charged. Try again in a moment.</p>
          )}
        </div>

        {view === "confirming" || view === "provisioning" ? (
          <div className="mt-5">
            <CheckoutStatusPoller />
          </div>
        ) : null}

        {(view === "awaiting_payment" || view === "failed") && order.whop_checkout_url ? (
          <div className="mt-6">
            <PaymentLinkActions url={order.whop_checkout_url} title={`Foremint Academy order ${order.order_number}`} />
          </div>
        ) : null}

        <dl className="mt-8 grid gap-x-6 gap-y-4 rounded-2xl bg-muted/50 p-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Order</dt>
            <dd className="mt-0.5 font-mono font-medium" data-testid="order-number">
              {order.order_number}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Student email</dt>
            <dd className="mt-0.5 font-medium">{viewerIsLearner ? order.learner_email : maskEmail(order.learner_email)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{paidAt ? "Amount paid" : "Amount due"}</dt>
            <dd className="mt-0.5 font-medium tabular-nums" data-testid="order-amount">
              {formatMinor(paidAt && order.paid_amount_minor !== null ? order.paid_amount_minor : order.total_minor, order.currency)}
              {order.discount_minor > 0 ? <span className="ml-2 text-xs text-muted-foreground">incl. {formatMinor(order.discount_minor, order.currency)} discount</span> : null}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Access period</dt>
            <dd className="mt-0.5 font-medium">{paidAt ? orderAccessSummary(order.duration_days, paidAt) : `${durationAccessLabel(durationKeyFromDays(order.duration_days))} per course, from payment`}</dd>
          </div>
        </dl>

        <div className="mt-6">
          <p className="text-sm font-semibold">
            {items.length} {items.length === 1 ? "course" : "courses"}
          </p>
          <ul className="mt-2 divide-y rounded-2xl border">
            {items.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{i.course_title_snapshot}</span>
                  {i.category_snapshot ? <span className="block truncate text-xs text-muted-foreground">{i.category_snapshot}</span> : null}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{formatMinor(i.course_price_minor, i.currency)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          {view === "fulfilled" ? (
            <Link href={viewerIsLearner ? "/learn/courses" : `/login?next=${encodeURIComponent("/learn/courses")}`} className={ctaClass("primary")}>
              {viewerIsLearner ? "Go to my courses" : "Sign in to start learning"}
            </Link>
          ) : null}
          <a
            href={`/api/commerce/orders/${encodeURIComponent(token)}/invoice?download=1`}
            className={ctaClass("secondary")}
            data-testid="download-invoice"
          >
            <FileDown className="size-4" aria-hidden />
            {["fulfilled", "awaiting_activation", "provisioning"].includes(view) ? "Download paid invoice" : "Download invoice"}
          </a>
          {view === "awaiting_activation" ? <ResendActivationButton token={token} /> : null}
          {view === "link_failed" ? <RetryLinkButton token={token} /> : null}
          {view === "expired" || view === "cancelled" || view === "refunded" ? (
            <Link href="/courses/select" className={ctaClass("primary")}>
              Start a new checkout
            </Link>
          ) : null}
          <Link href="/contact" className={ctaClass("secondary")}>
            Contact support
          </Link>
        </div>
      </div>
    </Container>
  );
}
