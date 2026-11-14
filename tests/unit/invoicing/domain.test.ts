import { describe, expect, it } from "vitest";
import {
  accessAfterRefund,
  accessTermsLabel,
  canVoid,
  computeExtendedExpiry,
  contractEndsAt,
  courseListText,
  expectedFirstPaymentMinor,
  formatMinor,
  hostedCheckoutUrl,
  localStatusFromProvider,
  majorStringToMinor,
  minorToApiNumber,
  minorToMajorString,
  oneTimeAccessWindow,
  parseAmountToMinor,
  remainingDays,
  sumMinor,
  verifyInvoicePayment,
} from "@/lib/domain/invoicing";
import { invoiceFormSchema, invoiceRowToFormInput, normalizeInvoiceForm } from "@/lib/validation/invoicing";

const DAY = 86_400_000;
const paidAt = new Date("2026-11-20T10:00:00Z");

describe("money is exact (integer minor units, no floating point)", () => {
  it("parses typed amounts", () => {
    expect(parseAmountToMinor("500", "usd")).toBe(50_000);
    expect(parseAmountToMinor("99.99", "usd")).toBe(9_999);
    expect(parseAmountToMinor("1,250.5", "usd")).toBe(125_050);
    expect(parseAmountToMinor("0.1", "usd")).toBe(10);
    expect(parseAmountToMinor(" 100.00 ", "usd")).toBe(10_000);
  });
  it("rejects invalid or over-precise amounts instead of rounding", () => {
    expect(parseAmountToMinor("1.234", "usd")).toBeNull();
    expect(parseAmountToMinor("-5", "usd")).toBeNull();
    expect(parseAmountToMinor("abc", "usd")).toBeNull();
    expect(parseAmountToMinor("12.5", "jpy")).toBeNull();
    expect(parseAmountToMinor("1200", "jpy")).toBe(1200);
  });
  it("formats minor units back to exact decimal strings", () => {
    expect(minorToMajorString(50_000, "usd")).toBe("500.00");
    expect(minorToMajorString(5, "usd")).toBe("0.05");
    expect(minorToMajorString(1200, "jpy")).toBe("1200");
    expect(minorToApiNumber(9_999, "usd")).toBe(99.99);
  });
  it("reads Whop decimal strings exactly", () => {
    expect(majorStringToMinor("100.00", "usd")).toBe(10_000);
    expect(majorStringToMinor("0.10", "usd")).toBe(10);
    expect(majorStringToMinor("100.000", "usd")).toBe(10_000);
    expect(majorStringToMinor("100.001", "usd")).toBeNull();
  });
  it("adds without float drift (0.10 + 0.20 = 0.30)", () => {
    expect(sumMinor([parseAmountToMinor("0.10", "usd"), parseAmountToMinor("0.20", "usd")])).toBe(30);
    expect(formatMinor(50_000, "usd")).toBe("$500.00");
  });
});

describe("access windows", () => {
  it("count one-time access from the verified payment, not invoice creation", () => {
    const w = oneTimeAccessWindow({ accessMode: "days", accessDurationDays: 180, accessEndAt: null }, paidAt);
    expect(w.startsAt).toEqual(paidAt);
    expect(w.expiresAt?.getTime()).toBe(paidAt.getTime() + 180 * DAY);
  });
  it("lifetime never expires; fixed dates are respected", () => {
    expect(oneTimeAccessWindow({ accessMode: "lifetime", accessDurationDays: null, accessEndAt: null }, paidAt).expiresAt).toBeNull();
    const end = new Date("2027-06-30T23:59:59Z");
    expect(oneTimeAccessWindow({ accessMode: "until_date", accessDurationDays: null, accessEndAt: end }, paidAt).expiresAt).toEqual(end);
  });
  it("caps fixed-term subscriptions at N billing periods", () => {
    expect(contractEndsAt(paidAt, 30, 6)?.getTime()).toBe(paidAt.getTime() + 180 * DAY);
    expect(contractEndsAt(paidAt, 30, null)).toBeNull();
  });
  it("bills the upfront fee once on the first recurring payment", () => {
    expect(expectedFirstPaymentMinor({ billing_type: "recurring", amount_minor: 25_000, upfront_fee_minor: 10_000 })).toBe(35_000);
    expect(expectedFirstPaymentMinor({ billing_type: "one_time", amount_minor: 50_000, upfront_fee_minor: 0 })).toBe(50_000);
  });
  it("describes the terms", () => {
    expect(accessTermsLabel({ billing_type: "one_time", access_mode: "days", access_duration_days: 90, access_end_at: null, billing_interval_days: null, billing_cycles: null })).toBe("90 days from payment");
    expect(accessTermsLabel({ billing_type: "recurring", access_mode: null, access_duration_days: null, access_end_at: null, billing_interval_days: 30, billing_cycles: 6 })).toContain("6 payments (180 days)");
  });
  it("counts remaining days", () => {
    expect(remainingDays(new Date(paidAt.getTime() + 2.5 * DAY), paidAt)).toBe(3);
    expect(remainingDays(new Date(paidAt.getTime() - DAY), paidAt)).toBe(0);
    expect(remainingDays(null, paidAt)).toBeNull();
  });
});

