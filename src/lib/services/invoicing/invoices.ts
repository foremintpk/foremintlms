import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserFacingError } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { enqueueEmail } from "@/lib/services/email/outbox";
import { getWhopClient, isWhopReady } from "@/lib/services/payments/whop";
import { syncPaymentFromWhop } from "@/lib/services/payments/sync";
import { IntegrationNotConfiguredError } from "@/lib/services/integrations";
import type { SessionUser } from "@/lib/auth/session";
import { appUrl } from "@/lib/env";
import { firstName, formatDate } from "@/lib/format";
import {
  accessTermsLabel,
  canVoid,
  courseListText,
  formatMinor,
  expectedFirstPaymentMinor,
  isPayable,
  localStatusFromProvider,
  type CourseSnapshotItem,
  type InvoiceStatus,
} from "@/lib/domain/invoicing";
import { invoiceFormSchema, normalizeInvoiceForm, type NormalizedInvoice } from "@/lib/validation/invoicing";
import type { Json, TablesInsert } from "@/types/database";
import { logInvoiceEvent } from "./events";
import { getInvoicingSettings } from "./settings";
import {
  archiveWhopProduct,
  cancelWhopMembership,
  closePaymentLink,
  createAndIssueWhopInvoice,
  createPaymentLink,
  listVariantPayments,
  describeInvoiceError,
  retrieveWhopInvoice,
  sendWhopInvoice,
  voidWhopInvoice,
  type CustomInvoiceRow,
  type WhopInvoiceMappingRow,
} from "./whop-invoices";
import { applyCustomInvoiceMembership, fulfillInvoice, findInvoiceForPayment } from "./fulfillment";

/**
 * Admin operations on custom invoices. Every function expects an already
 * verified administrator (server actions call assertAdmin first) and
 * re-validates its input; nothing computed in the browser is trusted.
 */

const db = () => createAdminClient();

export async function loadInvoice(id: string): Promise<{ invoice: CustomInvoiceRow; mapping: WhopInvoiceMappingRow | null }> {
  const admin = db();
  const [{ data: invoice }, { data: mapping }] = await Promise.all([
    admin.from("custom_invoices").select("*").eq("id", id).maybeSingle(),
    admin.from("whop_invoice_mappings").select("*").eq("local_invoice_id", id).maybeSingle(),
  ]);
  if (!invoice) throw new UserFacingError("Invoice not found.");
  return { invoice: invoice as CustomInvoiceRow, mapping: (mapping as WhopInvoiceMappingRow | null) ?? null };
}

// ---------------------------------------------------------------------------
// Course selection
// ---------------------------------------------------------------------------

/** Courses eligible for custom invoices: published ones. Read from the DB, never from the client. */
export async function resolveCourseSnapshot(mode: NormalizedInvoice["courseSelectionMode"], ids: string[]): Promise<CourseSnapshotItem[]> {
  const admin = db();
  let query = admin.from("courses").select("id, title, slug, status, category_id").order("title");
  query = mode === "selected" ? query.in("id", [...new Set(ids)]) : query.eq("status", "published");
  const { data, error } = await query;
  if (error) throw new Error(`course lookup failed: ${error.message}`);
  const rows = data ?? [];
  if (mode === "selected") {
    if (rows.length !== new Set(ids).size) throw new UserFacingError("One of the selected courses no longer exists. Refresh and try again.");
    const unpublished = rows.filter((c) => c.status !== "published");
    if (unpublished.length) throw new UserFacingError(`${unpublished.map((c) => c.title).join(", ")} isn't published, so it can't be sold.`);
  } else if (mode === "all_published" && rows.length === 0) {
    throw new UserFacingError("There are no published courses to include.");
  }
  const categoryIds = [...new Set(rows.map((c) => c.category_id).filter(Boolean))] as string[];
  const { data: categories } = categoryIds.length ? await admin.from("course_categories").select("id, name").in("id", categoryIds) : { data: [] };
  const names = new Map((categories ?? []).map((c) => [c.id, c.name]));
  return rows.map((c) => ({ id: c.id, title: c.title, slug: c.slug, status: c.status, category: c.category_id ? (names.get(c.category_id) ?? null) : null }));
}

// ---------------------------------------------------------------------------
// Create / edit
// ---------------------------------------------------------------------------

