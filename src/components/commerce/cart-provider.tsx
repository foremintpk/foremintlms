"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { CartOp, CartView } from "@/lib/domain/commerce-view";

/**
 * One cart for the whole public site: the course selector, course pages,
 * checkout and the course advisor all read and change it through here. The
 * server owns the cart (cookie-identified) and returns it fully priced after
 * every change, so the browser only ever displays server-computed totals.
 */

type CartResult = { ok: true; cart: CartView; message?: string } | { ok: false; error: string; cart?: CartView };

interface CartContextValue {
  cart: CartView | null;
  loading: boolean;
  /** Course ids with an add/remove in flight (for per-button spinners). */
  pendingIds: ReadonlySet<string>;
  busy: boolean;
  has: (courseId: string) => boolean;
  add: (courseIds: string[], opts?: { silent?: boolean }) => Promise<CartResult>;
  remove: (courseId: string, opts?: { silent?: boolean }) => Promise<CartResult>;
  setDuration: (duration: string) => Promise<CartResult>;
  applyCoupon: (code: string) => Promise<CartResult>;
  removeCoupon: () => Promise<CartResult>;
  setEmail: (email: string) => Promise<CartResult>;
  clear: () => Promise<CartResult>;
  refresh: () => Promise<void>;
  /** Replace the local copy with a cart the server returned elsewhere (checkout, advisor). */
  replace: (cart: CartView) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

async function request(body?: CartOp): Promise<CartResult> {
  try {
    const res = await fetch("/api/commerce/cart", {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      credentials: "same-origin",
    });
    const json = (await res.json().catch(() => null)) as CartResult | { error?: string } | null;
    if (json && "ok" in json) return json;
    return { ok: false, error: (json && "error" in json && json.error) || "Something went wrong. Try again." };
  } catch {
    return { ok: false, error: "We couldn't reach the server. Check your connection and try again." };
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartView | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [busyCount, setBusyCount] = useState(0);
  const latest = useRef(0);

  const apply = useCallback((result: CartResult, seq: number) => {
    if (result.cart && seq >= latest.current) {
      latest.current = seq;
      const next = result.cart;
      // Cart writes don't look up the session; keep the account email from the first load.
      setCart((prev) => (next.accountEmail || !prev?.accountEmail ? next : { ...next, accountEmail: prev.accountEmail }));
    }
  }, []);

  // Operations run one after another, so two quick clicks can't overwrite each other's change.
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const run = useCallback(
    async (body: CartOp, opts: { ids?: string[]; silent?: boolean } = {}) => {
      setBusyCount((n) => n + 1);
      if (opts.ids?.length) setPendingIds((s) => new Set([...s, ...opts.ids!]));
      try {
        const pendingResult = queue.current.then(() => request(body));
        queue.current = pendingResult.catch(() => undefined);
        const result = await pendingResult;
        apply(result, Date.now());
        if (!opts.silent) {
          if (result.ok && result.message) toast.success(result.message);
          if (!result.ok) toast.error(result.error);
        }
        return result;
      } finally {
        setBusyCount((n) => n - 1);
        if (opts.ids?.length) setPendingIds((s) => new Set([...s].filter((id) => !opts.ids!.includes(id))));
      }
    },
    [apply],
  );

  const refresh = useCallback(async () => {
    const seq = Date.now();
    const result = await request();
    apply(result, seq);
    setLoading(false);
  }, [apply]);

  // Load the visitor's cart once on mount (state is set in the async callback).
  useEffect(() => {
    let active = true;
    request().then((result) => {
      if (!active) return;
      apply(result, Date.now());
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [apply]);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      loading,
      pendingIds,
      busy: busyCount > 0,
      has: (id) => Boolean(cart?.courseIds.includes(id)),
      add: (courseIds, opts) => run({ op: "add", courseIds }, { ids: courseIds, silent: opts?.silent }),
      remove: (courseId, opts) => run({ op: "remove", courseId }, { ids: [courseId], silent: opts?.silent }),
      setDuration: (duration) => run({ op: "set_duration", duration }, { silent: true }),
      applyCoupon: (code) => run({ op: "apply_coupon", code }, { silent: true }),
      removeCoupon: () => run({ op: "remove_coupon" }, { silent: true }),
      setEmail: (email) => run({ op: "set_email", email }, { silent: true }),
      clear: () => run({ op: "clear" }),
      refresh,
      replace: (next) => {
        latest.current = Date.now();
        setCart(next);
      },
    }),
    [cart, loading, pendingIds, busyCount, run, refresh],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}

/** For components that may render outside the public site (returns null there). */
export function useOptionalCart(): CartContextValue | null {
  return useContext(CartContext);
}