describe("manual extensions", () => {
  const now = new Date("2026-12-01T00:00:00Z");
  it("adds to the current end date", () => {
    const current = new Date("2027-01-01T00:00:00Z");
    expect(computeExtendedExpiry({ mode: "add_from_expiry", days: 30 }, current, now).getTime()).toBe(current.getTime() + 30 * DAY);
  });
  it("never extends from a date in the past", () => {
    const ended = new Date("2026-11-01T00:00:00Z");
    expect(computeExtendedExpiry({ mode: "add_from_expiry", days: 30 }, ended, now).getTime()).toBe(now.getTime() + 30 * DAY);
  });
  it("supports from-today and explicit dates", () => {
    expect(computeExtendedExpiry({ mode: "add_from_today", days: 10 }, null, now).getTime()).toBe(now.getTime() + 10 * DAY);
    const date = new Date("2027-03-01T23:59:59Z");
    expect(computeExtendedExpiry({ mode: "set_date", date }, null, now)).toEqual(date);
  });
});

describe("payment verification before access is granted", () => {
  const inv = { status: "awaiting_payment" as const, currency: "usd", billing_type: "one_time" as const, amount_minor: 50_000, upfront_fee_minor: 0 };
  const facts = { accountId: "biz_1", currency: "usd", subtotalMinor: 50_000, totalMinor: 50_000, taxMinor: null };
  it("accepts the exact amount, currency and account", () => {
    expect(verifyInvoicePayment(inv, facts, "biz_1")).toEqual({ ok: true });
  });
  it("uses total minus tax when no subtotal is reported", () => {
    expect(verifyInvoicePayment(inv, { ...facts, subtotalMinor: null, totalMinor: 54_000, taxMinor: 4_000 }, "biz_1")).toEqual({ ok: true });
  });
  it("rejects another Whop account, currency or amount", () => {
    expect(verifyInvoicePayment(inv, { ...facts, accountId: "biz_other" }, "biz_1").ok).toBe(false);
    expect(verifyInvoicePayment(inv, { ...facts, currency: "eur" }, "biz_1").ok).toBe(false);
    expect(verifyInvoicePayment(inv, { ...facts, subtotalMinor: 49_999 }, "biz_1").ok).toBe(false);
    expect(verifyInvoicePayment(inv, { ...facts, subtotalMinor: null, totalMinor: null }, "biz_1").ok).toBe(false);
  });
  it("never fulfils an invoice that was voided, cancelled or expired", () => {
    for (const status of ["voided", "cancelled", "expired"] as const) {
      expect(verifyInvoicePayment({ ...inv, status }, facts, "biz_1").ok).toBe(false);
    }
  });
});

describe("provider status mapping", () => {
  it("normalises open/overdue/void without ever marking paid", () => {
    expect(localStatusFromProvider({ status: "open", overdue: false }, "pending_generation")).toBe("awaiting_payment");
    expect(localStatusFromProvider({ status: "open", overdue: true }, "awaiting_payment")).toBe("past_due");
    expect(localStatusFromProvider({ status: "void" }, "awaiting_payment")).toBe("voided");
    expect(localStatusFromProvider({ status: "uncollectible" }, "past_due")).toBe("cancelled");
    expect(localStatusFromProvider({ status: "paid" }, "awaiting_payment")).toBe("awaiting_payment");
  });
  it("leaves settled invoices alone (out-of-order events)", () => {
    expect(localStatusFromProvider({ status: "open" }, "paid")).toBe("paid");
    expect(localStatusFromProvider({ status: "void" }, "refunded")).toBe("refunded");
  });
  it("only voids unpaid invoices", () => {
    expect(canVoid("awaiting_payment")).toBe(true);
    expect(canVoid("paid")).toBe(false);
    expect(canVoid("refunded")).toBe(false);
  });
});

describe("refund policy", () => {
  it("applies the configured treatment", () => {
    expect(accessAfterRefund(true, { full: "revoke", partial: "keep" })).toBe("revoked");
    expect(accessAfterRefund(false, { full: "revoke", partial: "keep" })).toBe("active");
    expect(accessAfterRefund(false, { full: "revoke", partial: "suspend" })).toBe("suspended");
  });
});

