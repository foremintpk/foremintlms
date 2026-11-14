import "server-only";
import type { Whop } from "@whop/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/services/notifications";
import { enqueueEmail } from "@/lib/services/email/outbox";
import { listAdminUserIds } from "@/lib/services/account";
import { getWhopClient } from "@/lib/services/payments/whop";
import { mapBillingReason, mapPaymentStatus, moneyToCents } from "@/lib/services/payments/mapping";
import type { TransactionStatus } from "@/lib/services/payments/types";
import { entitlementForMembership, normalizeMembershipStatus } from "@/lib/domain/subscriptions";
import {
  accessAfterRefund,
  contractEndsAt,
  formatMinor,
  isSupportedCurrency,
  majorStringToMinor,
  oneTimeAccessWindow,
  verifyInvoicePayment,
  type InvoiceStatus,
  type PaymentFacts,
} from "@/lib/domain/invoicing";
import { appUrl } from "@/lib/env";
import { firstName, formatDate, formatDateTime } from "@/lib/format";
import type { Json } from "@/types/database";
import { describePackage, loadEntitlement, setPackageStatus, syncCompanyAccess, syncPackageAccess, welcomeCoveredLearners, type InvoiceEntitlementRow } from "./access";
import { addCompanyMember } from "./companies";
import { logCompanyAudit, logInvoiceEvent } from "./events";
import { createAccessInvitation } from "./invitations";
import { getInvoicingSettings } from "./settings";
import type { CustomInvoiceRow, WhopInvoiceMappingRow } from "./whop-invoices";

/**
 * Verified Whop state → custom invoice outcome.
 *
 * Entry points are called from the existing Whop webhook / reconciliation
 * pipeline (src/lib/services/payments/sync.ts), which has already verified
 * the webhook signature and re-fetched the payment or membership from the
 * Whop API. Nothing here trusts a redirect, a query string or a raw webhook
 * payload. Every step is idempotent: the invoice is claimed with a
 * conditional status update, packages are unique per invoice, access rows
 * are upserted in SQL, and emails/events carry dedupe keys.
 */

const DAY_MS = 86_400_000;
const db = () => createAdminClient();

export interface InvoiceLink {
  invoice: CustomInvoiceRow;
  mapping: WhopInvoiceMappingRow;
  kind: "initial" | "renewal";
}

export interface CustomPaymentResult {
  transactionId: string;
  status: TransactionStatus;
  previousStatus: TransactionStatus | null;
  userMatched: boolean;
  planMatched: boolean;
}

async function loadLink(where: {
  column: "whop_invoice_id" | "whop_membership_id" | "local_invoice_id" | "whop_checkout_configuration_id" | "whop_variant_id";
  value: string;
}): Promise<{ invoice: CustomInvoiceRow; mapping: WhopInvoiceMappingRow } | null> {
  const { data } = await db().from("whop_invoice_mappings").select("*, custom_invoices!inner(*)").eq(where.column, where.value).maybeSingle();
  if (!data) return null;
  const { custom_invoices, ...mapping } = data as WhopInvoiceMappingRow & { custom_invoices: CustomInvoiceRow };
  return { invoice: custom_invoices, mapping: mapping as WhopInvoiceMappingRow };
}

async function closeCheckoutOnly(checkoutConfigurationId: string) {
  try {
    const { client } = await getWhopClient();
    await client.checkoutConfigurations.delete({ id: checkoutConfigurationId });
  } catch (err) {
    console.warn("[invoicing] could not delete paid checkout link", checkoutConfigurationId, err instanceof Error ? err.message : err);
  }
}

function metadataInvoiceId(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const v = (meta as Record<string, unknown>).foremint_custom_invoice_id;
  return typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null;
}

