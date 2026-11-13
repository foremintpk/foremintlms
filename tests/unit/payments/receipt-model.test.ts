import { describe, expect, it } from "vitest";
import { addressLines, buildReceiptSnapshot, splitAddress, toReceiptLines } from "@/lib/services/billing/receipt-model";

const seller = {
  brandName: "Foremint Academy",
  legalEntityName: null,
  addressLines: [],
  registrationNumber: null,
  taxId: null,
  supportEmail: "support@example.com",
  footer: null,
};

const base = {
  kind: "receipt" as const,
  number: "FMA-R-2026-001001",
  issuedAt: new Date("2026-11-14T10:00:00Z"),
  paidAt: "2026-11-14T10:00:00Z",
  currency: "usd",
  paymentStatus: "paid",
  seller,
  customer: { name: "Ada Learner", email: "ada@example.com", addressLines: [] },
  productName: "Shopify Store Launch",
  planName: "Lifetime access",
  billingPeriod: null,
  discountCents: 0,
  taxCents: null,
  taxBehavior: null,
  providerTotalCents: 4900,
  refundedCents: 0,
  promoCodeId: null,
  paymentMethod: "visa •••• 4242",
  whopPaymentId: "pay_123",
  whopMembershipId: null,
};

describe("receipt lines", () => {
  it("uses Whop line items and derives the unit price", () => {
    const lines = toReceiptLines(
      [{ label: null, product_title: "Bundle", variant_title: "Yearly", quantity: 2, subtotal: { amount: "50.00" } }],
      { description: "fallback", detail: null, amountCents: 0 },
    );
    expect(lines).toEqual([{ description: "Bundle", detail: "Yearly", quantity: 2, unitAmountCents: 2500 }]);
  });
  it("falls back to a single line when Whop sends none", () => {
    expect(toReceiptLines([], { description: "Course", detail: "Plan", amountCents: 4900 })).toEqual([
      { description: "Course", detail: "Plan", quantity: 1, unitAmountCents: 4900 },
    ]);
  });
});

describe("receipt totals", () => {
  it("matches the provider total for a simple purchase", () => {
    const s = buildReceiptSnapshot({ ...base, lines: [{ description: "Course", detail: null, quantity: 1, unitAmountCents: 4900 }] });
    expect(s).toMatchObject({ subtotalCents: 4900, discountCents: 0, totalCents: 4900, totalsMismatch: false });
  });
  it("applies a discount and exclusive tax", () => {
    const s = buildReceiptSnapshot({
      ...base,
      lines: [{ description: "Course", detail: null, quantity: 1, unitAmountCents: 10000 }],
      discountCents: 2000,
      taxCents: 800,
      taxBehavior: "exclusive",
      providerTotalCents: 8800,
    });
    expect(s).toMatchObject({ subtotalCents: 10000, discountCents: 2000, taxCents: 800, totalCents: 8800, totalsMismatch: false });
  });
  it("does not add inclusive tax on top of the price", () => {
    const s = buildReceiptSnapshot({
      ...base,
      lines: [{ description: "Course", detail: null, quantity: 1, unitAmountCents: 12000 }],
      taxCents: 2000,
      taxBehavior: "inclusive",
      providerTotalCents: 12000,
    });
    expect(s.totalCents).toBe(12000);
    expect(s.totalsMismatch).toBe(false);
    expect(s.taxCents).toBe(2000);
  });
  it("keeps the provider's total and flags a mismatch", () => {
    const s = buildReceiptSnapshot({ ...base, lines: [{ description: "Course", detail: null, quantity: 1, unitAmountCents: 4900 }], providerTotalCents: 4700 });
    expect(s.totalCents).toBe(4700);
    expect(s.totalsMismatch).toBe(true);
  });
  it("credit notes total the refunded amount", () => {
    const s = buildReceiptSnapshot({
      ...base,
      kind: "credit_note",
      number: "FMA-CN-2026-001002",
      lines: [{ description: "Course", detail: null, quantity: 1, unitAmountCents: 4900 }],
      refundedCents: 1500,
      relatesTo: "FMA-R-2026-001001",
    });
    expect(s.totalCents).toBe(1500);
    expect(s.relatesTo).toBe("FMA-R-2026-001001");
    expect(s.totalsMismatch).toBe(false);
  });
});

describe("addresses", () => {
  it("formats a Whop billing address", () => {
    expect(addressLines({ line1: "1 Main St", line2: null, city: "Austin", state: "TX", postal_code: "78701", country: "US", name: "Ada" })).toEqual([
      "1 Main St",
      "Austin, TX, 78701",
      "US",
    ]);
  });
  it("splits a configured business address", () => {
    expect(splitAddress("10 High St\nLondon, EC1A 1BB")).toEqual(["10 High St", "London", "EC1A 1BB"]);
    expect(splitAddress("")).toEqual([]);
  });
});
