"use client";

import { useState } from "react";
import { Loader2, TicketPercent } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCart } from "./cart-provider";

/**
 * "Have a discount code?" — validated on the server against the coupon rules
 * (dates, limits, eligible courses, minimum spend) and applied to the shared
 * cart, so the discount shows everywhere: selector, checkout and the advisor.
 */
export function CouponForm({ className }: { className?: string }) {
  const { cart, applyCoupon, removeCoupon } = useCart();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  if (!cart) return null;
  const applied = cart.coupon?.applied ? cart.coupon : null;
  const stale = cart.coupon && !cart.coupon.applied ? cart.coupon : null;

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    const res = await applyCoupon(code.trim());
    setBusy(false);
    setFeedback(res.ok ? { ok: true, message: res.message ?? "Discount applied." } : { ok: false, message: res.error });
    if (res.ok) setCode("");
  }

  async function clear() {
    setBusy(true);
    await removeCoupon();
    setBusy(false);
    setFeedback(null);
  }

  if (applied || stale) {
    const c = (applied ?? stale)!;
    return (
      <div className={cn("flex items-center gap-3 rounded-2xl border p-3", applied ? "border-mint-strong/30 bg-mint-soft/50" : "border-warning/40 bg-warning-soft", className)} data-testid="coupon-applied">
        <TicketPercent className={cn("size-4 shrink-0", applied ? "text-mint-strong" : "text-warning")} aria-hidden />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">
            <span className="font-mono">{c.code}</span> {applied ? `· ${applied.label}` : "· not applied"}
          </p>
          {stale?.message ? <p className="text-xs text-muted-foreground">{stale.message}</p> : <p className="text-xs text-muted-foreground">Discount applied to your total.</p>}
        </div>
        <button type="button" onClick={() => void clear()} disabled={busy} className="text-xs font-semibold text-foreground underline underline-offset-2 disabled:opacity-50" data-testid="coupon-remove">
          Remove
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void apply(e)} className={cn("grid gap-2", className)} noValidate>
      <label htmlFor="coupon-code" className="text-sm font-medium">
        Have a discount code?
      </label>
      <div className="flex gap-2">
        <Input
          id="coupon-code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setFeedback(null);
          }}
          placeholder="Enter code"
          autoComplete="off"
          maxLength={40}
          className="h-11 rounded-xl font-mono uppercase"
          aria-invalid={feedback ? !feedback.ok : undefined}
          aria-describedby="coupon-feedback"
          data-testid="coupon-input"
        />
        <button type="submit" disabled={busy || !code.trim()} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border bg-background px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50" data-testid="coupon-apply">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Apply
        </button>
      </div>
      {feedback ? (
        <p id="coupon-feedback" className={cn("text-sm", feedback.ok ? "text-mint-strong" : "text-destructive")} role={feedback.ok ? "status" : "alert"} data-testid="coupon-feedback">
          {feedback.message}
        </p>
      ) : null}
    </form>
  );
}
