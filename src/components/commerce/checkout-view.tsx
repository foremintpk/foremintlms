"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowLeft, Info, Link2, Loader2, Lock, MailCheck, ShoppingBag, UserRound, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MediaImage, ctaClass } from "@/components/site/primitives";
import { formatMinor } from "@/lib/domain/invoicing";
import { learnerEmailSchema } from "@/lib/domain/commerce";
import type { CheckoutResponse, CheckoutResult } from "@/lib/domain/commerce-view";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCart } from "./cart-provider";
import { CouponForm } from "./coupon-field";
import { CartTotals } from "./cart-summary";
import { PaymentLinkActions, copyText } from "./copy-share";

type Mode = "redirect" | "link";

export async function requestCheckout(email: string, expectedTotalMinor: number | null): Promise<CheckoutResponse> {
  try {
    const res = await fetch("/api/commerce/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, expectedTotalMinor }),
      cache: "no-store",
      credentials: "same-origin",
    });
    const json = (await res.json().catch(() => null)) as CheckoutResponse | null;
    return json ?? { ok: false, code: "provider_error", error: "Something went wrong. Try again." };
  } catch {
    return { ok: false, code: "provider_error", error: "We couldn't reach the server. Check your connection and try again." };
  }
}

export function CheckoutView() {
  const { cart, loading, replace, setEmail: saveEmail } = useCart();
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [busy, setBusy] = useState<Mode | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [link, setLink] = useState<(CheckoutResult & { email: string; copied: boolean }) | null>(null);

  // Prefill once: the email saved on the cart, else the signed-in account's.
  const prefill = cart?.email ?? cart?.accountEmail ?? "";
  const [prefilled, setPrefilled] = useState(false);
  if (!prefilled && cart) {
    setPrefilled(true);
    if (!email && prefill) setEmail(prefill);
  }

  const emailCheck = learnerEmailSchema.safeParse(email);
  const emailError = emailTouched && !emailCheck.success ? emailCheck.error.issues[0]?.message : null;

  // A link only belongs to the package it was made for: hide it once the package changes.
  const activeLink = link && cart && cart.totalMinor === link.totalMinor && cart.lines.length > 0 ? link : null;

  async function submit(mode: Mode) {
    setEmailTouched(true);
    setError(null);
    if (!emailCheck.success || !cart) return;
    setBusy(mode);
    const res = await requestCheckout(emailCheck.data, cart.totalMinor);
    if (res.cart) replace(res.cart);
    if (!res.ok) {
      setBusy(null);
      setError({ code: res.code, message: res.error });
      return;
    }
    const { order } = res;
    if (order.free || !order.paymentUrl) {
      window.location.assign(order.statusUrl);
      return;
    }
    if (mode === "redirect") {
      window.location.assign(order.paymentUrl);
      return;
    }
    const copied = await copyText(order.paymentUrl);
    setLink({ ...order, email: emailCheck.data, copied });
    setBusy(null);
  }

  if (loading && !cart) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]" aria-busy>
        <div className="h-80 animate-pulse rounded-3xl bg-muted" />
        <div className="h-96 animate-pulse rounded-3xl bg-muted" />
      </div>
    );
  }

  if (!cart || cart.courseIds.length === 0) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border bg-card p-10 text-center shadow-card" data-testid="checkout-empty">
        <ShoppingBag className="mx-auto size-8 text-muted-foreground" aria-hidden />
        <h2 className="mt-4 font-heading text-xl font-semibold">Your learning package is empty</h2>
        <p className="mt-2 text-muted-foreground">Choose the courses you want first — you&apos;ll come back here to pay.</p>
        <Link href="/courses/select" className={ctaClass("primary", "mt-6")}>
          Build your learning plan
        </Link>
      </div>
    );
  }

  const disabled = busy !== null || !cart.canCheckout;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
      {/* Desktop: details left, summary right. Mobile: the summary comes first, then details and payment. */}
      <div className="order-2 grid gap-6 lg:order-1">
        <section aria-labelledby="student-title" className="rounded-3xl border bg-card p-6 shadow-card sm:p-8">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-primary">
              <UserRound className="size-5" aria-hidden />
            </span>
            <div>
              <h2 id="student-title" className="font-heading text-lg font-semibold tracking-tight">
                Student details
              </h2>
              <p className="text-sm text-muted-foreground">No account needed — we&apos;ll set it up after the payment.</p>
            </div>
          </div>
          <div className="mt-6 grid gap-2">
            <label htmlFor="learner-email" className="text-sm font-semibold">
              Student email address
            </label>
            <Input
              id="learner-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setLink(null);
              }}
              onBlur={() => {
                setEmailTouched(true);
                if (learnerEmailSchema.safeParse(email).success) void saveEmail(email);
              }}
              aria-invalid={Boolean(emailError)}
              aria-describedby="learner-email-help learner-email-error"
              placeholder="name@example.com"
              className="h-12 rounded-xl text-base"
              data-testid="learner-email"
            />
            <p id="learner-email-help" className="text-sm text-muted-foreground">
              Enter the email address that will be used for your Foremint Academy student account.
            </p>
            {emailError ? (
              <p id="learner-email-error" className="text-sm font-medium text-destructive" role="alert">
                {emailError}
              </p>
            ) : null}
            {cart.accountEmail && email.trim().toLowerCase() !== cart.accountEmail.toLowerCase() ? (
              <button type="button" className="justify-self-start text-sm font-medium text-primary hover:underline" onClick={() => setEmail(cart.accountEmail!)}>
                Use my account email ({cart.accountEmail})
              </button>
            ) : null}
          </div>
          <div className="mt-5 flex gap-3 rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <p>
              Paying for someone else, or someone paying for you? Whoever pays can use their own email at checkout — the courses always go to the student email above.
              If that email already has an account, the courses are added to it.
            </p>
          </div>
        </section>

        <section aria-labelledby="payment-title" className="rounded-3xl border bg-card p-6 shadow-card sm:p-8">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-primary">
              <Lock className="size-5" aria-hidden />
            </span>
            <div>
              <h2 id="payment-title" className="font-heading text-lg font-semibold tracking-tight">
                Payment
              </h2>
              <p className="text-sm text-muted-foreground">Processed securely by Whop. You&apos;ll pay {formatMinor(cart.totalMinor, cart.currency)}{" "}plus any tax Whop calculates.</p>
            </div>
          </div>

          {error ? (
            <div className={cn("mt-5 flex gap-3 rounded-2xl border p-4 text-sm", error.code === "price_changed" ? "border-warning/40 bg-warning-soft" : "border-destructive/30 bg-destructive/5")} role="alert" data-testid="checkout-error">
              <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", error.code === "price_changed" ? "text-warning" : "text-destructive")} aria-hidden />
              <p>{error.message}</p>
            </div>
          ) : null}
          {!cart.canCheckout && cart.blockers.length ? (
            <p className="mt-5 rounded-2xl bg-warning-soft p-4 text-sm" role="status">
              {cart.blockers[0]}
            </p>
          ) : null}

          <div className="mt-6 grid gap-3">
            <button
              type="button"
              onClick={() => void submit("redirect")}
              disabled={disabled}
              className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground shadow-raised transition-colors hover:bg-brand-strong focus-visible:ring-3 focus-visible:ring-ring/50 outline-none disabled:opacity-50"
              data-testid="proceed-secure-checkout"
            >
              {busy === "redirect" ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Lock className="size-4" aria-hidden />}
              {busy === "redirect" ? "Preparing secure checkout…" : "Proceed to Secure Checkout"}
            </button>
            <button
              type="button"
              onClick={() => void submit("link")}
              disabled={disabled}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-primary/30 bg-brand-soft/60 px-6 text-[0.95rem] font-semibold text-primary transition-colors hover:border-primary hover:bg-brand-soft focus-visible:ring-3 focus-visible:ring-ring/50 outline-none disabled:opacity-50"
              data-testid="generate-payment-link"
            >
              {busy === "link" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
              {busy === "link" ? "Creating your payment link…" : "Generate & Copy Payment Link"}
            </button>
          </div>

          {activeLink?.paymentUrl ? (
            <div className="mt-6 rounded-2xl border border-mint-strong/30 bg-mint-soft/60 p-5" data-testid="payment-link-panel" role="status">
              <p className="flex items-center gap-2 font-semibold text-foreground">
                <MailCheck className="size-4 text-mint-strong" aria-hidden />
                {activeLink.copied ? "Payment link copied." : "Your payment link is ready."}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                You can share it with your parent, institution or whoever will complete your payment. It&apos;s for order {activeLink.orderNumber}, can be paid
                once and works until {formatDateTime(activeLink.expiresAt)} UTC. We&apos;ve also emailed it to {activeLink.email}.
              </p>
              <PaymentLinkActions url={activeLink.paymentUrl} title={`Foremint Academy order ${activeLink.orderNumber}`} className="mt-4" />
              <Link href={activeLink.statusUrl} className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
                Track this order&apos;s payment status
              </Link>
            </div>
          ) : null}
        </section>
      </div>

      <aside className="order-1 lg:sticky lg:top-24 lg:order-2" aria-label="Order summary">
        <OrderSummaryCard />
      </aside>
    </div>
  );
}