export interface CreateInvoiceOptions {
  intent: "draft" | "generate";
  draftId?: string | null;
  revisionOf?: string | null;
}

export async function createOrUpdateInvoice(actor: SessionUser, raw: unknown, opts: CreateInvoiceOptions): Promise<{ id: string; status: string; generationError: string | null }> {
  const form = normalizeInvoiceForm(invoiceFormSchema.parse(raw));
  const settings = await getInvoicingSettings();
  const admin = db();

  if (form.billingType === "one_time" && form.accessMode === "lifetime" && !settings.allowLifetime) {
    throw new UserFacingError("Lifetime access is turned off in Invoice settings.");
  }
  if (opts.intent === "generate" && !(await isWhopReady())) {
    throw new UserFacingError("Connect Whop in Admin → Integrations before generating invoices. You can save this as a draft meanwhile.");
  }

  const snapshot = await resolveCourseSnapshot(form.courseSelectionMode, form.courseIds);

  let company: { id: string; name: string; description: string | null; services_description: string | null } | null = null;
  if (form.invoiceType === "company" && form.companyMode === "existing" && form.existingCompanyId) {
    const { data } = await admin.from("companies").select("id, name, description, services_description, status").eq("id", form.existingCompanyId).maybeSingle();
    if (!data || data.status === "archived") throw new UserFacingError("That company no longer exists.");
    company = data;
  }

  const values: Omit<TablesInsert<"custom_invoices">, "invoice_number"> = {
    invoice_type: form.invoiceType,
    company_id: company?.id ?? null,
    customer_name: form.customerName,
    customer_email: form.customerEmail,
    customer_phone: form.customerPhone,
    company_name: form.invoiceType === "company" ? (company?.name ?? form.companyName) : null,
    company_description: form.invoiceType === "company" ? (form.companyDescription ?? company?.description ?? null) : null,
    company_services: form.invoiceType === "company" ? (form.companyServices ?? company?.services_description ?? null) : null,
    internal_notes: form.internalNotes,
    invoice_description: form.invoiceDescription,
    customer_reference: form.customerReference,
    internal_reference: form.internalReference,
    currency: form.currency,
    amount_minor: form.amountMinor,
    upfront_fee_minor: form.upfrontFeeMinor,
    billing_type: form.billingType,
    collection_method: form.collectionMethod,
    access_mode: form.accessMode,
    access_duration_days: form.accessDurationDays,
    access_end_at: form.accessEndAt?.toISOString() ?? null,
    billing_interval_days: form.billingIntervalDays,
    billing_cycles: form.billingCycles,
    grace_period_days: form.gracePeriodDays,
    course_selection_mode: form.courseSelectionMode,
    includes_future_courses: form.courseSelectionMode === "all_including_future",
    selected_course_snapshot: snapshot as unknown as Json,
    course_ids: snapshot.map((c) => c.id),
    snapshot_taken_at: new Date().toISOString(),
    seat_limit: form.seatLimit,
    allow_contact_invites: form.allowContactInvites,
    due_at: (form.dueAt ?? (settings.defaultDueDays ? new Date(Date.now() + settings.defaultDueDays * 86_400_000) : null))?.toISOString() ?? null,
    link_expires_at: form.linkExpiresAt?.toISOString() ?? null,
    status: opts.intent === "generate" ? "pending_generation" : "draft",
  };
  if (values.course_ids && (values.course_ids as string[]).length === 0 && form.courseSelectionMode !== "all_including_future") {
    throw new UserFacingError("Select at least one course.");
  }

  let id: string;
  if (opts.draftId) {
    const { invoice, mapping } = await loadInvoice(opts.draftId);
    if (invoice.status !== "draft" || mapping) throw new UserFacingError("Only unsent drafts can be edited. Duplicate the invoice instead.");
    const { error } = await admin.from("custom_invoices").update(values).eq("id", invoice.id).eq("status", "draft");
    if (error) throw new Error(`invoice update failed: ${error.message}`);
    id = invoice.id;
    await logInvoiceEvent({ invoiceId: id, type: "edited", actorId: actor.id, oldStatus: "draft", newStatus: values.status as string });
  } else {
    const { data: number, error: numberError } = await admin.rpc("next_custom_invoice_number", { p_prefix: settings.numberPrefix });
    if (numberError || !number) throw new Error(`invoice number failed: ${numberError?.message}`);
    const { data, error } = await admin
      .from("custom_invoices")
      .insert({ ...values, invoice_number: number as string, created_by: actor.id, revision_of: opts.revisionOf ?? null })
      .select("id")
      .single();
    if (error || !data) throw new Error(`invoice insert failed: ${error?.message}`);
    id = data.id;
    await logInvoiceEvent({ invoiceId: id, type: "created", actorId: actor.id, newStatus: values.status as string, data: { revision_of: opts.revisionOf ?? null } });
    await audit({ actor, action: "custom_invoice.created", entityType: "custom_invoice", entityId: id, summary: `Created custom invoice ${number}` });
  }

  if (opts.intent === "generate") {
    const result = await generateWhopInvoice(actor, id);
    return { id, status: result.status, generationError: result.error };
  }
  return { id, status: "draft", generationError: null };
}