/** Is this (re-fetched) payment for a custom invoice? Initial payment or a renewal of its subscription. */
export async function findInvoiceForPayment(
  p: Pick<Whop.Payment, "id" | "membership_id" | "metadata"> & Partial<Pick<Whop.Payment, "checkout_configuration_id" | "variant_id" | "billing_reason">>,
): Promise<InvoiceLink | null> {
  const byId = await loadLink({ column: "whop_invoice_id", value: p.id });
  if (byId) return { ...byId, kind: "initial" };
  // Payment links: the checkout configuration and the dedicated (hidden,
  // single-stock) variant belong to exactly one invoice.
  const byLink =
    (p.checkout_configuration_id ? await loadLink({ column: "whop_checkout_configuration_id", value: p.checkout_configuration_id }) : null) ??
    (p.variant_id ? await loadLink({ column: "whop_variant_id", value: p.variant_id }) : null);
  if (byLink) {
    const isRenewal = mapBillingReason(p.billing_reason ?? null) === "renewal" || Boolean(byLink.mapping.whop_payment_id && byLink.mapping.whop_payment_id !== p.id);
    return { ...byLink, kind: isRenewal ? "renewal" : "initial" };
  }
  if (p.membership_id) {
    const byMembership = await loadLink({ column: "whop_membership_id", value: p.membership_id });
    if (byMembership) return { ...byMembership, kind: "renewal" };
  }
  const localId = metadataInvoiceId(p.metadata);
  if (localId && p.membership_id) {
    // A renewal whose membership id we didn't capture at issue time: confirm
    // through the membership itself (fetched from Whop) before linking.
    const link = await loadLink({ column: "local_invoice_id", value: localId });
    if (link && !link.mapping.whop_membership_id) {
      const { client } = await getWhopClient();
      const m = await client.memberships.retrieve({ id: p.membership_id });
      if (metadataInvoiceId(m.metadata) === localId) {
        await db().from("whop_invoice_mappings").update({ whop_membership_id: m.id }).eq("id", link.mapping.id).is("whop_membership_id", null);
        return { ...link, mapping: { ...link.mapping, whop_membership_id: m.id }, kind: "renewal" };
      }
    }
  }
  return null;
}

