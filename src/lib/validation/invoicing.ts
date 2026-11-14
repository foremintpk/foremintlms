import { z } from "zod";
import {
  isSupportedCurrency,
  maximumAmountMinor,
  minimumAmountMinor,
  minorToMajorString,
  parseAmountToMinor,
} from "@/lib/domain/invoicing";

/**
 * Input contracts for custom invoicing and company access. The invoice
 * builder validates with these in the browser for inline errors; the server
 * actions parse with the same schemas and never trust client-computed values
 * (amounts are re-parsed from text, courses re-read from the database).
 */

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));
const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email("Enter a valid email address"));
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");

function endOfDayUtc(date: string): Date {
  return new Date(`${date}T23:59:59.000Z`);
}

export const invoiceFormSchema = z
  .object({
    invoiceType: z.enum(["individual", "company"]),
    customerName: trimmed(160).min(2, "Enter the customer's full name"),
    customerEmail: email,
    customerPhone: optionalText(40),
    companyMode: z.enum(["new", "existing"]).default("new"),
    existingCompanyId: z.uuid().nullable().optional(),
    companyName: optionalText(200),
    companyDescription: optionalText(4000),
    companyServices: optionalText(4000),
    internalNotes: optionalText(4000),

    invoiceDescription: trimmed(500).min(3, "Describe what is being purchased"),
    customerReference: optionalText(120),
    internalReference: optionalText(120),

    courseSelectionMode: z.enum(["selected", "all_published", "all_including_future"]),
    courseIds: z.array(z.uuid()).max(1000).default([]),

    currency: z
      .string()
      .trim()
      .toLowerCase()
      .refine(isSupportedCurrency, "Choose a supported currency"),
    amount: trimmed(32),
    billingType: z.enum(["one_time", "recurring"]),
    collectionMethod: z.enum(["payment_link", "whop_invoice"]).default("payment_link"),
    accessMode: z.enum(["days", "lifetime", "until_date"]).default("days"),
    accessDurationDays: z.coerce.number().int().min(1).max(3650).nullable().optional(),
    accessEndDate: isoDate.nullable().optional(),
    billingIntervalDays: z.coerce.number().int().min(2, "Whop billing periods are 2–365 days").max(365, "Whop billing periods are 2–365 days").nullable().optional(),
    billingCycles: z.coerce.number().int().min(2, "Use 2–115 payments, or leave empty").max(115, "Use 2–115 payments, or leave empty").nullable().optional(),
    upfrontFee: trimmed(32).optional().default(""),
    gracePeriodDays: z.coerce.number().int().min(0).max(60).default(3),

    seatLimit: z.coerce.number().int().min(1).max(100000).nullable().optional(),
    allowContactInvites: z.boolean().default(true),

    dueDate: isoDate.nullable().optional(),
    linkExpiryDate: isoDate.nullable().optional(),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });

    if (v.invoiceType === "company") {
      if (v.companyMode === "existing" && !v.existingCompanyId) issue("existingCompanyId", "Choose the company");
      if (v.companyMode === "new" && !v.companyName) issue("companyName", "Enter the company name");
    }

    if (v.courseSelectionMode === "selected" && v.courseIds.length === 0) issue("courseIds", "Select at least one course");

    if (isSupportedCurrency(v.currency)) {
      const minor = parseAmountToMinor(v.amount, v.currency);
      if (minor === null) issue("amount", "Enter an amount like 500 or 99.99");
      else if (minor < minimumAmountMinor(v.currency)) issue("amount", `The minimum is ${minorToMajorString(minimumAmountMinor(v.currency), v.currency)} ${v.currency.toUpperCase()}`);
      else if (minor > maximumAmountMinor(v.currency)) issue("amount", "That amount is too large for one invoice");
      if (v.billingType === "recurring" && v.upfrontFee) {
        const fee = parseAmountToMinor(v.upfrontFee, v.currency);
        if (fee === null) issue("upfrontFee", "Enter an amount like 100 or 49.99");
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    if (v.billingType === "one_time") {
      if (v.accessMode === "days" && !v.accessDurationDays) issue("accessDurationDays", "Enter the number of days of access");
      if (v.accessMode === "until_date") {
        if (!v.accessEndDate) issue("accessEndDate", "Choose the date access ends");
        else if (v.accessEndDate <= today) issue("accessEndDate", "The end date must be in the future");
      }
    } else if (!v.billingIntervalDays) {
      issue("billingIntervalDays", "Choose how often the customer is billed");
    }

    if (v.dueDate && v.dueDate < today) issue("dueDate", "The due date can't be in the past");
    if (v.linkExpiryDate) {
      if (v.linkExpiryDate <= today) issue("linkExpiryDate", "The link expiry must be in the future");
      if (v.dueDate && v.linkExpiryDate < v.dueDate) issue("linkExpiryDate", "The link can't expire before the due date");
    }
    if (v.billingType === "one_time" && v.accessMode === "until_date" && v.accessEndDate && v.dueDate && v.accessEndDate <= v.dueDate) {
      issue("accessEndDate", "Access must end after the payment due date");
    }
  });

