/**
 * Shapes the commerce API returns to the browser (course selector, checkout,
 * advisor). They carry display data and server-computed amounts only; the
 * browser never sends prices back — the server recomputes everything.
 */
import type { DurationKey } from "./commerce";

export interface SelectorPrice {
  planId: string;
  priceMinor: number;
  compareAtMinor: number | null;
  promoLabel: string | null;
}

export interface SelectorCourse {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  thumbnailUrl: string | null;
  level: string;
  isFeatured: boolean;
  category: { slug: string; name: string } | null;
  instructors: string[];
  lessonCount: number;
  durationMinutes: number | null;
  prices: Record<DurationKey, SelectorPrice>;
}

export interface SelectorDuration {
  key: DurationKey;
  label: string;
  courseCount: number;
}

export interface SelectorCatalog {
  enabled: boolean;
  currency: string;
  courses: SelectorCourse[];
  durations: SelectorDuration[];
  defaultDuration: DurationKey | null;
  maxCourses: number | null;
  categories: { slug: string; name: string }[];
}

export interface CartLineView {
  courseId: string;
  slug: string;
  title: string;
  category: string | null;
  thumbnailUrl: string | null;
  priceMinor: number;
  compareAtMinor: number | null;
  discountMinor: number;
}

export interface CartUnavailableView {
  courseId: string;
  title: string | null;
  message: string;
}

export interface CartCouponView {
  code: string;
  applied: boolean;
  label: string | null;
  message: string | null;
}

export interface PendingOrderView {
  orderNumber: string;
  statusUrl: string;
  paymentUrl: string | null;
  totalMinor: number;
  currency: string;
  expiresAt: string;
  learnerEmail: string;
}

export interface CartView {
  courseIds: string[];
  lines: CartLineView[];
  unavailable: CartUnavailableView[];
  duration: DurationKey | null;
  durationLabel: string | null;
  durations: { key: DurationKey; label: string; coveredCount: number }[];
  currency: string;
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  coupon: CartCouponView | null;
  maxCourses: number | null;
  email: string | null;
  /** The signed-in account's email, offered as the default learner email. */
  accountEmail: string | null;
  canCheckout: boolean;
  blockers: string[];
  lastOrder: PendingOrderView | null;
}

export type CartOp =
  | { op: "add"; courseIds: string[] }
  | { op: "remove"; courseId: string }
  | { op: "set_duration"; duration: DurationKey }
  | { op: "apply_coupon"; code: string }
  | { op: "remove_coupon" }
  | { op: "set_email"; email: string }
  | { op: "clear" };

export interface CheckoutResult {
  orderNumber: string;
  statusUrl: string;
  paymentUrl: string | null;
  totalMinor: number;
  currency: string;
  expiresAt: string;
  free: boolean;
  reused: boolean;
}

export type CheckoutResponse =
  | { ok: true; order: CheckoutResult; cart: CartView }
  | { ok: false; code: "price_changed" | "blocked" | "invalid_email" | "provider_error" | "rate_limited"; error: string; cart?: CartView };

export function emptyCartView(currency = "usd"): CartView {
  return {
    courseIds: [],
    lines: [],
    unavailable: [],
    duration: null,
    durationLabel: null,
    durations: [],
    currency,
    subtotalMinor: 0,
    discountMinor: 0,
    totalMinor: 0,
    coupon: null,
    maxCourses: null,
    email: null,
    accountEmail: null,
    canCheckout: false,
    blockers: [],
    lastOrder: null,
  };
}
