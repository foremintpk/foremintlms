/**
 * Custom invoicing rules. Pure functions (no I/O) shared by the admin form,
 * server actions, the Whop integration and the webhook fulfilment path, and
 * covered by unit tests.
 *
 * Money is always an integer number of minor units (cents for USD) and is
 * parsed from / rendered to decimal strings without floating-point maths.
 */

const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------
// Currencies
// ---------------------------------------------------------------------------

export interface CurrencyInfo {
  code: string;
  label: string;
  /** Minor-unit digits (2 for USD, 0 for JPY). */
  decimals: number;
}

/**
 * Currencies offered for custom invoices: a subset of the currencies Whop
 * accepts for variant prices (see the `currency` enum on Create Invoice).
 */
export const INVOICE_CURRENCIES: CurrencyInfo[] = [
  { code: "usd", label: "US dollar", decimals: 2 },
  { code: "eur", label: "Euro", decimals: 2 },
  { code: "gbp", label: "British pound", decimals: 2 },
  { code: "cad", label: "Canadian dollar", decimals: 2 },
  { code: "aud", label: "Australian dollar", decimals: 2 },
  { code: "nzd", label: "New Zealand dollar", decimals: 2 },
  { code: "aed", label: "UAE dirham", decimals: 2 },
  { code: "sar", label: "Saudi riyal", decimals: 2 },
  { code: "pkr", label: "Pakistani rupee", decimals: 2 },
  { code: "inr", label: "Indian rupee", decimals: 2 },
  { code: "sgd", label: "Singapore dollar", decimals: 2 },
  { code: "chf", label: "Swiss franc", decimals: 2 },
  { code: "sek", label: "Swedish krona", decimals: 2 },
  { code: "nok", label: "Norwegian krone", decimals: 2 },
  { code: "dkk", label: "Danish krone", decimals: 2 },
  { code: "zar", label: "South African rand", decimals: 2 },
  { code: "jpy", label: "Japanese yen", decimals: 0 },
];

const CURRENCY_BY_CODE = new Map(INVOICE_CURRENCIES.map((c) => [c.code, c]));

export function currencyInfo(code: string): CurrencyInfo {
  const c = CURRENCY_BY_CODE.get(code.toLowerCase());
  if (!c) throw new Error(`Unsupported currency "${code}"`);
  return c;
}

export function isSupportedCurrency(code: string): boolean {
  return CURRENCY_BY_CODE.has(code.toLowerCase());
}

/**
 * The smallest amount accepted for a paid Whop variant. Whop refuses paid
 * prices below 1.00, so two-decimal currencies need 100 minor units; for
 * zero-decimal currencies we apply ¥100 as a conservative floor.
 */
export function minimumAmountMinor(code: string): number {
  currencyInfo(code);
  return 100;
}

/** Largest custom invoice amount we accept (10 million major units). */
export function maximumAmountMinor(code: string): number {
  return 10_000_000 * 10 ** currencyInfo(code).decimals;
}

/**
 * Parse a user-entered amount ("1,250.5", "500", "99.99") into minor units,
 * exactly. Returns null when the text isn't a valid amount for the currency
 * (too many decimals, not a number, negative).
 */
