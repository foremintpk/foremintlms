import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicSettings } from "@/lib/settings";
import { formatDate } from "@/lib/format";
import { accessTermsLabel, type CourseSnapshotItem } from "@/lib/domain/invoicing";
import { renderServiceSummaryPdf, type ServiceSummaryData } from "@/lib/pdf/service-summary";
import { logInvoiceEvent } from "./events";
import type { CustomInvoiceRow } from "./whop-invoices";

/**
 * Branded service summaries live in the private `documents` bucket and are
 * versioned: regenerating writes a new file (v2, v3…) and never overwrites
 * an earlier version. Downloads go through an authorised route handler.
 */

const BUCKET = "documents";

export async function buildServiceSummaryData(inv: CustomInvoiceRow): Promise<ServiceSummaryData> {
  const admin = createAdminClient();
  const settings = await getPublicSettings();
  const { data: ent } = await admin.from("invoice_entitlements").select("starts_at, expires_at, status").eq("invoice_id", inv.id).maybeSingle();
  const snapshot = (inv.selected_course_snapshot as unknown as CourseSnapshotItem[]) ?? [];

  let accessPeriod = accessTermsLabel(inv as never);
  let accessDetail: string | null = inv.billing_type === "recurring" ? null : "Counted from the date payment is confirmed.";
  if (inv.billing_type === "one_time" && inv.access_mode === "lifetime") accessDetail = "Access does not expire.";
  if (ent) {
    accessDetail = ent.expires_at ? `Active from ${formatDate(ent.starts_at)} to ${formatDate(ent.expires_at)}.` : `Active from ${formatDate(ent.starts_at)}.`;
  }
  if (inv.billing_type === "recurring") {
    accessPeriod = inv.billing_cycles ? `${inv.billing_cycles * (inv.billing_interval_days ?? 30)} days (subscription)` : "While the subscription is active";
  } else if (inv.access_mode === "days") {
    accessPeriod = `${inv.access_duration_days} days`;
  }

  return {
    reference: inv.invoice_number,
    issuedOn: formatDate(inv.created_at, "d MMMM yyyy"),
    contactName: inv.customer_name,
    companyName: inv.invoice_type === "company" ? inv.company_name : null,
    companyDescription: inv.invoice_type === "company" ? inv.company_description : null,
    companyServices: inv.invoice_type === "company" ? inv.company_services : null,
    serviceDescription: inv.invoice_description,
    accessPeriod,
    accessDetail,
    courses: snapshot.map((c) => ({ title: c.title, category: c.category })),
    includesFutureCourses: inv.includes_future_courses,
    brandName: settings.brandName,
    supportEmail: settings.supportEmail || null,
  };
}

/** Render and store a new version. */
export async function generateServiceSummary(inv: CustomInvoiceRow, actorId: string | null): Promise<{ buffer: Buffer; version: number; path: string }> {
  const admin = createAdminClient();
  const buffer = await renderServiceSummaryPdf(await buildServiceSummaryData(inv));
  const version = inv.service_summary_version + 1;
  const path = `custom-invoices/${inv.id}/service-summary-v${version}.pdf`;
  const { error } = await admin.storage.from(BUCKET).upload(path, buffer, { contentType: "application/pdf", upsert: false });
  if (error && !/exists/i.test(error.message)) throw new Error(`summary upload failed: ${error.message}`);
  await admin
    .from("custom_invoices")
    .update({ service_summary_storage_path: path, service_summary_version: version, service_summary_generated_at: new Date().toISOString() })
    .eq("id", inv.id)
    .eq("service_summary_version", inv.service_summary_version);
  await logInvoiceEvent({ invoiceId: inv.id, type: "summary_generated", actorId, data: { version } });
  return { buffer, version, path };
}

/** The latest stored version, generating the first one on demand. */
export async function getServiceSummary(inv: CustomInvoiceRow, opts: { regenerate: boolean; actorId: string | null }): Promise<{ buffer: Buffer; version: number }> {
  if (!opts.regenerate && inv.service_summary_storage_path) {
    const { data, error } = await createAdminClient().storage.from(BUCKET).download(inv.service_summary_storage_path);
    if (!error && data) return { buffer: Buffer.from(await data.arrayBuffer()), version: inv.service_summary_version };
  }
  const created = await generateServiceSummary(inv, opts.actorId);
  return { buffer: created.buffer, version: created.version };
}
