import "server-only";
import { getSetting } from "@/lib/settings";
import type { RefundPolicy } from "@/lib/domain/invoicing";

/** Admin → Billing & invoicing → Invoice settings (platform_settings, `invoicing.*`). */
export interface InvoicingSettings {
  numberPrefix: string;
  defaultDueDays: number;
  invitationTtlDays: number;
  delivery: "foremint" | "whop";
  paymentReminderDays: number;
  packageExpiryReminderDays: number;
  refundFullPolicy: RefundPolicy;
  refundPartialPolicy: RefundPolicy;
  disputePolicy: "suspend" | "keep";
  allowLifetime: boolean;
  defaultCollectionMethod: "payment_link" | "whop_invoice";
  defaultGraceDays: number;
  defaultCurrency: string;
}

export const INVOICING_SETTING_KEYS: Record<keyof Omit<InvoicingSettings, "defaultCurrency">, string> = {
  numberPrefix: "invoicing.number_prefix",
  defaultDueDays: "invoicing.default_due_days",
  invitationTtlDays: "invoicing.invitation_ttl_days",
  delivery: "invoicing.delivery",
  paymentReminderDays: "invoicing.payment_reminder_days",
  packageExpiryReminderDays: "invoicing.package_expiry_reminder_days",
  refundFullPolicy: "invoicing.refund_full_policy",
  refundPartialPolicy: "invoicing.refund_partial_policy",
  disputePolicy: "invoicing.dispute_policy",
  allowLifetime: "invoicing.allow_lifetime",
  defaultCollectionMethod: "invoicing.default_collection_method",
  defaultGraceDays: "billing.default_grace_period_days",
};

export async function getInvoicingSettings(): Promise<InvoicingSettings> {
  const [numberPrefix, defaultDueDays, invitationTtlDays, delivery, paymentReminderDays, packageExpiryReminderDays, refundFullPolicy, refundPartialPolicy, disputePolicy, allowLifetime, defaultGraceDays, defaultCurrency, defaultCollectionMethod] =
    await Promise.all([
      getSetting<string>(INVOICING_SETTING_KEYS.numberPrefix, "FMA-INV"),
      getSetting<number>(INVOICING_SETTING_KEYS.defaultDueDays, 14),
      getSetting<number>(INVOICING_SETTING_KEYS.invitationTtlDays, 7),
      getSetting<string>(INVOICING_SETTING_KEYS.delivery, "foremint"),
      getSetting<number>(INVOICING_SETTING_KEYS.paymentReminderDays, 3),
      getSetting<number>(INVOICING_SETTING_KEYS.packageExpiryReminderDays, 14),
      getSetting<string>(INVOICING_SETTING_KEYS.refundFullPolicy, "revoke"),
      getSetting<string>(INVOICING_SETTING_KEYS.refundPartialPolicy, "keep"),
      getSetting<string>(INVOICING_SETTING_KEYS.disputePolicy, "suspend"),
      getSetting<boolean>(INVOICING_SETTING_KEYS.allowLifetime, true),
      getSetting<number>(INVOICING_SETTING_KEYS.defaultGraceDays, 3),
      getSetting<string>("billing.default_currency", "usd"),
      getSetting<string>(INVOICING_SETTING_KEYS.defaultCollectionMethod, "payment_link"),
    ]);
  const policy = (v: string, fallback: RefundPolicy): RefundPolicy => (v === "revoke" || v === "suspend" || v === "keep" ? v : fallback);
  return {
    numberPrefix: String(numberPrefix || "FMA-INV"),
    defaultDueDays: Number(defaultDueDays) || 0,
    invitationTtlDays: Math.max(1, Number(invitationTtlDays) || 7),
    delivery: delivery === "whop" ? "whop" : "foremint",
    paymentReminderDays: Number(paymentReminderDays) || 0,
    packageExpiryReminderDays: Number(packageExpiryReminderDays) || 0,
    refundFullPolicy: policy(refundFullPolicy, "revoke"),
    refundPartialPolicy: policy(refundPartialPolicy, "keep"),
    disputePolicy: disputePolicy === "keep" ? "keep" : "suspend",
    allowLifetime: allowLifetime !== false,
    defaultCollectionMethod: defaultCollectionMethod === "whop_invoice" ? "whop_invoice" : "payment_link",
    defaultGraceDays: Math.min(60, Math.max(0, Number(defaultGraceDays) || 0)),
    defaultCurrency: String(defaultCurrency || "usd").toLowerCase(),
  };
}