function OrderSummaryCard() {
  const { cart, pendingIds, remove } = useCart();
  if (!cart) return null;
  return (
    <section className="rounded-3xl border bg-card p-5 shadow-card sm:p-6" data-testid="checkout-summary">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold tracking-tight">Order summary</h2>
        <Link href="/courses/select" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          <ArrowLeft className="size-3.5" aria-hidden /> Edit package
        </Link>
      </div>
      <ul className="mt-4 grid gap-3">
        {cart.lines.map((line) => (
          <li key={line.courseId} className="flex items-center gap-3" data-testid="summary-line">
            <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-muted">
              <MediaImage src={line.thumbnailUrl} alt="" sizes="56px" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold" title={line.title}>
                {line.title}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {[line.category, cart.durationLabel ? (cart.durationLabel === "Lifetime" ? "Lifetime access" : `${cart.durationLabel} access`) : null].filter(Boolean).join(" · ")}
              </p>
            </div>
            <p className="text-sm font-semibold tabular-nums">{formatMinor(line.priceMinor, cart.currency)}</p>
            <button
              type="button"
              onClick={() => void remove(line.courseId)}
              disabled={pendingIds.has(line.courseId)}
              aria-label={`Remove ${line.title}`}
              className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              {pendingIds.has(line.courseId) ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
            </button>
          </li>
        ))}
        {cart.unavailable.map((u) => (
          <li key={u.courseId} className="flex items-center gap-3 rounded-xl bg-warning-soft p-3 text-sm">
            <p className="flex-1">{u.message}</p>
            <button type="button" onClick={() => void remove(u.courseId)} className="text-xs font-semibold underline underline-offset-2">
              Remove
            </button>
          </li>
        ))}
      </ul>
      <CouponForm className="mt-5" />
      <CartTotals cart={cart} className="mt-4" />
    </section>
  );
}