// ---------------------------------------------------------------------------
// Whop generation
// ---------------------------------------------------------------------------

export async function generateWhopInvoice(actor: SessionUser | null, id: string): Promise<{ status: InvoiceStatus; paymentUrl: string | null; error: string | null }> {
  const admin = db();
  // Claim: one generation at a time per invoice (a stuck lock frees itself after 2 minutes).
  const staleBefore = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data: claimed } = await admin
    .from("custom_invoices")
    .update({ status: "pending_generation", generation_locked_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["draft", "pending_generation"])
    .or(`generation_locked_at.is.null,generation_locked_at.lt.${staleBefore}`)
    .select("*")
    .maybeSingle();
  if (!claimed) {
    const { invoice, mapping } = await loadInvoice(id);
    if (invoice.status === "awaiting_payment") return { status: "awaiting_payment", paymentUrl: mapping?.payment_url ?? null, error: null };
    throw new UserFacingError(invoice.status === "pending_generation" ? "This invoice is being generated right now. Refresh in a moment." : "This invoice has already been generated.");
  }
  const inv = claimed as CustomInvoiceRow;
  const { data: existingMapping } = await admin.from("whop_invoice_mappings").select("*").eq("local_invoice_id", id).maybeSingle();
  const snapshot = (inv.selected_course_snapshot as unknown as CourseSnapshotItem[]) ?? [];

  // Courses may have been unpublished since the draft was saved.
  if (inv.course_selection_mode === "selected") {
    const { data: live } = await admin.from("courses").select("id, status").in("id", inv.course_ids);
    const gone = inv.course_ids.filter((cid) => !(live ?? []).some((c) => c.id === cid && c.status === "published"));
    if (gone.length) {
      await admin.from("custom_invoices").update({ generation_locked_at: null, generation_error: "A selected course is no longer published. Edit the draft or duplicate the invoice." }).eq("id", id);
      throw new UserFacingError("A selected course is no longer published. Edit the course selection first.");
    }
  }

  if (inv.collection_method === "payment_link") return generatePaymentLink(actor, inv, (existingMapping as WhopInvoiceMappingRow | null) ?? null, snapshot.length);

  let outcome: Awaited<ReturnType<typeof createAndIssueWhopInvoice>>;
  try {
    outcome = await createAndIssueWhopInvoice(inv, (existingMapping as WhopInvoiceMappingRow | null) ?? null, {
      accessSummary: `${accessTermsLabel(inv as never)} · ${courseListText(snapshot, inv.includes_future_courses, 8)}`,
      courseCount: snapshot.length,
      attempt: inv.generation_attempts + 1,
    });
  } catch (err) {
    const message = err instanceof IntegrationNotConfiguredError ? err.message : describeInvoiceError(err);
    await admin.from("custom_invoices").update({ generation_locked_at: null, generation_error: message, generation_attempts: inv.generation_attempts + 1 }).eq("id", id);
    await logInvoiceEvent({ invoiceId: id, type: "generation_failed", actorId: actor?.id ?? null, data: { error: message } });
    return { status: "pending_generation", paymentUrl: null, error: message };
  }

  if (outcome.fields) {
    await admin
      .from("whop_invoice_mappings")
      .upsert({ local_invoice_id: id, ...outcome.fields, raw: (outcome.issued ?? outcome.draft) as unknown as Json }, { onConflict: "local_invoice_id" });
  }

  const issuedOk = Boolean(outcome.issued && outcome.fields?.payment_url && !outcome.error);
  const nextStatus: InvoiceStatus = outcome.issued?.status === "paid" ? "pending_generation" : issuedOk ? "awaiting_payment" : "pending_generation";
  await admin
    .from("custom_invoices")
    .update({
      status: nextStatus,
      generation_locked_at: null,
      generation_error: issuedOk ? null : outcome.error,
      generation_attempts: inv.generation_attempts + 1,
      last_synced_at: new Date().toISOString(),
    })
    .eq("id", id);
  await logInvoiceEvent({
    invoiceId: id,
    type: issuedOk ? "issued" : "generation_failed",
    oldStatus: inv.status,
    newStatus: nextStatus,
    actorId: actor?.id ?? null,
    data: issuedOk
      ? { whop_invoice_id: outcome.fields?.whop_invoice_id, whop_invoice_number: outcome.fields?.whop_invoice_number, environment: outcome.config.environment }
      : { error: outcome.error, code: outcome.errorCode, whop_invoice_id: outcome.fields?.whop_invoice_id ?? null },
  });
  if (actor) {
    await audit({
      actor,
      action: issuedOk ? "custom_invoice.issued" : "custom_invoice.generation_failed",
      entityType: "custom_invoice",
      entityId: id,
      summary: issuedOk ? `Issued Whop invoice ${outcome.fields?.whop_invoice_number ?? ""} for ${inv.invoice_number}` : `Whop generation failed for ${inv.invoice_number}`,
      metadata: { environment: outcome.config.environment, code: outcome.errorCode },
    });
  }
  // Paid before we even saw it as open (e.g. a retry after the customer paid): fulfil from Whop's state.
  if (outcome.issued?.status === "paid" && outcome.fields?.whop_invoice_id) await syncPaymentFromWhop(outcome.fields.whop_invoice_id);
  return { status: nextStatus, paymentUrl: issuedOk ? (outcome.fields?.payment_url ?? null) : null, error: issuedOk ? null : outcome.error };
}