export function parseAmountToMinor(input: string, currency: string): number | null {
  const { decimals } = currencyInfo(currency);
  const cleaned = input.trim().replace(/[\s,_]/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  if (frac.length > decimals) return null;
  const minorText = `${whole}${frac.padEnd(decimals, "0")}`.replace(/^0+(?=\d)/, "");
  if (minorText.length > 15) return null;
  const minor = Number(minorText);
  return Number.isSafeInteger(minor) ? minor : null;
}

/** "500.00" for 50000 USD cents; "1200" for 1200 JPY. Exact. */
export function minorToMajorString(minor: number, currency: string): string {
  if (!Number.isSafeInteger(minor)) throw new Error("Amount must be a whole number of minor units");
  const { decimals } = currencyInfo(currency);
  const negative = minor < 0;
  const digits = String(Math.abs(minor)).padStart(decimals + 1, "0");
  const whole = decimals ? digits.slice(0, -decimals) : digits;
  const frac = decimals ? digits.slice(-decimals) : "";
  return `${negative ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`;
}

/**
 * Decimal string from an API Money object ("100.00") → minor units, exactly.
 * Extra trailing zeros are accepted; non-zero digits beyond the currency's
 * precision are rejected (null) rather than rounded.
 */
export function majorStringToMinor(amount: string | number | null | undefined, currency: string): number | null {
  if (amount === null || amount === undefined) return null;
  const text = typeof amount === "number" ? amount.toFixed(Math.max(currencyInfo(currency).decimals, 2)) : amount.trim();
  const m = /^(-)?(\d+)(?:\.(\d+))?$/.exec(text);
  if (!m) return null;
  const { decimals } = currencyInfo(currency);
  const frac = (m[3] ?? "").replace(/0+$/, "");
  if (frac.length > decimals) return null;
  const minor = Number(`${m[2]}${frac.padEnd(decimals, "0")}`);
  if (!Number.isSafeInteger(minor)) return null;
  return m[1] ? -minor : minor;
}

/** Money as the Whop API expects it on variant prices: a JSON number in major units, produced from the exact decimal string. */
export function minorToApiNumber(minor: number, currency: string): number {
  return Number(minorToMajorString(minor, currency));
}

export function formatMinor(minor: number | null | undefined, currency: string): string {
  const code = currency.toLowerCase();
  const decimals = isSupportedCurrency(code) ? currencyInfo(code).decimals : 2;
  const text = minorToMajorString(minor ?? 0, isSupportedCurrency(code) ? code : "usd");
  // Intl formatting from the exact decimal string (no binary rounding).
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code.toUpperCase(),
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(text as unknown as number);
  } catch {
    return `${text} ${code.toUpperCase()}`;
  }
}

