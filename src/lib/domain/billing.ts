/** Invoice/receipt arithmetic and numbering. Pure functions, integer cents. */

export interface LineItem {
  description: string;
  quantity: number;
  unitAmountCents: number;
}

export interface Totals {
  subtotalCents: number;
  discountCents: number;
  taxCents: number | null;
  totalCents: number;
}

/**
 * Totals for a document. When the provider reports a total, that figure is
 * authoritative; we only compute what the provider did not supply and flag
 * any mismatch instead of silently "fixing" it.
 */
export function computeTotals(
  lines: LineItem[],
  opts: { discountCents?: number; taxCents?: number | null; providerTotalCents?: number | null } = {},
): Totals & { mismatch: boolean } {
  const subtotal = lines.reduce((s, l) => s + Math.round(l.unitAmountCents) * Math.max(0, Math.floor(l.quantity)), 0);
  const discount = Math.min(Math.max(0, Math.round(opts.discountCents ?? 0)), subtotal);
  const tax = opts.taxCents === null || opts.taxCents === undefined ? null : Math.max(0, Math.round(opts.taxCents));
  const computed = subtotal - discount + (tax ?? 0);
  const provider = opts.providerTotalCents;
  const total = provider ?? computed;
  return {
    subtotalCents: subtotal,
    discountCents: discount,
    taxCents: tax,
    totalCents: total,
    mismatch: provider !== null && provider !== undefined && provider !== computed,
  };
}

/** FMA-R-2026-001042 (receipt) / FMA-CN-… (credit note). */
export function documentNumber(kind: "receipt" | "invoice" | "credit_note", sequence: number, issuedAt: Date): string {
  const prefix = kind === "receipt" ? "R" : kind === "invoice" ? "INV" : "CN";
  return `FMA-${prefix}-${issuedAt.getUTCFullYear()}-${String(sequence).padStart(6, "0")}`;
}

export function refundState(totalCents: number, refundedCents: number): "none" | "partial" | "full" {
  if (refundedCents <= 0) return "none";
  return refundedCents >= totalCents ? "full" : "partial";
}