export type InvoiceFormInput = z.input<typeof invoiceFormSchema>;
export type InvoiceFormValues = z.output<typeof invoiceFormSchema>;

/** Normalised, server-side view of a validated form: exact minor units and Date objects. */
export function normalizeInvoiceForm(v: InvoiceFormValues) {
  const amountMinor = parseAmountToMinor(v.amount, v.currency)!;
  const upfrontFeeMinor = v.billingType === "recurring" && v.upfrontFee ? (parseAmountToMinor(v.upfrontFee, v.currency) ?? 0) : 0;
  return {
    ...v,
    amountMinor,
    upfrontFeeMinor,
    accessMode: v.billingType === "one_time" ? v.accessMode : null,
    accessDurationDays: v.billingType === "one_time" && v.accessMode === "days" ? (v.accessDurationDays ?? null) : null,
    accessEndAt: v.billingType === "one_time" && v.accessMode === "until_date" && v.accessEndDate ? endOfDayUtc(v.accessEndDate) : null,
    billingIntervalDays: v.billingType === "recurring" ? (v.billingIntervalDays ?? null) : null,
    billingCycles: v.billingType === "recurring" ? (v.billingCycles ?? null) : null,
    dueAt: v.dueDate ? endOfDayUtc(v.dueDate) : null,
    linkExpiresAt: v.linkExpiryDate ? endOfDayUtc(v.linkExpiryDate) : null,
    seatLimit: v.invoiceType === "company" ? (v.seatLimit ?? null) : null,
  };
}
export type NormalizedInvoice = ReturnType<typeof normalizeInvoiceForm>;

export const generateInvoiceSchema = z.object({
  form: z.unknown(),
  intent: z.enum(["draft", "generate"]),
  termsConfirmed: z.boolean().optional(),
});

export const idSchema = z.object({ id: z.uuid() });

export const reasonSchema = z.object({
  id: z.uuid(),
  reason: z.string().trim().min(3, "Give a short reason").max(1000),
});

export const inviteMemberSchema = z.object({
  companyId: z.uuid(),
  email,
  fullName: optionalText(160),
  canInviteMembers: z.boolean().default(false),
});

export const bulkInviteSchema = z.object({
  companyId: z.uuid(),
  emails: z.string().max(20000),
});

export const memberActionSchema = z.object({
  companyId: z.uuid(),
  memberId: z.uuid(),
  reason: z.string().trim().max(1000).optional(),
});

export const invitationActionSchema = z.object({
  companyId: z.uuid(),
  invitationId: z.uuid(),
});

export const extendAccessSchema = z
  .object({
    entitlementId: z.uuid(),
    mode: z.enum(["add_from_expiry", "add_from_today", "set_date"]),
    days: z.coerce.number().int().min(1).max(3650).nullable().optional(),
    date: isoDate.nullable().optional(),
    reason: z.string().trim().min(3, "Give a reason for the audit log").max(1000),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "set_date" && !v.date) ctx.addIssue({ code: "custom", path: ["date"], message: "Choose the new end date" });
    if (v.mode !== "set_date" && !v.days) ctx.addIssue({ code: "custom", path: ["days"], message: "Enter the number of days" });
  });

export const companySettingsSchema = z.object({
  companyId: z.uuid(),
  name: trimmed(200).min(1),
  description: optionalText(4000),
  servicesDescription: optionalText(4000),
  seatLimit: z.coerce.number().int().min(1).max(100000).nullable().optional(),
  internalNotes: optionalText(4000),
  reason: z.string().trim().max(1000).optional(),
});

export const changeContactSchema = z.object({
  companyId: z.uuid(),
  memberId: z.uuid(),
  reason: z.string().trim().min(3, "Give a reason for the audit log").max(1000),
});

