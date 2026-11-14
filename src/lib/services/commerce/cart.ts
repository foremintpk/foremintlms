import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomToken, sha256 } from "@/lib/security/crypto";
import { durationKeySchema, isOrderPayable, type DurationKey } from "@/lib/domain/commerce";
import { emptyCartView, type CartView, type PendingOrderView } from "@/lib/domain/commerce-view";
import type { Tables } from "@/types/database";
import { quoteBasket, type Quote } from "./pricing";
import { getSelectorSettings } from "./settings";
import { orderStatusPath } from "./tokens";

/**
 * Anonymous carts shared by the course selector, checkout and the advisor.
 * The browser holds a random 32-byte token in an httpOnly, SameSite=Lax
 * cookie; the database stores only its SHA-256. A cart holds course ids, the
 * chosen access period, a coupon code and the learner email — never prices.
 */

export type CartRow = Tables<"public_carts">;

export const CART_COOKIE = "fm_cart";
const CART_TTL_DAYS = 30;

async function cookieToken(): Promise<string | null> {
  const value = (await cookies()).get(CART_COOKIE)?.value ?? null;
  return value && /^[A-Za-z0-9_-]{40,64}$/.test(value) ? value : null;
}

export async function loadCart(): Promise<CartRow | null> {
  const token = await cookieToken();
  if (!token) return null;
  const { data } = await createAdminClient().from("public_carts").select("*").eq("token_hash", sha256(token)).gt("expires_at", new Date().toISOString()).maybeSingle();
  return (data as CartRow | null) ?? null;
}

/** The visitor's cart, created (and its cookie set) on first write. Route handlers and server functions only. */
export async function getOrCreateCart(): Promise<CartRow> {
  const existing = await loadCart();
  if (existing) return existing;
  const token = randomToken(32);
  const { data, error } = await createAdminClient()
    .from("public_carts")
    .insert({ token_hash: sha256(token), expires_at: new Date(Date.now() + CART_TTL_DAYS * 86_400_000).toISOString() })
    .select("*")
    .single();
  if (error || !data) throw new Error(`cart insert failed: ${error?.message}`);
  (await cookies()).set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CART_TTL_DAYS * 86_400,
  });
  return data as CartRow;
}

export async function saveCart(cart: CartRow, patch: Partial<Pick<CartRow, "course_ids" | "access_duration" | "coupon_code" | "learner_email" | "last_order_id">>): Promise<CartRow> {
  const { data, error } = await createAdminClient()
    .from("public_carts")
    .update({ ...patch, expires_at: new Date(Date.now() + CART_TTL_DAYS * 86_400_000).toISOString() })
    .eq("id", cart.id)
    .select("*")
    .single();
  if (error || !data) throw new Error(`cart update failed: ${error?.message}`);
  return data as CartRow;
}

export async function addCoursesToCart(cart: CartRow, courseIds: string[]): Promise<{ cart: CartRow; added: string[]; rejected: string | null }> {
  const settings = await getSelectorSettings();
  const current = cart.course_ids ?? [];
  const fresh = [...new Set(courseIds)].filter((id) => !current.includes(id));
  const limit = settings.max_courses > 0 ? settings.max_courses : 100;
  const room = Math.max(0, limit - current.length);
  const added = fresh.slice(0, room);
  const rejected = fresh.length > added.length ? `You can choose up to ${limit} courses per order.` : null;
  if (!added.length) return { cart, added, rejected };
  return { cart: await saveCart(cart, { course_ids: [...current, ...added] }), added, rejected };
}

export async function removeCourseFromCart(cart: CartRow, courseId: string): Promise<CartRow> {
  return saveCart(cart, { course_ids: (cart.course_ids ?? []).filter((id) => id !== courseId) });
}

export async function setCartDuration(cart: CartRow, duration: DurationKey): Promise<CartRow> {
  return saveCart(cart, { access_duration: durationKeySchema.parse(duration) });
}

async function lastOrderView(cart: CartRow | null): Promise<PendingOrderView | null> {
  if (!cart?.last_order_id) return null;
  const { data } = await createAdminClient()
    .from("public_course_orders")
    .select("id, order_number, status, expires_at, whop_checkout_url, total_minor, currency, learner_email")
    .eq("id", cart.last_order_id)
    .maybeSingle();
  if (!data || !isOrderPayable(data)) return null;
  return {
    orderNumber: data.order_number,
    statusUrl: orderStatusPath(data.id),
    paymentUrl: data.whop_checkout_url,
    totalMinor: data.total_minor,
    currency: data.currency,
    expiresAt: data.expires_at,
    learnerEmail: data.learner_email,
  };
}

export function quoteToView(quote: Quote, extra: { email: string | null; accountEmail: string | null; lastOrder: PendingOrderView | null; courseIds: string[] }): CartView {
  const coupon = quote.couponCode
    ? {
        code: quote.couponCode,
        applied: Boolean(quote.coupon?.evaluation.ok),
        label: quote.coupon?.evaluation.ok ? quote.coupon.evaluation.label : null,
        message: quote.coupon && !quote.coupon.evaluation.ok ? quote.coupon.evaluation.message : null,
      }
    : null;
  return {
    courseIds: extra.courseIds,
    lines: quote.lines.map((l) => ({
      courseId: l.courseId,
      slug: l.slug,
      title: l.title,
      category: l.category,
      thumbnailUrl: l.thumbnailUrl,
      priceMinor: l.priceMinor,
      compareAtMinor: l.compareAtMinor,
      discountMinor: l.discountMinor,
    })),
    unavailable: quote.unavailable,
    duration: quote.duration,
    durationLabel: quote.duration ? quote.durations.find((d) => d.key === quote.duration)?.label ?? null : null,
    durations: quote.durations,
    currency: quote.currency,
    subtotalMinor: quote.subtotalMinor,
    discountMinor: quote.discountMinor,
    totalMinor: quote.totalMinor,
    coupon,
    maxCourses: quote.maxCourses,
    email: extra.email,
    accountEmail: extra.accountEmail,
    canCheckout: quote.blockers.length === 0,
    blockers: quote.blockers,
    lastOrder: extra.lastOrder,
  };
}

export async function quoteCart(cart: CartRow | null, opts: { emailOverride?: string | null } = {}): Promise<Quote> {
  return quoteBasket({
    courseIds: cart?.course_ids ?? [],
    duration: cart?.access_duration ?? null,
    couponCode: cart?.coupon_code ?? null,
    email: opts.emailOverride ?? cart?.learner_email ?? null,
  });
}

export async function cartView(cart: CartRow | null, opts: { accountEmail?: string | null } = {}): Promise<CartView> {
  if (!cart || (cart.course_ids.length === 0 && !cart.coupon_code)) {
    const settings = await getSelectorSettings();
    const [quote, lastOrder] = await Promise.all([quoteBasket({ courseIds: [], duration: cart?.access_duration ?? null, couponCode: null }), lastOrderView(cart)]);
    return {
      ...emptyCartView(settings.currency),
      duration: quote.duration,
      durationLabel: quote.duration ? quote.durations.find((d) => d.key === quote.duration)?.label ?? null : null,
      durations: quote.durations,
      maxCourses: quote.maxCourses,
      email: cart?.learner_email ?? null,
      accountEmail: opts.accountEmail ?? null,
      lastOrder,
    };
  }
  const [quote, lastOrder] = await Promise.all([quoteCart(cart), lastOrderView(cart)]);
  return quoteToView(quote, { email: cart.learner_email, accountEmail: opts.accountEmail ?? null, lastOrder, courseIds: cart.course_ids });
}
