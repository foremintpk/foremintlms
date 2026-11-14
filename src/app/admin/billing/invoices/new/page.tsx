import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/app-shell/page-header";
import { InvoiceBuilder } from "@/components/invoicing/invoice-builder";
import { WhopStatusBanner } from "@/components/billing/whop-status-banner";
import { requireAdmin } from "@/lib/auth/guards";
import { getInvoiceBuilderData } from "@/lib/services/invoicing/queries";
import { getInvoicingSettings } from "@/lib/services/invoicing/settings";
import { isWhopReady } from "@/lib/services/payments/whop";
import { createAdminClient } from "@/lib/supabase/admin";
import { invoiceRowToFormInput, type InvoiceFormInput } from "@/lib/validation/invoicing";

export const instant = false;

export const metadata: Metadata = { title: "Create custom invoice" };

export default async function NewInvoicePage({ searchParams }: PageProps<"/admin/billing/invoices/new">) {
  await requireAdmin("/admin/billing/invoices/new");
  const sp = await searchParams;
  const pick = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : null);
  const draftParam = pick("draft");
  const fromParam = pick("from");
  const revise = pick("revise") === "1";

  const [data, settings, whopReady] = await Promise.all([getInvoiceBuilderData(), getInvoicingSettings(), isWhopReady()]);

  let initial: InvoiceFormInput | null = null;
  let draftId: string | null = null;
  let revisionOf: string | null = null;
  let revisionNumber: string | null = null;
  const sourceId = draftParam ?? fromParam;
  if (sourceId) {
    if (!z.uuid().safeParse(sourceId).success) notFound();
    const { data: source } = await createAdminClient().from("custom_invoices").select("*").eq("id", sourceId).maybeSingle();
    if (!source) notFound();
    if (draftParam) {
      if (source.status !== "draft") notFound();
      draftId = source.id;
    } else if (revise) {
      revisionOf = source.id;
      revisionNumber = source.invoice_number;
    }
    initial = invoiceRowToFormInput(source, { keepDates: Boolean(draftParam), defaultDueDays: settings.defaultDueDays });
  }

  const title = draftId ? "Edit draft invoice" : revisionOf ? "Create revised invoice" : fromParam ? "Duplicate invoice" : "Create custom invoice";

  return (
    <>
      <PageHeader
        title={title}
        description="Set a negotiated price and access terms for an individual or a company. Public course prices are not affected."
        back={{ href: "/admin/billing/invoices", label: "Custom invoices" }}
      />
      <WhopStatusBanner />
      <InvoiceBuilder
        courses={data.courses}
        categories={data.categories}
        companies={data.companies}
        initial={initial}
        draftId={draftId}
        revisionOf={revisionOf}
        revisionNumber={revisionNumber}
        defaults={{ currency: settings.defaultCurrency, dueDays: settings.defaultDueDays, graceDays: settings.defaultGraceDays, allowLifetime: settings.allowLifetime, collectionMethod: settings.defaultCollectionMethod }}
        whopReady={whopReady}
      />
    </>
  );
}
