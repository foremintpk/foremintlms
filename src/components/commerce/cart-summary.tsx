"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CalendarClock, Loader2, ShoppingBag, TicketPercent, X } from "lucide-react";
import { formatMinor } from "@/lib/domain/invoicing";
import type { CartView } from "@/lib/domain/commerce-view";
import { cn } from "@/lib/utils";
import { useCart } from "./cart-provider";
import { CouponForm } from "./coupon-field";

/**
 * The learning-package summary: selected courses with their prices, the
 * access period, subtotal, discount and total — all computed by the server.
 * Used as the sticky sidebar on the selector, inside the mobile drawer and
 * (read-only, `compact`) wherever a short summary is needed.
 */
export function CartSummary({
  className,
  showCheckout = true,
  editable = true,
  title = "Your learning package",
  onNavigate,
}: {
  className?: string;
  showCheckout?: boolean;
  editable?: boolean;
  title?: string;
  onNavigate?: () => void;
}) {
  const { cart, loading, pendingIds, remove, clear } = useCart();
  const [confirmClear, setConfirmClear] = useState(false);
  const count = cart?.lines.length ?? 0;

  return (
    <section aria-labelledby="cart-summary-title" className={cn("rounded-3xl border bg-card p-5 shadow-card sm:p-6", className)} data-testid="cart-summary">
      <div className="flex items-center justify-between gap-3">
        <h2 id="cart-summary-title" className="font-heading text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-brand-soft px-2 text-sm font-semibold text-primary tabular-nums" aria-label={`${count} selected`}>
          {count}
        </span>
      </div>

      {loading && !cart ? (
        <div className="mt-5 grid gap-3" aria-hidden>
          <div className="h-12 animate-pulse rounded-xl bg-muted" />
          <div className="h-12 animate-pulse rounded-xl bg-muted" />
        </div>
      ) : count === 0 && !cart?.unavailable.length ? (
        <div className="mt-5 rounded-2xl border border-dashed bg-muted/40 p-5 text-center">
          <ShoppingBag className="mx-auto size-6 text-muted-foreground" aria-hidden />
          <p className="mt-2 text-sm font-medium">No courses selected yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Add the skills you want to learn — you&apos;ll see the total here.</p>
        </div>
      ) : (
        <>
          <ul className="mt-4 grid gap-2" data-testid="cart-lines">
            {cart!.lines.map((line) => (
              <li key={line.courseId} className="flex items-start gap-3 rounded-xl bg-muted/40 p-2.5" data-testid="cart-line">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={line.title}>
                    {line.title}
                  </p>
                  {line.category ? <p className="truncate text-xs text-muted-foreground">{line.category}</p> : null}
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums" data-testid="cart-line-price">
                    {formatMinor(line.priceMinor, cart!.currency)}
                  </p>
                  {line.compareAtMinor ? <p className="text-xs text-muted-foreground line-through tabular-nums">{formatMinor(line.compareAtMinor, cart!.currency)}</p> : null}
                </div>
                {editable ? (
                  <button
                    type="button"
                    onClick={() => void remove(line.courseId)}
                    disabled={pendingIds.has(line.courseId)}
                    className="-mr-1 grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                    aria-label={`Remove ${line.title}`}
                  >
                    {pendingIds.has(line.courseId) ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
                  </button>
                ) : null}
              </li>
            ))}
            {cart!.unavailable.map((u) => (
              <li key={u.courseId} className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-soft p-2.5 text-sm" data-testid="cart-unavailable">
                <p className="min-w-0 flex-1 text-foreground">{u.message}</p>
                {editable ? (
                  <button type="button" onClick={() => void remove(u.courseId)} className="shrink-0 text-xs font-semibold text-foreground underline underline-offset-2">
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>

          {editable && count > 0 ? <CouponForm className="mt-4" /> : null}

          <CartTotals cart={cart!} className="mt-4" />

          {cart!.blockers.length && count > 0 ? (
            <p className="mt-3 rounded-xl bg-warning-soft px-3 py-2 text-xs text-foreground" role="status">
              {cart!.blockers[0]}
            </p>
          ) : null}

          {showCheckout ? (
            <Link
              href="/checkout"
              onClick={onNavigate}
              aria-disabled={!cart!.canCheckout}
              className={cn(
                "mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-[0.95rem] font-semibold text-primary-foreground shadow-raised transition-colors hover:bg-brand-strong focus-visible:ring-3 focus-visible:ring-ring/50 outline-none",
                !cart!.canCheckout && "pointer-events-none opacity-50",
              )}
              data-testid="proceed-to-checkout"
            >
              Proceed to checkout <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : null}

          {editable ? (
            <div className="mt-3 flex items-center justify-between text-xs">
              <Link href="/courses/select" onClick={onNavigate} className="font-medium text-primary hover:underline">
                Continue browsing
              </Link>
              {confirmClear ? (
                <span className="flex items-center gap-2">
                  <span className="text-muted-foreground">Remove all?</span>
                  <button type="button" className="font-semibold text-destructive" onClick={() => void clear().then(() => setConfirmClear(false))}>
                    Yes, clear
                  </button>
                  <button type="button" className="text-muted-foreground" onClick={() => setConfirmClear(false)}>
                    Keep
                  </button>
                </span>
              ) : (
                <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setConfirmClear(true)}>
                  Clear package
                </button>
              )}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

export function CartTotals({ cart, className }: { cart: CartView; className?: string }) {
  return (
    <dl className={cn("grid gap-2 border-t pt-4 text-sm", className)} data-testid="cart-totals">
      {cart.durationLabel ? (
        <div className="flex items-center justify-between gap-3">
          <dt className="inline-flex items-center gap-1.5 text-muted-foreground">
            <CalendarClock className="size-3.5" aria-hidden /> Access period
          </dt>
          <dd className="font-medium" data-testid="cart-duration">
            {cart.durationLabel === "Lifetime" ? "Lifetime" : `${cart.durationLabel} per course`}
          </dd>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <dt className="text-muted-foreground">Subtotal</dt>
        <dd className="font-medium tabular-nums" data-testid="cart-subtotal">
          {formatMinor(cart.subtotalMinor, cart.currency)}
        </dd>
      </div>
      {cart.coupon?.applied ? (
        <div className="flex items-center justify-between gap-3 text-mint-strong">
          <dt className="inline-flex items-center gap-1.5">
            <TicketPercent className="size-3.5" aria-hidden />
            {cart.coupon.code} <span className="text-xs">({cart.coupon.label})</span>
          </dt>
          <dd className="font-medium tabular-nums" data-testid="cart-discount">
            −{formatMinor(cart.discountMinor, cart.currency)}
          </dd>
        </div>
      ) : null}
      <div className="mt-1 flex items-end justify-between gap-3 border-t pt-3">
        <dt className="font-semibold">Total</dt>
        <dd className="font-heading text-2xl font-semibold tracking-tight tabular-nums" data-testid="cart-total">
          {formatMinor(cart.totalMinor, cart.currency)}
        </dd>
      </div>
      <p className="text-xs text-muted-foreground">Any tax is calculated by our payment provider at checkout.</p>
    </dl>
  );
}