describe("hosted checkout URL from Whop's checkout_link", () => {
  it("splits at the first dot, as Whop documents", () => {
    expect(hostedCheckoutUrl("pay_ABC.sig+/=x.y", "pay_ABC", "production")).toBe("https://whop.com/checkout/pay_ABC/?token=sig%2B%2F%3Dx.y");
    expect(hostedCheckoutUrl("pay_ABC.tok", "pay_ABC", "sandbox")).toBe("https://sandbox.whop.com/checkout/pay_ABC/?token=tok");
  });
  it("refuses links for another invoice or without a token", () => {
    expect(hostedCheckoutUrl("pay_OTHER.tok", "pay_ABC", "production")).toBeNull();
    expect(hostedCheckoutUrl("pay_ABC", "pay_ABC", "production")).toBeNull();
    expect(hostedCheckoutUrl(null, "pay_ABC", "production")).toBeNull();
  });
});

describe("course lists", () => {
  const snap = [
    { id: "1", title: "Amazon FBA Foundations", slug: "a", category: null, status: "published" },
    { id: "2", title: "Shopify Store Launch", slug: "b", category: null, status: "published" },
  ];
  it("lists titles and mentions future courses", () => {
    expect(courseListText(snap, false)).toBe("Amazon FBA Foundations, Shopify Store Launch");
    expect(courseListText(snap, true)).toContain("every course published while access lasts");
    expect(courseListText(snap, false, 1)).toBe("Amazon FBA Foundations and 1 more");
  });
});

describe("invoice form validation", () => {
  const base = {
    invoiceType: "individual",
    customerName: "Jane Doe",
    customerEmail: "Jane@Example.com",
    invoiceDescription: "Custom package",
    courseSelectionMode: "selected",
    courseIds: ["3f1a6f9c-1d2e-4b5a-9c8d-7e6f5a4b3c2d"],
    currency: "usd",
    amount: "100",
    billingType: "one_time",
    accessMode: "days",
    accessDurationDays: 90,
  };
  it("accepts a valid individual invoice and normalises it", () => {
    const parsed = invoiceFormSchema.parse(base);
    expect(parsed.customerEmail).toBe("jane@example.com");
    const n = normalizeInvoiceForm(parsed);
    expect(n.amountMinor).toBe(10_000);
    expect(n.accessDurationDays).toBe(90);
    expect(n.billingIntervalDays).toBeNull();
  });
  it("requires a company name, courses and a valid amount", () => {
    const issues = (v: object) => (invoiceFormSchema.safeParse(v).error?.issues ?? []).map((i) => String(i.path[0]));
    expect(issues({ ...base, invoiceType: "company" })).toContain("companyName");
    expect(issues({ ...base, courseIds: [] })).toContain("courseIds");
    expect(issues({ ...base, amount: "0.50" })).toContain("amount");
    expect(issues({ ...base, amount: "12.345" })).toContain("amount");
    expect(issues({ ...base, customerEmail: "not-an-email" })).toContain("customerEmail");
  });
  it("needs a billing interval for subscriptions and a valid payment count", () => {
    const issues = (v: object) => (invoiceFormSchema.safeParse(v).error?.issues ?? []).map((i) => String(i.path[0]));
    expect(issues({ ...base, billingType: "recurring", billingIntervalDays: null })).toContain("billingIntervalDays");
    expect(issues({ ...base, billingType: "recurring", billingIntervalDays: 30, billingCycles: 200 })).toContain("billingCycles");
    expect(issues({ ...base, billingType: "recurring", billingIntervalDays: 400 })).toContain("billingIntervalDays");
  });
  it("rejects access end dates in the past", () => {
    const issues = (invoiceFormSchema.safeParse({ ...base, accessMode: "until_date", accessEndDate: "2020-01-01" }).error?.issues ?? []).map((i) => String(i.path[0]));
    expect(issues).toContain("accessEndDate");
  });
  it("all-course modes don't need explicit course ids", () => {
    expect(invoiceFormSchema.safeParse({ ...base, courseSelectionMode: "all_including_future", courseIds: [] }).success).toBe(true);
  });
  it("round-trips a saved invoice into the builder", () => {
    const form = invoiceRowToFormInput(
      {
        invoice_type: "company",
        customer_name: "John Smith",
        customer_email: "john@company.com",
        customer_phone: null,
        company_id: null,
        company_name: "ABC Digital Solutions",
        company_description: null,
        company_services: null,
        internal_notes: "internal",
        invoice_description: "All courses for ABC",
        customer_reference: null,
        internal_reference: null,
        course_selection_mode: "all_published",
        course_ids: ["3f1a6f9c-1d2e-4b5a-9c8d-7e6f5a4b3c2d"],
        currency: "usd",
        amount_minor: 50_000,
        upfront_fee_minor: 0,
        billing_type: "one_time",
        access_mode: "days",
        access_duration_days: 180,
        access_end_at: null,
        billing_interval_days: null,
        billing_cycles: null,
        grace_period_days: 3,
        seat_limit: 25,
        allow_contact_invites: true,
        due_at: null,
        link_expires_at: null,
      },
      { keepDates: false, defaultDueDays: 0 },
    );
    expect(form.amount).toBe("500.00");
    expect(form.courseIds).toEqual([]);
    expect(invoiceFormSchema.safeParse(form).success).toBe(true);
  });
});
