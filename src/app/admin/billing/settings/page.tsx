import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { InvoicingSettingsForm } from "@/components/invoicing/invoicing-settings-form";
import { requireAdmin } from "@/lib/auth/guards";
import { getInvoicingSettings } from "@/lib/services/invoicing/settings";

export const instant = false;

export const metadata: Metadata = { title: "Invoice settings" };

export default async function InvoiceSettingsPage() {
  await requireAdmin("/admin/billing/settings");
  const s = await getInvoicingSettings();
  return (
    <>
      <PageHeader title="Invoice settings" description="Defaults for custom invoices, company invitations and what happens to access after refunds or disputes." />
      <InvoicingSettingsForm
        initial={{
          numberPrefix: s.numberPrefix,
          defaultDueDays: s.defaultDueDays,
          invitationTtlDays: s.invitationTtlDays,
          delivery: s.delivery,
          paymentReminderDays: s.paymentReminderDays,
          packageExpiryReminderDays: s.packageExpiryReminderDays,
          refundFullPolicy: s.refundFullPolicy,
          refundPartialPolicy: s.refundPartialPolicy,
          disputePolicy: s.disputePolicy,
          allowLifetime: s.allowLifetime,
          defaultCollectionMethod: s.defaultCollectionMethod,
          defaultGraceDays: s.defaultGraceDays,
        }}
      />
    </>
  );
}
