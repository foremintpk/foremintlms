import { computeTotals, type LineItem } from "@/lib/domain/billing";

/**
 * The data printed on a Foremint-generated receipt or credit note. It is
 * frozen into billing_documents.snapshot when the document is issued so the
 * document never changes after the fact. Pure — unit tested.
 */

export interface ReceiptParty {
  name: string | null;
  email: string | null;
  addressLines: string[];
}

export interface ReceiptSeller {
  brandName: string;
  legalEntityName: string | null;
  addressLines: string[];
  registrationNumber: string | null;
  taxId: string | null;
  supportEmail: string | null;
  footer: string | null;
}

export interface ReceiptLine {
  description: string;
  detail: string | null;
  quantity: number;
  unitAmountCents: number;
}

export interface ReceiptSnapshot {
  version: 1;
  kind: "receipt" | "credit_note";
  number: string;
  issuedAt: string;
  paidAt: string | null;
  currency: string;
  paymentStatus: string;
  seller: ReceiptSeller;
  customer: ReceiptParty;
  productName: string | null;
  planName: string | null;
  billingPeriod: string | null;
  lines: ReceiptLine[];
  subtotalCents: number;
  discountCents: number;
  taxCents: number | null;
  taxBehavior: string | null;
  totalCents: number;
  providerTotalCents: number | null;
  totalsMismatch: boolean;
  refundedCents: number;
  promoCodeId: string | null;
  paymentMethod: string | null;
  whopPaymentId: string;
  whopMembershipId: string | null;
  /** For credit notes: the receipt this note refers to. */
  relatesTo: string | null;
}

export interface WhopLineLike {
  label: string | null;
  product_title: string | null;
  variant_title: string | null;
  quantity: number;
  subtotal: { amount: string } | null;
}

/** Whop receipt line items → printable lines (unit price derived from the line subtotal). */
export function toReceiptLines(
  items: WhopLineLike[] | null | undefined,
  fallback: { description: string; detail: string | null; amountCents: number },
): ReceiptLine[] {
  const lines = (items ?? [])
    .map((item) => {
      const qty = Math.max(1, Math.floor(item.quantity || 1));
      const subtotalCents = item.subtotal ? Math.round(Number(item.subtotal.amount) * 100) : null;
      if (subtotalCents === null || !Number.isFinite(subtotalCents)) return null;
      return {
        description: item.product_title ?? item.label ?? fallback.description,
        detail: item.variant_title ?? null,
        quantity: qty,
        unitAmountCents: Math.round(subtotalCents / qty),
      };
    })
    .filter((l): l is ReceiptLine => l !== null);
  if (lines.length) return lines;
  return [{ description: fallback.description, detail: fallback.detail, quantity: 1, unitAmountCents: fallback.amountCents }];
}

export function addressLines(address: Record<string, string | null> | null | undefined): string[] {
  if (!address) return [];
  const cityLine = [address.city, address.state, address.postal_code].filter(Boolean).join(", ");
  return [address.line1, address.line2, cityLine, address.country].filter((v): v is string => Boolean(v && v.trim()));
}

export function splitAddress(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(/\r?\n|,(?=\s*\S)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function buildReceiptSnapshot(input: {
  kind: "receipt" | "credit_note";
  number: string;
  issuedAt: Date;
  paidAt: string | null;
  currency: string;
  paymentStatus: string;
  seller: ReceiptSeller;
  customer: ReceiptParty;
  productName: string | null;
  planName: string | null;
  billingPeriod: string | null;
  lines: ReceiptLine[];
  discountCents: number;
  taxCents: number | null;
  taxBehavior: string | null;
  providerTotalCents: number | null;
  refundedCents: number;
  promoCodeId: string | null;
  paymentMethod: string | null;
  whopPaymentId: string;
  whopMembershipId: string | null;
  relatesTo?: string | null;
}): ReceiptSnapshot {
  const lineItems: LineItem[] = input.lines.map((l) => ({
    description: l.description,
    quantity: l.quantity,
    unitAmountCents: l.unitAmountCents,
  }));
  // Inclusive tax is already inside the line prices, so it must not be added again.
  const taxForTotals = (input.taxBehavior ?? "").toLowerCase() === "inclusive" ? null : input.taxCents;
  const totals = computeTotals(lineItems, {
    discountCents: input.discountCents,
    taxCents: taxForTotals,
    providerTotalCents: input.kind === "credit_note" ? null : input.providerTotalCents,
  });
  const creditTotal = input.kind === "credit_note" ? input.refundedCents : totals.totalCents;
  return {
    version: 1,
    kind: input.kind,
    number: input.number,
    issuedAt: input.issuedAt.toISOString(),
    paidAt: input.paidAt,
    currency: input.currency,
    paymentStatus: input.paymentStatus,
    seller: input.seller,
    customer: input.customer,
    productName: input.productName,
    planName: input.planName,
    billingPeriod: input.billingPeriod,
    lines: input.lines,
    subtotalCents: totals.subtotalCents,
    discountCents: totals.discountCents,
    taxCents: input.taxCents,
    taxBehavior: input.taxBehavior,
    totalCents: creditTotal,
    providerTotalCents: input.providerTotalCents,
    totalsMismatch: input.kind === "receipt" ? totals.mismatch : false,
    refundedCents: input.refundedCents,
    promoCodeId: input.promoCodeId,
    paymentMethod: input.paymentMethod,
    whopPaymentId: input.whopPaymentId,
    whopMembershipId: input.whopMembershipId,
    relatesTo: input.relatesTo ?? null,
  };
}

export function isReceiptSnapshot(value: unknown): value is ReceiptSnapshot {
  return Boolean(value && typeof value === "object" && (value as { version?: unknown }).version === 1 && "lines" in (value as object));
}