export async function findInvoiceForMembership(m: Pick<Whop.Membership, "id" | "metadata">): Promise<InvoiceLink | null> {
  const byMembership = await loadLink({ column: "whop_membership_id", value: m.id });
  if (byMembership) return { ...byMembership, kind: "renewal" };
  const localId = metadataInvoiceId(m.metadata);
  if (!localId) return null;
  const link = await loadLink({ column: "local_invoice_id", value: localId });
  if (!link || (link.mapping.whop_membership_id && link.mapping.whop_membership_id !== m.id)) return null;
  await db().from("whop_invoice_mappings").update({ whop_membership_id: m.id }).eq("id", link.mapping.id).is("whop_membership_id", null);
  return { ...link, mapping: { ...link.mapping, whop_membership_id: m.id }, kind: "renewal" };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function minorFrom(money: { amount: string | number } | null | undefined, currency: string): number | null {
  if (!money) return null;
  if (isSupportedCurrency(currency)) return majorStringToMinor(String(money.amount), currency);
  return moneyToCents(money as Parameters<typeof moneyToCents>[0]);
}

function paymentFacts(p: Whop.Payment): PaymentFacts {
  const currency = (p.currency ?? "usd").toLowerCase();
  return {
    accountId: p.account_id ?? null,
    currency,
    subtotalMinor: minorFrom(p.subtotal, currency),
    totalMinor: minorFrom(p.total, currency),
    taxMinor: minorFrom(p.tax_amount, currency),
  };
}

async function emailCustomer(inv: CustomInvoiceRow, templateKey: string, idempotencyKey: string, payload: Record<string, unknown>) {
  await enqueueEmail({
    templateKey,
    to: inv.customer_email,
    userId: inv.customer_user_id,
    idempotencyKey,
    payload: { first_name: firstName(inv.customer_name), invoice_number: inv.invoice_number, invoice_description: inv.invoice_description, ...payload },
  });
}

async function alertAdmins(title: string, body: string, invoiceId: string, type: string) {
  const admins = await listAdminUserIds();
  await notify(admins, { category: "system", type, title, body, url: `/admin/billing/invoices/${invoiceId}` });
}

async function setInvoiceStatus(inv: CustomInvoiceRow, next: InvoiceStatus, reason: string | null, extra: Record<string, unknown> = {}, dedupeKey?: string) {
  if (inv.status === next && !Object.keys(extra).length) return inv;
  const { data } = await db()
    .from("custom_invoices")
    .update({ status: next, status_reason: reason, ...extra })
    .eq("id", inv.id)
    .select("*")
    .single();
  if (inv.status !== next) {
    await logInvoiceEvent({ invoiceId: inv.id, type: `status_${next}`, oldStatus: inv.status, newStatus: next, dedupeKey, data: reason ? { reason } : {} });
  }
  return (data as CustomInvoiceRow | null) ?? inv;
}

async function markUnderReview(inv: CustomInvoiceRow, reason: string, paymentId: string) {
  if (inv.status === "under_review") return;
  await setInvoiceStatus(inv, "under_review", reason, {}, `under_review:${paymentId}`);
  await alertAdmins(`Invoice ${inv.invoice_number} needs review`, reason, inv.id, "invoice_under_review");
}

async function upsertTransaction(p: Whop.Payment, link: InvoiceLink, status: TransactionStatus) {
  const admin = db();
  const { data: existing } = await admin.from("payment_transactions").select("id, status, refunded_cents, raw").eq("whop_payment_id", p.id).maybeSingle();
  const facts = paymentFacts(p);
  const userId =
    link.invoice.invoice_type === "individual"
      ? link.invoice.customer_user_id
      : link.invoice.company_id
        ? ((await admin.from("companies").select("primary_contact_user_id").eq("id", link.invoice.company_id).maybeSingle()).data?.primary_contact_user_id ?? null)
        : null;
  const card = p.payment_instrument?.card ?? null;
  const effects = ((existing?.raw as { effects?: Record<string, boolean> } | undefined)?.effects) ?? {};
  const row = {
    whop_payment_id: p.id,
    user_id: userId,
    custom_invoice_id: link.invoice.id,
    whop_membership_id: p.membership_id,
    status,
    billing_reason: mapBillingReason(p.billing_reason),
    currency: facts.currency,
    subtotal_cents: facts.subtotalMinor,
    discount_cents: 0,
    tax_cents: facts.taxMinor,
    total_cents: facts.totalMinor ?? 0,
    refunded_cents: minorFrom(p.refunded_amount, facts.currency) ?? 0,
    card_brand: card?.brand ?? null,
    card_last4: card?.last4 ?? null,
    failure_reason: p.failure_message,
    paid_at: p.paid_at,
    refunded_at: p.refunded_at,
    last_synced_at: new Date().toISOString(),
    raw: { whop: p, effects, matched_by: "custom_invoice", invoice_payment: link.kind } as unknown as Json,
  };
  const { data, error } = await admin.from("payment_transactions").upsert(row, { onConflict: "whop_payment_id" }).select("id").single();
  if (error || !data) throw new Error(`payment upsert failed: ${error?.message}`);
  return { id: data.id as string, previousStatus: (existing?.status as TransactionStatus | undefined) ?? null, previousRefunded: (existing?.refunded_cents as number | undefined) ?? 0, refundedMinor: row.refunded_cents };
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export async function applyCustomInvoicePayment(p: Whop.Payment, link: InvoiceLink): Promise<CustomPaymentResult> {
  const status = mapPaymentStatus(p);
  const tx = await upsertTransaction(p, link, status);
  const result: CustomPaymentResult = { transactionId: tx.id, status, previousStatus: tx.previousStatus, userMatched: true, planMatched: true };
  const inv = link.invoice;

  if (link.kind === "renewal") {
    await applyRenewalPayment(p, link, status, tx);
    return result;
  }

  switch (status) {
    case "succeeded": {
      const { config } = await getWhopClient();
      const check = verifyInvoicePayment(
        { status: inv.status as InvoiceStatus, currency: inv.currency, billing_type: inv.billing_type as "one_time" | "recurring", amount_minor: inv.amount_minor, upfront_fee_minor: inv.upfront_fee_minor },
        paymentFacts(p),
        link.mapping.whop_account_id || config.companyId,
      );
      const alreadySettled = ["paid", "refunded", "partially_refunded"].includes(inv.status);
      if (!check.ok && !alreadySettled) {
        await markUnderReview(inv, check.reason, p.id);
        return result;
      }
      if (inv.status === "under_review") return result; // waits for an administrator
      if (inv.billing_type === "one_time" && inv.access_mode === "until_date" && inv.access_end_at && p.paid_at && new Date(inv.access_end_at) <= new Date(p.paid_at)) {
        await markUnderReview(inv, "Paid after the agreed access end date.", p.id);
        return result;
      }
      await fulfillInvoice(link, p, { transactionId: tx.id });
      // A won dispute restores access that was paused for it.
      if (tx.previousStatus === "disputed") await resolveDispute(link, "won");
      break;
    }
    case "failed": {
      if (["awaiting_payment", "past_due", "failed"].includes(inv.status)) {
        const updated = await setInvoiceStatus(inv, "failed", p.failure_message ?? "The payment attempt failed.", {}, `failed:${p.id}:${p.payments_failed ?? 0}`);
        await emailCustomer(updated, "billing.payment_failed", `invoice-payment-failed:${p.id}:${p.payments_failed ?? 0}`, {
          product_name: inv.invoice_description,
          failure_reason: p.failure_message ? `The provider said: ${p.failure_message}` : "",
          cta_url: link.mapping.payment_url ?? appUrl("/"),
        });
      }
      break;
    }
    case "voided": {
      if (["awaiting_payment", "past_due", "failed", "pending_generation"].includes(inv.status)) {
        await setInvoiceStatus(inv, "voided", "Voided on Whop", { voided_at: new Date().toISOString() }, `voided:${p.id}`);
      }
      break;
    }
    case "refunded":
    case "partially_refunded":
      await applyRefund(link, p, status === "refunded", tx);
      break;
    case "disputed":
      await applyDispute(link, p);
      break;
    case "pending":
    default:
      await logInvoiceEvent({ invoiceId: inv.id, type: "payment_pending", dedupeKey: `pending:${p.id}:${p.substatus ?? ""}`, data: { substatus: p.substatus } });
  }
  return result;
}

/**
 * Mark the invoice paid and provision access. Safe to call repeatedly: the
 * first call claims the invoice; later calls only complete any step a crash
 * may have interrupted.
 */
export async function fulfillInvoice(link: InvoiceLink, p: Whop.Payment, opts: { transactionId: string; overrideBy?: string | null }) {
  const admin = db();
  const facts = paymentFacts(p);
  const paidAt = p.paid_at ? new Date(p.paid_at) : new Date();
  const claimable = opts.overrideBy ? ["awaiting_payment", "past_due", "failed", "pending_generation", "under_review"] : ["awaiting_payment", "past_due", "failed", "pending_generation"];

  const { data: claimed } = await admin
    .from("custom_invoices")
    .update({
      status: "paid",
      status_reason: opts.overrideBy ? "Approved by an administrator after review" : null,
      paid_at: paidAt.toISOString(),
      paid_amount_minor: facts.totalMinor,
      paid_tax_minor: facts.taxMinor,
      last_synced_at: new Date().toISOString(),
    })
    .eq("id", link.invoice.id)
    .in("status", claimable)
    .select("*")
    .maybeSingle();
  let inv = (claimed as CustomInvoiceRow | null) ?? null;
  if (inv) {
    await logInvoiceEvent({
      invoiceId: inv.id,
      type: "paid",
      oldStatus: link.invoice.status,
      newStatus: "paid",
      actorId: opts.overrideBy ?? null,
      dedupeKey: `paid:${inv.id}`,
      data: { whop_payment_id: p.id, total: facts.totalMinor, tax: facts.taxMinor, currency: facts.currency },
    });
  } else {
    const { data } = await admin.from("custom_invoices").select("*").eq("id", link.invoice.id).single();
    inv = data as CustomInvoiceRow;
    if (inv.status !== "paid") return; // refunded / under review / closed: nothing to provision
  }
  await admin.from("whop_invoice_mappings").update({ provider_status: "paid", whop_payment_id: p.id, whop_membership_id: link.mapping.whop_membership_id ?? p.membership_id ?? null, last_synced_at: new Date().toISOString() }).eq("id", link.mapping.id);
  // A paid payment link stops working (its variant also had stock 1).
  if (link.mapping.whop_checkout_configuration_id && link.mapping.provider_status !== "paid") {
    await closeCheckoutOnly(link.mapping.whop_checkout_configuration_id);
  }

  // --- Package (one per invoice) ------------------------------------------------
  const recurring = inv.billing_type === "recurring";
  const contractEnd = recurring ? contractEndsAt(paidAt, inv.billing_interval_days ?? 30, inv.billing_cycles) : null;
  const window = recurring
    ? { startsAt: paidAt, expiresAt: new Date(paidAt.getTime() + ((inv.billing_interval_days ?? 30) + inv.grace_period_days) * DAY_MS) }
    : oneTimeAccessWindow({ accessMode: (inv.access_mode ?? "days") as "days", accessDurationDays: inv.access_duration_days, accessEndAt: inv.access_end_at ? new Date(inv.access_end_at) : null }, paidAt);
  const expiresAt = contractEnd && window.expiresAt && window.expiresAt > contractEnd ? contractEnd : window.expiresAt;

  await admin.from("invoice_entitlements").upsert(
    {
      invoice_id: inv.id,
      company_id: inv.invoice_type === "company" ? inv.company_id : null,
      user_id: inv.invoice_type === "individual" ? inv.customer_user_id : null,
      beneficiary_email: inv.invoice_type === "individual" ? inv.customer_email : null,
      entitlement_type: recurring ? "subscription" : "one_time",
      course_selection_mode: inv.course_selection_mode,
      included_course_ids: inv.course_ids,
      includes_future_courses: inv.includes_future_courses,
      starts_at: window.startsAt.toISOString(),
      expires_at: expiresAt ? expiresAt.toISOString() : null,
      contract_ends_at: contractEnd ? contractEnd.toISOString() : null,
      grace_period_days: inv.grace_period_days,
      subscription_status: recurring ? "active" : null,
      whop_membership_id: link.mapping.whop_membership_id ?? p.membership_id ?? null,
      whop_payment_id: p.id,
      status: "active",
      status_reason: `Paid invoice ${inv.invoice_number}`,
    },
    { onConflict: "invoice_id", ignoreDuplicates: true },
  );
  let ent = (await admin.from("invoice_entitlements").select("*").eq("invoice_id", inv.id).single()).data as InvoiceEntitlementRow;
  const pkg = () => describePackage(inv!, ent);

  // --- Beneficiaries -------------------------------------------------------------
  if (inv.invoice_type === "individual") {
    let userId = inv.customer_user_id;
    if (!userId) {
      const { data: profile } = await admin.from("profile_private").select("user_id").eq("email", inv.customer_email).maybeSingle();
      userId = (profile?.user_id as string | undefined) ?? null;
    }
    if (userId) {
      if (!ent.user_id) {
        await admin.from("invoice_entitlements").update({ user_id: userId }).eq("id", ent.id).is("user_id", null);
        await admin.from("custom_invoices").update({ customer_user_id: userId }).eq("id", inv.id);
        await admin.from("payment_transactions").update({ user_id: userId }).eq("id", opts.transactionId).is("user_id", null);
        ent = { ...ent, user_id: userId };
      }
      const covered = await syncPackageAccess(ent.id);
      if (covered.length) await welcomeCoveredLearners([userId], pkg(), { dedupe: `package:${ent.id}` });
    } else {
      await createAccessInvitation({ kind: "purchase_activation", invoiceId: inv.id, email: inv.customer_email, fullName: inv.customer_name, invitedByRole: "system" });
      await logInvoiceEvent({ invoiceId: inv.id, type: "activation_invited", dedupeKey: `activation:${inv.id}`, data: { email: inv.customer_email } });
    }
  } else {
    let companyId = inv.company_id;
    if (!companyId) {
      const { data: company, error } = await admin
        .from("companies")
        .insert({
          name: inv.company_name ?? inv.customer_name,
          description: inv.company_description,
          services_description: inv.company_services,
          primary_contact_email: inv.customer_email,
          primary_contact_name: inv.customer_name,
          primary_contact_phone: inv.customer_phone,
          seat_limit: inv.seat_limit,
          created_by: inv.created_by,
        })
        .select("id")
        .single();
      if (error || !company) throw new Error(`company insert failed: ${error?.message}`);
      // Only one concurrent run may attach its company; a loser adopts the winner's.
      const { data: attached } = await admin.from("custom_invoices").update({ company_id: company.id }).eq("id", inv.id).is("company_id", null).select("company_id").maybeSingle();
      if (attached) {
        companyId = company.id;
        await logCompanyAudit({ companyId, action: "company_created", performerRole: "system", next: { from_invoice: inv.invoice_number } });
      } else {
        await admin.from("companies").update({ status: "archived", internal_notes: `Duplicate created while provisioning ${inv.invoice_number}; superseded.` }).eq("id", company.id);
        companyId = (await admin.from("custom_invoices").select("company_id").eq("id", inv.id).single()).data!.company_id!;
      }
      inv = { ...inv, company_id: companyId };
    } else if (inv.seat_limit) {
      await admin.from("companies").update({ seat_limit: inv.seat_limit }).eq("id", companyId).is("seat_limit", null);
    }
    if (!ent.company_id) {
      await admin.from("invoice_entitlements").update({ company_id: companyId }).eq("id", ent.id).is("company_id", null);
      ent = { ...ent, company_id: companyId };
    }
    await logCompanyAudit({ companyId, action: "package_activated", performerRole: "system", next: { invoice: inv.invoice_number, expires_at: ent.expires_at } }).catch(() => undefined);

    const { data: company } = await admin.from("companies").select("*").eq("id", companyId).single();
    let contactUserId = company!.primary_contact_user_id as string | null;
    if (!contactUserId) {
      const { data: profile } = await admin.from("profile_private").select("user_id").eq("email", company!.primary_contact_email).maybeSingle();
      contactUserId = (profile?.user_id as string | undefined) ?? null;
      if (contactUserId) await admin.from("companies").update({ primary_contact_user_id: contactUserId }).eq("id", companyId).is("primary_contact_user_id", null);
    }
    if (contactUserId) {
      await addCompanyMember({ companyId, userId: contactUserId, canInviteMembers: true, canViewBilling: true, performerRole: "system" });
      await admin.from("payment_transactions").update({ user_id: contactUserId }).eq("id", opts.transactionId).is("user_id", null);
      const d = pkg();
      await notify(contactUserId, {
        category: "billing",
        type: "company_access_activated",
        title: `${company!.name}'s access is active`,
        body: d.accessSummary,
        url: "/learn/company",
        email: {
          templateKey: "company.access_activated",
          idempotencyKey: `company-activated:${ent.id}`,
          payload: { company_name: company!.name, course_list: d.courseList, access_summary: d.accessSummary, cta_url: appUrl("/learn/company") },
        },
      });
    } else {
      await createAccessInvitation({
        kind: "company_contact",
        companyId,
        email: company!.primary_contact_email,
        fullName: company!.primary_contact_name,
        canInviteMembers: true,
        invitedByRole: "system",
      });
      await logInvoiceEvent({ invoiceId: inv.id, type: "contact_invited", dedupeKey: `contact-invite:${inv.id}`, data: { email: company!.primary_contact_email } });
    }
    await syncCompanyAccess(companyId);
  }

  // --- Recurring: take the live billing period from the membership ----------------
  const membershipId = link.mapping.whop_membership_id ?? p.membership_id;
  if (recurring && membershipId) {
    const { client } = await getWhopClient();
    const m = await client.memberships.retrieve({ id: membershipId });
    await applyCustomInvoiceMembership(m, { invoice: inv, mapping: { ...link.mapping, whop_membership_id: membershipId }, kind: "renewal" });
    ent = (await loadEntitlement(ent.id)) ?? ent;
  }

  // --- Confirmation (once) ------------------------------------------------------
  const d = describePackage(inv, ent);
  const total = facts.totalMinor !== null ? formatMinor(facts.totalMinor, facts.currency) : formatMinor(inv.amount_minor, inv.currency);
  await emailCustomer(inv, "invoice.payment_received", `invoice-paid:${inv.id}`, {
    access_summary: `${d.courseList ? `Courses: ${d.courseList}. ` : ""}${d.accessSummary}${inv.invoice_type === "company" ? " We've emailed the company contact how to invite the team." : ""}`,
    cta_url: appUrl(inv.invoice_type === "company" ? "/learn/company" : "/learn/courses"),
    details: [
      { label: "Invoice", value: inv.invoice_number },
      ...(link.mapping.whop_invoice_number ? [{ label: "Whop invoice", value: link.mapping.whop_invoice_number }] : []),
      { label: "Paid", value: `${formatDateTime(paidAt)} UTC` },
      { label: "Payment reference", value: p.id },
    ],
    line_items: [{ description: inv.invoice_description, amount: total }],
    total,
  });
  if (opts.overrideBy === undefined) {
    await alertAdmins(`Invoice ${inv.invoice_number} paid`, `${total} from ${inv.company_name ?? inv.customer_name}.`, inv.id, "invoice_paid");
  }
}

async function applyRenewalPayment(p: Whop.Payment, link: InvoiceLink, status: TransactionStatus, tx: { id: string; previousStatus: TransactionStatus | null; previousRefunded: number; refundedMinor: number }) {
  const inv = link.invoice;
  const membershipId = link.mapping.whop_membership_id ?? p.membership_id;
  if (status === "succeeded" && tx.previousStatus !== "succeeded") {
    const fresh = await logInvoiceEvent({ invoiceId: inv.id, type: "renewed", dedupeKey: `renewed:${p.id}`, data: { whop_payment_id: p.id, total: minorFrom(p.total, inv.currency) } });
    if (membershipId) {
      const { client } = await getWhopClient();
      const m = await client.memberships.retrieve({ id: membershipId });
      await applyCustomInvoiceMembership(m, link);
    }
    const ent = (await db().from("invoice_entitlements").select("*").eq("invoice_id", inv.id).maybeSingle()).data as InvoiceEntitlementRow | null;
    if (ent) await db().from("invoice_entitlements").update({ last_renewal_payment_id: p.id }).eq("id", ent.id);
    if (fresh && ent) {
      const d = describePackage(inv, ent);
      await emailCustomer(inv, "company.package_renewed", `package-renewed:${p.id}`, { package_name: d.packageName, access_summary: d.accessSummary, cta_url: appUrl(inv.invoice_type === "company" ? "/learn/company" : "/learn/courses") });
    }
  } else if (status === "failed") {
    await logInvoiceEvent({ invoiceId: inv.id, type: "renewal_failed", dedupeKey: `renewal-failed:${p.id}:${p.payments_failed ?? 0}`, data: { failure: p.failure_message } });
    await emailCustomer(inv, "billing.payment_failed", `invoice-renewal-failed:${p.id}:${p.payments_failed ?? 0}`, {
      product_name: inv.invoice_description,
      failure_reason: p.failure_message ? `The provider said: ${p.failure_message}` : "",
      cta_url: p.recovery_url ?? appUrl("/"),
    });
    if (membershipId) {
      const { client } = await getWhopClient();
      await applyCustomInvoiceMembership(await client.memberships.retrieve({ id: membershipId }), link);
    }
  } else if (status === "refunded" || status === "partially_refunded") {
    await applyRefund(link, p, status === "refunded", tx);
  } else if (status === "disputed") {
    await applyDispute(link, p);
  }
}

// ---------------------------------------------------------------------------
// Refunds and disputes
// ---------------------------------------------------------------------------

async function applyRefund(link: InvoiceLink, p: Whop.Payment, full: boolean, tx: { previousRefunded: number; refundedMinor: number }) {
  const inv = link.invoice;
  if (tx.refundedMinor <= tx.previousRefunded && ["refunded", "partially_refunded"].includes(inv.status)) return; // already applied
  const settings = await getInvoicingSettings();
  const ent = (await db().from("invoice_entitlements").select("*").eq("invoice_id", inv.id).maybeSingle()).data as InvoiceEntitlementRow | null;

  if (link.kind === "initial") {
    await setInvoiceStatus(inv, full ? "refunded" : "partially_refunded", full ? "Payment refunded" : "Payment partially refunded", { refunded_amount_minor: tx.refundedMinor }, `refund:${p.id}:${tx.refundedMinor}`);
  } else {
    await logInvoiceEvent({ invoiceId: inv.id, type: full ? "renewal_refunded" : "renewal_partially_refunded", dedupeKey: `refund:${p.id}:${tx.refundedMinor}`, data: { amount: tx.refundedMinor } });
  }
  if (ent) {
    const target = accessAfterRefund(full, { full: settings.refundFullPolicy, partial: settings.refundPartialPolicy });
    if (target !== "active") {
      await setPackageStatus({ entitlementId: ent.id, status: target, reason: full ? "Payment refunded" : "Payment partially refunded" });
    }
  }
  await emailCustomer(inv, "billing.refund_processed", `invoice-refund:${p.id}:${tx.refundedMinor}`, {
    product_name: inv.invoice_description,
    amount: formatMinor(tx.refundedMinor - tx.previousRefunded, inv.currency),
    cta_url: appUrl("/"),
  });
  await alertAdmins(`Refund recorded on ${inv.invoice_number}`, `${formatMinor(tx.refundedMinor, inv.currency)} refunded${full ? " in full" : ""}.`, inv.id, "invoice_refunded");
}

async function applyDispute(link: InvoiceLink, p: Whop.Payment) {
  const inv = link.invoice;
  const lost = (p.substatus ?? "").toLowerCase().endsWith("_lost");
  const settings = await getInvoicingSettings();
  const ent = (await db().from("invoice_entitlements").select("*").eq("invoice_id", inv.id).maybeSingle()).data as InvoiceEntitlementRow | null;
  const fresh = await logInvoiceEvent({ invoiceId: inv.id, type: lost ? "dispute_lost" : "disputed", dedupeKey: `dispute:${p.id}:${p.substatus ?? ""}`, data: { substatus: p.substatus } });
  if (link.kind === "initial" && inv.status !== "under_review") {
    await setInvoiceStatus(inv, "under_review", lost ? "Chargeback lost" : "Payment disputed", {}, `dispute-status:${p.id}`);
  }
  if (ent) {
    if (lost) await setPackageStatus({ entitlementId: ent.id, status: "revoked", reason: "Chargeback lost" });
    else if (settings.disputePolicy === "suspend") await setPackageStatus({ entitlementId: ent.id, status: "suspended", reason: "Payment disputed" });
  }
  if (fresh) await alertAdmins(`Payment dispute on ${inv.invoice_number}`, lost ? "The chargeback was lost; access was revoked." : "Access is paused while the dispute is open.", inv.id, "invoice_disputed");
}

async function resolveDispute(link: InvoiceLink, outcome: "won") {
  const ent = (await db().from("invoice_entitlements").select("*").eq("invoice_id", link.invoice.id).maybeSingle()).data as InvoiceEntitlementRow | null;
  if (ent?.status === "suspended" && ent.status_reason === "Payment disputed") {
    await setPackageStatus({ entitlementId: ent.id, status: "active", reason: `Dispute ${outcome}` });
  }
  const { data: inv } = await db().from("custom_invoices").select("*").eq("id", link.invoice.id).single();
  if (inv?.status === "under_review" && (inv.status_reason === "Payment disputed")) {
    await setInvoiceStatus(inv as CustomInvoiceRow, "paid", "Dispute resolved in our favour", {}, `dispute-won:${link.invoice.id}`);
  }
}

// ---------------------------------------------------------------------------
// Subscriptions (memberships)
// ---------------------------------------------------------------------------

/**
 * Apply a recurring invoice's live membership state to its package. Access
 * follows Whop's current billing period (plus grace when past due), never a
 * count of past payments, so retries and out-of-order events converge on
 * the same result. A fixed-term contract caps the end date.
 */
export async function applyCustomInvoiceMembership(m: Whop.Membership, link: InvoiceLink): Promise<void> {
  const admin = db();
  if (link.mapping.whop_membership_id !== m.id) {
    await admin.from("whop_invoice_mappings").update({ whop_membership_id: m.id }).eq("id", link.mapping.id).is("whop_membership_id", null);
  }
  const { data: invRow } = await admin.from("custom_invoices").select("*").eq("id", link.invoice.id).single();
  const inv = invRow as CustomInvoiceRow;
  // Before the invoice is paid (Whop drafts the membership on issue) or after
  // a refund/dispute, membership events never create or restore access.
  if (!["paid", "partially_refunded"].includes(inv.status)) {
    await logInvoiceEvent({ invoiceId: inv.id, type: "membership_seen", dedupeKey: `membership:${m.id}:${m.status}:${inv.status}`, data: { membership_status: m.status } });
    return;
  }
  const ent = (await admin.from("invoice_entitlements").select("*").eq("invoice_id", inv.id).maybeSingle()).data as InvoiceEntitlementRow | null;
  if (!ent) return;

  const status = normalizeMembershipStatus(m.status);
  const periodEnd = m.current_period_end ?? m.expires_at;
  const target = entitlementForMembership({ status, cancelAtPeriodEnd: m.cancel_at_period_end, currentPeriodEnd: periodEnd ? new Date(periodEnd) : null }, ent.grace_period_days);
  let expiresAt = target.expiresAt;
  let nextStatus: InvoiceEntitlementRow["status"] = target.status;
  let reason = target.reason;
  if (ent.contract_ends_at) {
    const cap = new Date(ent.contract_ends_at);
    if (!expiresAt || expiresAt > cap) expiresAt = cap;
    if (cap.getTime() <= Date.now() && nextStatus === "active") {
      nextStatus = "expired";
      reason = "Contract term ended";
    }
  }
  // Sticky states set by refunds, disputes or administrators are not undone here.
  if (ent.status === "revoked" || (ent.status === "suspended" && ent.status_reason !== "Membership not active yet")) {
    await admin.from("invoice_entitlements").update({ subscription_status: status, whop_membership_id: m.id }).eq("id", ent.id);
    return;
  }
  const startsAt = new Date(ent.starts_at);
  if (expiresAt && expiresAt <= startsAt) expiresAt = new Date(startsAt.getTime() + 1000);

  const changed = ent.status !== nextStatus || (ent.expires_at ?? null) !== (expiresAt ? expiresAt.toISOString() : null) || ent.subscription_status !== status;
  if (changed) {
    await admin
      .from("invoice_entitlements")
      .update({
        status: nextStatus,
        status_reason: reason,
        subscription_status: status,
        expires_at: expiresAt ? expiresAt.toISOString() : null,
        whop_membership_id: m.id,
        ...(expiresAt && ent.expires_at && expiresAt > new Date(ent.expires_at) ? { expiry_reminder_sent_at: null } : {}),
      })
      .eq("id", ent.id);
  }
  const covered = await syncPackageAccess(ent.id);
  if (covered.length && inv.company_id) await syncCompanyAccess(inv.company_id);

  // Lifecycle emails (each sent once).
  const d = describePackage(inv, { expires_at: expiresAt ? expiresAt.toISOString() : null, status: nextStatus });
  const canceling = m.cancel_at_period_end || status === "canceling" || status === "canceled";
  if (canceling && ent.subscription_status !== status) {
    await logInvoiceEvent({ invoiceId: inv.id, type: "subscription_cancelled", dedupeKey: `cancel:${m.id}:${periodEnd ?? "now"}`, data: { access_until: expiresAt?.toISOString() ?? null } });
    await emailCustomer(inv, "billing.cancellation_confirmation", `invoice-cancel:${m.id}:${periodEnd ?? "now"}`, {
      product_name: inv.invoice_description,
      access_until: nextStatus === "active" && expiresAt ? `Access continues until ${formatDate(expiresAt)}.` : "Access has ended.",
      cta_url: appUrl("/"),
    });
  }
  if (status === "past_due" && ent.subscription_status !== "past_due") {
    await logInvoiceEvent({ invoiceId: inv.id, type: "subscription_past_due", dedupeKey: `past-due:${m.id}:${periodEnd ?? ""}`, data: { grace_until: expiresAt?.toISOString() ?? null } });
  }
  if (nextStatus === "expired" && ent.status === "active") {
    await logInvoiceEvent({ invoiceId: inv.id, type: "package_ended", dedupeKey: `ended:${ent.id}:${status}`, data: { reason } });
    await emailCustomer(inv, "company.access_expired", `package-ended:${ent.id}:${expiresAt?.toISOString() ?? "now"}`, {
      package_name: d.packageName,
      ended_at: formatDate(expiresAt ?? new Date()),
      cta_url: appUrl("/contact"),
    });
  }
}