export function sumMinor(values: (number | null | undefined)[]): number {
  return values.reduce<number>((acc, v) => acc + (v ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Access terms
// ---------------------------------------------------------------------------

export type AccessMode = "days" | "lifetime" | "until_date";
export type BillingType = "one_time" | "recurring";
export type CourseSelectionMode = "selected" | "all_published" | "all_including_future";

export const ACCESS_DAY_PRESETS = [30, 60, 90, 180, 365] as const;
export const BILLING_INTERVAL_PRESETS: { days: number; label: string }[] = [
  { days: 30, label: "Monthly" },
  { days: 90, label: "Quarterly" },
  { days: 180, label: "Every 6 months" },
  { days: 365, label: "Annually" },
];

export interface OneTimeTerms {
  accessMode: AccessMode;
  accessDurationDays: number | null;
  accessEndAt: Date | null;
}

/**
 * The access window a one-time invoice buys, counted from the verified
 * payment time (not from when the invoice was created).
 */
export function oneTimeAccessWindow(terms: OneTimeTerms, paidAt: Date): { startsAt: Date; expiresAt: Date | null } {
  switch (terms.accessMode) {
    case "lifetime":
      return { startsAt: paidAt, expiresAt: null };
    case "until_date":
      return { startsAt: paidAt, expiresAt: terms.accessEndAt };
    case "days":
    default:
      return { startsAt: paidAt, expiresAt: new Date(paidAt.getTime() + (terms.accessDurationDays ?? 0) * DAY_MS) };
  }
}

/** End of a fixed-length recurring contract: N billing periods from the first payment. */
export function contractEndsAt(paidAt: Date, intervalDays: number, cycles: number | null): Date | null {
  if (!cycles) return null;
  return new Date(paidAt.getTime() + intervalDays * cycles * DAY_MS);
}

/** What the first payment of an invoice must be, before tax. */
export function expectedFirstPaymentMinor(inv: { billing_type: BillingType; amount_minor: number; upfront_fee_minor: number }): number {
  return inv.billing_type === "recurring" ? inv.amount_minor + inv.upfront_fee_minor : inv.amount_minor;
}

export function billingIntervalLabel(days: number | null | undefined): string {
  if (!days) return "—";
  const preset = BILLING_INTERVAL_PRESETS.find((p) => p.days === days);
  if (preset) return preset.label;
  if (days === 7) return "Weekly";
  if (days === 14) return "Every 2 weeks";
  return `Every ${days} days`;
}

export function intervalNoun(days: number): string {
  if (days === 30) return "month";
  if (days === 90) return "quarter";
  if (days === 365) return "year";
  if (days === 7) return "week";
  return `${days} days`;
}

/** Human summary of the access terms ("180 days from payment", "Lifetime access"). */
export function accessTermsLabel(inv: {
  billing_type: BillingType;
  access_mode: AccessMode | null;
  access_duration_days: number | null;
  access_end_at: string | Date | null;
  billing_interval_days: number | null;
  billing_cycles: number | null;
}): string {
  if (inv.billing_type === "recurring") {
    const base = `${billingIntervalLabel(inv.billing_interval_days)} subscription`;
    if (inv.billing_cycles && inv.billing_interval_days) {
      return `${base} · ${inv.billing_cycles} payments (${inv.billing_cycles * inv.billing_interval_days} days)`;
    }
    return `${base} · access while the subscription is active`;
  }
  if (inv.access_mode === "lifetime") return "Lifetime access";
  if (inv.access_mode === "until_date" && inv.access_end_at) {
    const d = typeof inv.access_end_at === "string" ? new Date(inv.access_end_at) : inv.access_end_at;
    return `Access until ${d.toISOString().slice(0, 10)}`;
  }
  return `${inv.access_duration_days ?? 0} days from payment`;
}

/** Remaining whole days (rounded up) before `expiresAt`; 0 when ended; null when unlimited. */
export function remainingDays(expiresAt: Date | string | null, now: Date = new Date()): number | null {
  if (!expiresAt) return null;
  const end = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY_MS));
}

// ---------------------------------------------------------------------------
// Manual extensions
// ---------------------------------------------------------------------------

export type ExtensionMode = "add_from_expiry" | "add_from_today" | "set_date";

export function computeExtendedExpiry(
  input: { mode: ExtensionMode; days?: number | null; date?: Date | null },
  currentExpiry: Date | null,
  now: Date = new Date(),
): Date {
  switch (input.mode) {
    case "set_date":
      if (!input.date) throw new Error("A new end date is required");
      return input.date;
    case "add_from_today":
      return new Date(now.getTime() + (input.days ?? 0) * DAY_MS);
    case "add_from_expiry":
    default: {
      // Extending an already-ended package counts from today, never from the past.
      const base = currentExpiry && currentExpiry.getTime() > now.getTime() ? currentExpiry : now;
      return new Date(base.getTime() + (input.days ?? 0) * DAY_MS);
    }
  }
}

// ---------------------------------------------------------------------------
// Statuses
// ---------------------------------------------------------------------------

export type InvoiceStatus =
  | "draft"
  | "pending_generation"
  | "awaiting_payment"
  | "paid"
  | "past_due"
  | "failed"
  | "expired"
  | "cancelled"
  | "voided"
  | "refunded"
  | "partially_refunded"
  | "under_review";

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft",
  pending_generation: "Pending generation",
  awaiting_payment: "Awaiting payment",
  paid: "Paid",
  past_due: "Past due",
  failed: "Payment failed",
  expired: "Expired",
  cancelled: "Cancelled",
  voided: "Voided",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
  under_review: "Under review",
};

/** Statuses in which the payment link is live and a payment is expected. */
export const PAYABLE_STATUSES: InvoiceStatus[] = ["awaiting_payment", "past_due", "failed"];
/** Statuses that must never turn into access automatically. */
export const CLOSED_UNPAID_STATUSES: InvoiceStatus[] = ["voided", "cancelled", "expired"];

export function isPayable(status: InvoiceStatus): boolean {
  return PAYABLE_STATUSES.includes(status);
}

export function canVoid(status: InvoiceStatus): boolean {
  return status === "draft" || status === "pending_generation" || PAYABLE_STATUSES.includes(status);
}

/**
 * Local status for an unpaid invoice from Whop's invoice state. Paid,
 * refunded and disputed outcomes come from the verified payment instead, so
 * this never moves an invoice to "paid".
 */
export function localStatusFromProvider(
  provider: { status: string | null; overdue?: boolean | null },
  current: InvoiceStatus,
): InvoiceStatus {
  if (!isPayable(current) && current !== "pending_generation" && current !== "draft") return current;
  switch ((provider.status ?? "").toLowerCase()) {
    case "open":
    case "pending":
    case "authorized":
      return provider.overdue ? "past_due" : current === "failed" ? "failed" : "awaiting_payment";
    case "void":
      return "voided";
    case "uncollectible":
      return "cancelled";
    case "draft":
      return current === "draft" ? "draft" : "pending_generation";
    default:
      return current;
  }
}

