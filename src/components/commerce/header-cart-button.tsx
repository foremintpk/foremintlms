"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { formatMinor } from "@/lib/domain/invoicing";
import { useOptionalCart } from "./cart-provider";

/** Header badge for the learning package; hidden until something is selected. */
export function HeaderCartButton() {
  const cart = useOptionalCart();
  const count = cart?.cart?.courseIds.length ?? 0;
  if (!cart || count === 0) return null;
  return (
    <Link
      href="/checkout"
      className="relative inline-flex h-10 items-center gap-2 rounded-full border bg-card px-3 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
      aria-label={`Your learning package: ${count} ${count === 1 ? "course" : "courses"}, ${formatMinor(cart.cart!.totalMinor, cart.cart!.currency)}. Go to checkout`}
      data-testid="header-cart"
    >
      <ShoppingBag className="size-4" aria-hidden />
      <span className="tabular-nums max-sm:hidden">{formatMinor(cart.cart!.totalMinor, cart.cart!.currency)}</span>
      <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-primary text-[0.7rem] font-bold text-primary-foreground tabular-nums">{count}</span>
    </Link>
  );
}