/** Direct payment link: a Whop checkout the client can pay without signing in first. */
async function generatePaymentLink(actor: SessionUser | null, inv: CustomInvoiceRow, existing: WhopInvoiceMappingRow | null, courseCount: number) {
  const admin = db();
  const save = async (fields: Partial<WhopInvoiceMappingRow>) => {
    await admin.from("whop_invoice_mappings").upsert({ local_invoice_id: inv.id, ...fields } as never, { onConflict: "local_invoice_id" });
  };
  let outcome: Awaited<ReturnType<typeof createPaymentLink>>;
  try {
    outcome = await createPaymentLink(inv, existing, { courseCount, redirectUrl: appUrl(`/payment/complete?ref=${inv.id}`), save });
  } catch (err) {
    const message = err instanceof IntegrationNotConfiguredError ? err.message : describeInvoiceError(err);
    await admin.from("custom_invoices").update({ generation_locked_at: null, generation_error: message, generation_attempts: inv.generation_attempts + 1 }).eq("id", inv.id);
    await logInvoiceEvent({ invoiceId: inv.id, type: "generation_failed", actorId: actor?.id ?? null, data: { error: message } });
    return { status: "pending_generation" as InvoiceStatus, paymentUrl: null, error: message };
  }
  await save(outcome.fields);
  const ok = Boolean(outcome.paymentUrl && !outcome.error);
  const nextStatus: InvoiceStatus = ok ? "awaiting_payment" : "pending_generation";
  await admin
    .from("custom_invoices")
    .update({ status: nextStatus, generation_locked_at: null, generation_error: ok ? null : outcome.error, generation_attempts: inv.generation_attempts + 1, last_synced_at: new Date().toISOString() })
    .eq("id", inv.id);
  await logInvoiceEvent({
    invoiceId: inv.id,
    type: ok ? "link_created" : "generation_failed",
    oldStatus: inv.status,
    newStatus: nextStatus,
    actorId: actor?.id ?? null,
    data: ok ? { checkout: outcome.fields.whop_checkout_configuration_id, environment: outcome.config.environment } : { error: outcome.error, code: outcome.errorCode },
  });
  if (actor) {
    await audit({
      actor,
      action: ok ? "custom_invoice.link_created" : "custom_invoice.generation_failed",
      entityType: "custom_invoice",
      entityId: inv.id,
      summary: ok ? `Created Whop payment link for ${inv.invoice_number}` : `Whop payment link failed for ${inv.invoice_number}`,
      metadata: { environment: outcome.config.environment, code: outcome.errorCode },
    });
  }
  return { status: nextStatus, paymentUrl: ok ? outcome.paymentUrl : null, error: ok ? null : outcome.error };
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

export async function sendInvoiceEmail(actor: SessionUser | null, id: string, kind: "link" | "reminder" | "past_due"): Promise<{ channel: "foremint" | "whop" }> {
  const { invoice, mapping } = await loadInvoice(id);
  if (!isPayable(invoice.status as InvoiceStatus)) throw new UserFacingError("Only unpaid, open invoices can be sent.");
  if (!mapping?.payment_url) throw new UserFacingError("This invoice has no payment link yet. Generate it first.");
  if (actor && invoice.last_email_sent_at && Date.now() - new Date(invoice.last_email_sent_at).getTime() < 60_000) {
    throw new UserFacingError("This invoice was just emailed. Wait a minute before sending it again.");
  }
  const settings = await getInvoicingSettings();
  const sendCount = invoice.email_send_count + 1;

  // Whop can only email native invoices; payment links always go out as a Foremint email.
  const viaWhop = settings.delivery === "whop" && kind === "link" && invoice.collection_method === "whop_invoice";
  if (viaWhop) {
    try {
      await sendWhopInvoice(mapping.whop_invoice_id!, String(sendCount));
    } catch (err) {
      throw new UserFacingError(describeInvoiceError(err));
    }
  } else {
    const snapshot = (invoice.selected_course_snapshot as unknown as CourseSnapshotItem[]) ?? [];
    const amount = formatMinor(expectedFirstPaymentMinor(invoice as never), invoice.currency);
    const recurring = invoice.billing_type === "recurring";
    await enqueueEmail({
      templateKey: kind === "link" ? "invoice.payment_link" : kind === "reminder" ? "invoice.reminder" : "invoice.past_due",
      to: invoice.customer_email,
      userId: invoice.customer_user_id,
      idempotencyKey: `invoice-${kind}:${invoice.id}:${actor ? sendCount : "auto"}`,
      payload: {
        first_name: firstName(invoice.customer_name),
        invoice_number: invoice.invoice_number,
        invoice_description: invoice.invoice_description,
        amount,
        due_date: invoice.due_at ? formatDate(invoice.due_at) : "on receipt",
        cta_url: mapping.payment_url,
        details: [
          { label: "Invoice", value: invoice.invoice_number },
          ...(invoice.company_name ? [{ label: "Company", value: invoice.company_name }] : []),
          { label: "Courses", value: courseListText(snapshot, invoice.includes_future_courses, 10) || "—" },
          { label: "Access", value: accessTermsLabel(invoice as never) },
          ...(recurring && invoice.upfront_fee_minor > 0 ? [{ label: "Then", value: `${formatMinor(invoice.amount_minor, invoice.currency)} per billing period` }] : []),
          ...(invoice.due_at ? [{ label: "Due", value: formatDate(invoice.due_at) }] : []),
        ],
        line_items: [{ description: invoice.invoice_description, amount }],
        total: `${amount}${recurring ? " (first payment)" : ""}`,
      },
    });
  }

  await db()
    .from("custom_invoices")
    .update({ email_send_count: sendCount, last_email_sent_at: new Date().toISOString(), ...(kind === "reminder" ? { reminder_sent_at: new Date().toISOString() } : {}), ...(kind === "past_due" ? { past_due_notified_at: new Date().toISOString() } : {}) })
    .eq("id", id);
  const channel = viaWhop ? "whop" : "foremint";
  await logInvoiceEvent({ invoiceId: id, type: `email_${kind}`, actorId: actor?.id ?? null, data: { channel, to: invoice.customer_email, send: sendCount } });
  return { channel };
}

// ---------------------------------------------------------------------------
// Void / cancel / refresh / review
// ---------------------------------------------------------------------------

export async function voidCustomInvoice(actor: SessionUser, id: string, reason: string): Promise<void> {
  const { invoice, mapping } = await loadInvoice(id);
  if (!canVoid(invoice.status as InvoiceStatus)) throw new UserFacingError("Paid, refunded or closed invoices can't be voided.");
  if (invoice.collection_method === "payment_link" && mapping) {
    // A payment may have landed moments ago: settle that first.
    if (mapping.whop_variant_id) {
      const payments = await listVariantPayments(mapping.whop_variant_id, mapping.whop_account_id);
      for (const p of payments) await syncPaymentFromWhop(p.id);
      const { invoice: current } = await loadInvoice(id);
      if (!canVoid(current.status as InvoiceStatus)) throw new UserFacingError("The customer has already paid this invoice, so it can't be voided. Refund it from Payments instead.");
    }
    const closed = await closePaymentLink(mapping);
    await db().from("whop_invoice_mappings").update({ provider_status: "void", cleanup_status: closed ? "archived" : "archive_failed", last_synced_at: new Date().toISOString() }).eq("id", mapping.id);
  } else if (mapping?.whop_invoice_id) {
    try {
      const voided = await voidWhopInvoice(mapping.whop_invoice_id);
      await db().from("whop_invoice_mappings").update({ provider_status: voided.status, checkout_link: null, last_synced_at: new Date().toISOString() }).eq("id", mapping.id);
    } catch (err) {
      // Whop refuses to void a paid invoice: pick up the payment instead.
      const { invoice: current } = await retrieveWhopInvoice(mapping.whop_invoice_id).catch(() => ({ invoice: null }));
      if (current?.status === "paid") {
        await syncPaymentFromWhop(mapping.whop_invoice_id);
        throw new UserFacingError("The customer has already paid this invoice, so it can't be voided. Refund it from Payments instead.");
      }
      throw new UserFacingError(describeInvoiceError(err));
    }
    if (mapping.whop_product_id) {
      const archived = await archiveWhopProduct(mapping.whop_product_id);
      await db().from("whop_invoice_mappings").update({ cleanup_status: archived ? "archived" : "archive_failed" }).eq("id", mapping.id);
    }
  }
  await db().from("custom_invoices").update({ status: "voided", status_reason: reason, voided_at: new Date().toISOString(), generation_locked_at: null }).eq("id", id);
  await logInvoiceEvent({ invoiceId: id, type: "voided", oldStatus: invoice.status, newStatus: "voided", actorId: actor.id, data: { reason } });
  await audit({ actor, action: "custom_invoice.voided", entityType: "custom_invoice", entityId: id, summary: `Voided ${invoice.invoice_number}`, metadata: { reason } });
  if (invoice.email_send_count > 0) {
    await enqueueEmail({
      templateKey: "invoice.voided",
      to: invoice.customer_email,
      idempotencyKey: `invoice-voided:${id}`,
      payload: { first_name: firstName(invoice.customer_name), invoice_number: invoice.invoice_number, invoice_description: invoice.invoice_description },
    });
  }
}

/**
 * Read the invoice from Whop now and apply it. A paid invoice goes through
 * the same verified payment path as a webhook, so this is safe to press at
 * any time (and is what the reconciliation job does for open invoices).
 */
export async function refreshInvoiceStatus(actor: SessionUser | null, id: string): Promise<InvoiceStatus> {
  const { invoice, mapping } = await loadInvoice(id);
  if (invoice.collection_method === "payment_link") {
    if (!mapping?.whop_variant_id) return invoice.status as InvoiceStatus;
    // Every payment through the link's dedicated variant goes through the verified payment path.
    const payments = await listVariantPayments(mapping.whop_variant_id, mapping.whop_account_id);
    for (const p of payments) await syncPaymentFromWhop(p.id);
    await db().from("whop_invoice_mappings").update({ last_synced_at: new Date().toISOString() }).eq("id", mapping.id);
    await db().from("custom_invoices").update({ last_synced_at: new Date().toISOString() }).eq("id", id);
    if (actor) await logInvoiceEvent({ invoiceId: id, type: "refreshed", actorId: actor.id, data: { payments_found: payments.length } });
    const { invoice: after } = await loadInvoice(id);
    return after.status as InvoiceStatus;
  }
  if (!mapping?.whop_invoice_id) return invoice.status as InvoiceStatus;
  const { invoice: whop, fields } = await retrieveWhopInvoice(mapping.whop_invoice_id);
  await db().from("whop_invoice_mappings").update({ ...fields, raw: whop as unknown as Json }).eq("id", mapping.id);

  if (["paid", "pending", "authorized"].includes(whop.status) || ["paid", "refunded", "partially_refunded", "under_review"].includes(invoice.status)) {
    await syncPaymentFromWhop(mapping.whop_invoice_id);
  } else {
    const next = localStatusFromProvider({ status: whop.status, overdue: whop.overdue }, invoice.status as InvoiceStatus);
    if (next !== invoice.status) {
      await db().from("custom_invoices").update({ status: next, ...(next === "voided" ? { voided_at: new Date().toISOString() } : {}) }).eq("id", id);
      await logInvoiceEvent({ invoiceId: id, type: `status_${next}`, oldStatus: invoice.status, newStatus: next, actorId: actor?.id ?? null, data: { source: "whop_refresh", provider_status: whop.status } });
    }
  }
  await db().from("custom_invoices").update({ last_synced_at: new Date().toISOString() }).eq("id", id);
  if (actor) await logInvoiceEvent({ invoiceId: id, type: "refreshed", actorId: actor.id, data: { provider_status: whop.status } });
  const { invoice: after } = await loadInvoice(id);
  return after.status as InvoiceStatus;
}

/**
 * An administrator approves an invoice held for review (amount mismatch,
 * paid after voiding…). Whop must still report the payment as paid.
 */
export async function approveUnderReview(actor: SessionUser, id: string, reason: string): Promise<void> {
  const { invoice, mapping } = await loadInvoice(id);
  if (invoice.status !== "under_review" || !mapping?.whop_invoice_id) throw new UserFacingError("Only invoices under review can be approved.");
  const { client } = await getWhopClient();
  const payment = await client.payments.retrieve({ id: mapping.whop_invoice_id });
  if (payment.status !== "paid") throw new UserFacingError(`Whop reports this payment as ${payment.status}, so access can't be granted.`);
  const link = await findInvoiceForPayment(payment);
  if (!link) throw new UserFacingError("The payment no longer matches this invoice.");
  const { data: tx } = await db().from("payment_transactions").select("id").eq("whop_payment_id", payment.id).maybeSingle();
  await fulfillInvoice(link, payment, { transactionId: tx?.id ?? "", overrideBy: actor.id });
  await audit({ actor, action: "custom_invoice.review_approved", entityType: "custom_invoice", entityId: id, summary: `Approved ${invoice.invoice_number} after review`, metadata: { reason } });
  await logInvoiceEvent({ invoiceId: id, type: "review_approved", actorId: actor.id, data: { reason } });
}

/** Stop a recurring invoice's subscription on Whop (immediately or at period end). */
export async function cancelInvoiceSubscription(actor: SessionUser, id: string, atPeriodEnd: boolean, reason: string): Promise<void> {
  const { invoice, mapping } = await loadInvoice(id);
  if (invoice.billing_type !== "recurring" || !mapping?.whop_membership_id) throw new UserFacingError("This invoice has no active subscription.");
  try {
    const m = await cancelWhopMembership(mapping.whop_membership_id, atPeriodEnd, reason);
    await applyCustomInvoiceMembership(m, { invoice, mapping, kind: "renewal" });
  } catch (err) {
    if (err instanceof UserFacingError) throw err;
    throw new UserFacingError(describeInvoiceError(err));
  }
  await logInvoiceEvent({ invoiceId: id, type: "subscription_cancel_requested", actorId: actor.id, data: { at_period_end: atPeriodEnd, reason } });
  await audit({ actor, action: "custom_invoice.subscription_cancelled", entityType: "custom_invoice", entityId: id, summary: `Cancelled subscription for ${invoice.invoice_number}`, metadata: { atPeriodEnd, reason } });
}

export function invoicePaymentLink(mapping: WhopInvoiceMappingRow | null): string | null {
  return mapping?.payment_url ?? null;
}

export function invoiceAdminUrl(id: string): string {
  return appUrl(`/admin/billing/invoices/${id}`);
}