// ---------------------------------------------------------------------------
// Payment verification
// ---------------------------------------------------------------------------

export interface PaymentFacts {
  accountId: string | null;
  currency: string;
  /** Pre-tax amount in minor units, or null when Whop didn't report one. */
  subtotalMinor: number | null;
  totalMinor: number | null;
  taxMinor: number | null;
}

export type PaymentCheck = { ok: true } | { ok: false; reason: string };

/**
 * A succeeded payment only fulfils an invoice when it is for the right Whop
 * account, currency and amount, and the invoice is still collectable.
 */
export function verifyInvoicePayment(
  inv: { status: InvoiceStatus; currency: string; billing_type: BillingType; amount_minor: number; upfront_fee_minor: number },
  payment: PaymentFacts,
  expectedAccountId: string,
): PaymentCheck {
  if (payment.accountId && payment.accountId !== expectedAccountId) {
    return { ok: false, reason: `Payment belongs to Whop account ${payment.accountId}, not ${expectedAccountId}.` };
  }
  if (payment.currency.toLowerCase() !== inv.currency.toLowerCase()) {
    return { ok: false, reason: `Paid in ${payment.currency.toUpperCase()}, invoice is in ${inv.currency.toUpperCase()}.` };
  }
  const expected = expectedFirstPaymentMinor(inv);
  const preTax =
    payment.subtotalMinor ??
    (payment.totalMinor !== null ? payment.totalMinor - (payment.taxMinor ?? 0) : null);
  if (preTax === null) return { ok: false, reason: "Whop did not report the paid amount." };
  if (preTax !== expected) {
    return { ok: false, reason: `Paid ${minorToMajorString(preTax, inv.currency)} before tax, expected ${minorToMajorString(expected, inv.currency)}.` };
  }
  if (CLOSED_UNPAID_STATUSES.includes(inv.status)) {
    return { ok: false, reason: `The invoice was already ${INVOICE_STATUS_LABEL[inv.status].toLowerCase()} when the payment arrived.` };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Refunds and disputes
// ---------------------------------------------------------------------------

export type RefundPolicy = "revoke" | "suspend" | "keep";

export function accessAfterRefund(
  full: boolean,
  policies: { full: RefundPolicy; partial: RefundPolicy },
): "revoked" | "suspended" | "active" {
  const policy = full ? policies.full : policies.partial;
  return policy === "revoke" ? "revoked" : policy === "suspend" ? "suspended" : "active";
}

// ---------------------------------------------------------------------------
// Whop hosted checkout
// ---------------------------------------------------------------------------

/**
 * The hosted checkout URL for an open invoice, built from the signed
 * `checkout_link` Whop returns ("pay_xxx.<signature>"), exactly as Whop's
 * invoices guide documents: split at the first ".", then
 * https://whop.com/checkout/{pay_id}/?token={signature}. Returns null when the
 * link is missing or doesn't belong to this invoice.
 */
export function hostedCheckoutUrl(checkoutLink: string | null | undefined, invoiceId: string, environment: "production" | "sandbox"): string | null {
  if (!checkoutLink) return null;
  const dot = checkoutLink.indexOf(".");
  if (dot <= 0) return null;
  const id = checkoutLink.slice(0, dot);
  const token = checkoutLink.slice(dot + 1);
  if (id !== invoiceId || !token) return null;
  const host = environment === "sandbox" ? "https://sandbox.whop.com" : "https://whop.com";
  return `${host}/checkout/${encodeURIComponent(id)}/?token=${encodeURIComponent(token)}`;
}

// ---------------------------------------------------------------------------
// Course snapshot
// ---------------------------------------------------------------------------

export interface CourseSnapshotItem {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  status: string;
}

export function courseListText(snapshot: CourseSnapshotItem[], includesFuture: boolean, max = 12): string {
  const titles = snapshot.map((c) => c.title);
  const shown = titles.slice(0, max);
  const rest = titles.length - shown.length;
  const list = shown.join(", ") + (rest > 0 ? ` and ${rest} more` : "");
  if (includesFuture) return list ? `${list}, plus every course published while access lasts` : "every published course, including new ones";
  return list;
}