export const invoicingSettingsSchema = z.object({
  numberPrefix: z.string().trim().regex(/^[A-Za-z0-9-]{2,16}$/, "2–16 letters, numbers or dashes"),
  defaultDueDays: z.coerce.number().int().min(0).max(365),
  invitationTtlDays: z.coerce.number().int().min(1).max(60),
  delivery: z.enum(["foremint", "whop"]),
  paymentReminderDays: z.coerce.number().int().min(0).max(60),
  packageExpiryReminderDays: z.coerce.number().int().min(0).max(90),
  refundFullPolicy: z.enum(["revoke", "suspend", "keep"]),
  refundPartialPolicy: z.enum(["keep", "suspend", "revoke"]),
  disputePolicy: z.enum(["suspend", "keep"]),
  allowLifetime: z.boolean(),
  defaultCollectionMethod: z.enum(["payment_link", "whop_invoice"]),
  defaultGraceDays: z.coerce.number().int().min(0).max(60),
});
export type InvoicingSettingsInput = z.input<typeof invoicingSettingsSchema>;

/** Prefill the invoice builder from a saved invoice (edit draft, duplicate or revise). */
export function invoiceRowToFormInput(
  inv: {
    invoice_type: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string | null;
    company_id: string | null;
    company_name: string | null;
    company_description: string | null;
    company_services: string | null;
    internal_notes: string | null;
    invoice_description: string;
    customer_reference: string | null;
    internal_reference: string | null;
    course_selection_mode: string;
    course_ids: string[];
    currency: string;
    amount_minor: number;
    upfront_fee_minor: number;
    billing_type: string;
    collection_method?: string | null;
    access_mode: string | null;
    access_duration_days: number | null;
    access_end_at: string | null;
    billing_interval_days: number | null;
    billing_cycles: number | null;
    grace_period_days: number;
    seat_limit: number | null;
    allow_contact_invites: boolean;
    due_at: string | null;
    link_expires_at: string | null;
  },
  opts: { keepDates: boolean; defaultDueDays: number },
): InvoiceFormInput {
  const day = (iso: string | null) => (iso ? iso.slice(0, 10) : null);
  const today = new Date().toISOString().slice(0, 10);
  const future = (d: string | null) => (d && d > today ? d : null);
  return {
    invoiceType: inv.invoice_type === "company" ? "company" : "individual",
    customerName: inv.customer_name,
    customerEmail: inv.customer_email,
    customerPhone: inv.customer_phone ?? "",
    companyMode: inv.company_id ? "existing" : "new",
    existingCompanyId: inv.company_id,
    companyName: inv.company_name ?? "",
    companyDescription: inv.company_description ?? "",
    companyServices: inv.company_services ?? "",
    internalNotes: inv.internal_notes ?? "",
    invoiceDescription: inv.invoice_description,
    customerReference: inv.customer_reference ?? "",
    internalReference: inv.internal_reference ?? "",
    courseSelectionMode: inv.course_selection_mode as InvoiceFormInput["courseSelectionMode"],
    courseIds: inv.course_selection_mode === "selected" ? inv.course_ids : [],
    currency: inv.currency,
    amount: minorToMajorString(inv.amount_minor, inv.currency),
    billingType: inv.billing_type === "recurring" ? "recurring" : "one_time",
    collectionMethod: inv.collection_method === "whop_invoice" ? "whop_invoice" : "payment_link",
    accessMode: (inv.access_mode ?? "days") as InvoiceFormInput["accessMode"],
    accessDurationDays: inv.access_duration_days ?? 90,
    accessEndDate: future(day(inv.access_end_at)),
    billingIntervalDays: inv.billing_interval_days ?? 30,
    billingCycles: inv.billing_cycles,
    upfrontFee: inv.upfront_fee_minor ? minorToMajorString(inv.upfront_fee_minor, inv.currency) : "",
    gracePeriodDays: inv.grace_period_days,
    seatLimit: inv.seat_limit,
    allowContactInvites: inv.allow_contact_invites,
    dueDate: opts.keepDates
      ? future(day(inv.due_at))
      : opts.defaultDueDays
        ? new Date(Date.now() + opts.defaultDueDays * 86_400_000).toISOString().slice(0, 10)
        : null,
    linkExpiryDate: opts.keepDates ? future(day(inv.link_expires_at)) : null,
  };
}
