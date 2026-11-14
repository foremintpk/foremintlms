import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/services/notifications";
import { enqueueEmail } from "@/lib/services/email/outbox";
import { isWhopReady, getWhopClient } from "@/lib/services/payments/whop";
import { appUrl } from "@/lib/env";
import { firstName, formatDate } from "@/lib/format";
import { describePackage, syncPackageAccess, type InvoiceEntitlementRow } from "./access";
import { logInvoiceEvent } from "./events";
import { expireLapsedInvitations } from "./invitations";
import { applyCustomInvoiceMembership } from "./fulfillment";
import { refreshInvoiceStatus, sendInvoiceEmail } from "./invoices";
import { getInvoicingSettings } from "./settings";
import { archiveWhopProduct, closePaymentLink, voidWhopInvoice, type CustomInvoiceRow, type WhopInvoiceMappingRow } from "./whop-invoices";

/**
 * Daily/hourly upkeep for custom invoicing. Every step is idempotent (status
 * conditions and *_sent_at markers), so overlapping or repeated runs are
 * harmless. Access itself never depends on this job: every access check
 * compares expires_at with the current time.
 */

const DAY_MS = 86_400_000;
const db = () => createAdminClient();

type EntWithInvoice = InvoiceEntitlementRow & { custom_invoices: CustomInvoiceRow };

async function recipientsFor(ent: EntWithInvoice): Promise<{ userIds: string[]; contactEmail: string | null; contactName: string | null; contactUserId: string | null }> {
  const admin = db();
  if (ent.company_id) {
    const [{ data: company }, { data: members }] = await Promise.all([
      admin.from("companies").select("primary_contact_user_id, primary_contact_email, primary_contact_name").eq("id", ent.company_id).single(),
      admin.from("company_members").select("user_id").eq("company_id", ent.company_id).eq("membership_status", "active"),
    ]);
    return {
      userIds: (members ?? []).map((m) => m.user_id),
      contactEmail: company?.primary_contact_email ?? null,
      contactName: company?.primary_contact_name ?? null,
      contactUserId: company?.primary_contact_user_id ?? null,
    };
  }
  return { userIds: ent.user_id ? [ent.user_id] : [], contactEmail: ent.custom_invoices.customer_email, contactName: ent.custom_invoices.customer_name, contactUserId: ent.user_id };
}

/** Subscription packages close to (or past) their end: ask Whop for the live membership first. */
async function reconcileSubscriptionPackages(): Promise<number> {
  if (!(await isWhopReady())) return 0;
  const horizon = new Date(Date.now() + DAY_MS).toISOString();
  const { data } = await db()
    .from("invoice_entitlements")
    .select("*, custom_invoices!inner(*)")
    .eq("entitlement_type", "subscription")
    .in("status", ["active", "expired"])
    .not("whop_membership_id", "is", null)
    .lte("expires_at", horizon)
    .limit(50);
  let n = 0;
  const { client } = await getWhopClient();
  for (const ent of (data ?? []) as EntWithInvoice[]) {
    try {
      const { data: mapping } = await db().from("whop_invoice_mappings").select("*").eq("local_invoice_id", ent.invoice_id).single();
      const m = await client.memberships.retrieve({ id: ent.whop_membership_id! });
      await applyCustomInvoiceMembership(m, { invoice: ent.custom_invoices, mapping: mapping as WhopInvoiceMappingRow, kind: "renewal" });
      n++;
    } catch (err) {
      console.error("[invoicing] membership reconcile failed", ent.id, err);
    }
  }
  return n;
}

async function expirePackages(): Promise<number> {
  const admin = db();
  const now = new Date().toISOString();
  const { data } = await admin
    .from("invoice_entitlements")
    .update({ status: "expired", status_reason: "Access period ended" })
    .eq("status", "active")
    .lte("expires_at", now)
    .select("*, custom_invoices!inner(*)");
  const rows = (data ?? []) as EntWithInvoice[];
  for (const ent of rows) await syncPackageAccess(ent.id);

  // One "ended" message per package (members in-app, contact by email).
  const { data: unnotified } = await admin
    .from("invoice_entitlements")
    .select("*, custom_invoices!inner(*)")
    .eq("status", "expired")
    .is("expired_notified_at", null)
    .not("expires_at", "is", null)
    .lte("expires_at", now)
    .limit(200);
  for (const ent of (unnotified ?? []) as EntWithInvoice[]) {
    const { data: claimed } = await admin.from("invoice_entitlements").update({ expired_notified_at: new Date().toISOString() }).eq("id", ent.id).is("expired_notified_at", null).select("id").maybeSingle();
    if (!claimed) continue;
    const d = describePackage(ent.custom_invoices, ent);
    const r = await recipientsFor(ent);
    await notify(r.userIds, { category: "billing", type: "package_expired", title: `${d.packageName} has ended`, body: "Your progress and certificates are kept.", url: "/learn/courses" });
    if (r.contactEmail) {
      await enqueueEmail({
        templateKey: "company.access_expired",
        to: r.contactEmail,
        userId: r.contactUserId,
        idempotencyKey: `package-expired:${ent.id}:${ent.expires_at}`,
        payload: { first_name: firstName(r.contactName), package_name: d.packageName, ended_at: formatDate(ent.expires_at), cta_url: appUrl("/contact") },
      });
    }
    await logInvoiceEvent({ invoiceId: ent.invoice_id, type: "package_expired", dedupeKey: `expired:${ent.id}:${ent.expires_at}`, data: { expires_at: ent.expires_at } });
  }
  return rows.length;
}

async function remindExpiringPackages(days: number): Promise<number> {
  if (days <= 0) return 0;
  const admin = db();
  const now = new Date();
  const { data } = await admin
    .from("invoice_entitlements")
    .select("*, custom_invoices!inner(*)")
    .eq("status", "active")
    .is("expiry_reminder_sent_at", null)
    .gt("expires_at", now.toISOString())
    .lte("expires_at", new Date(now.getTime() + days * DAY_MS).toISOString())
    .limit(200);
  let sent = 0;
  for (const ent of (data ?? []) as EntWithInvoice[]) {
    // A live, auto-renewing subscription renews before it ends; don't alarm people.
    if (ent.entitlement_type === "subscription" && ent.subscription_status === "active" && !ent.contract_ends_at) continue;
    const { data: claimed } = await admin.from("invoice_entitlements").update({ expiry_reminder_sent_at: now.toISOString() }).eq("id", ent.id).is("expiry_reminder_sent_at", null).select("id").maybeSingle();
    if (!claimed) continue;
    const d = describePackage(ent.custom_invoices, ent);
    const r = await recipientsFor(ent);
    await notify(r.userIds, { category: "billing", type: "package_expiring", title: `${d.packageName} ends ${formatDate(ent.expires_at)}`, url: "/learn/courses" });
    if (r.contactEmail) {
      await enqueueEmail({
        templateKey: "company.access_expiring",
        to: r.contactEmail,
        userId: r.contactUserId,
        idempotencyKey: `package-expiring:${ent.id}:${ent.expires_at}`,
        payload: { first_name: firstName(r.contactName), package_name: d.packageName, ends_at: formatDate(ent.expires_at), cta_url: appUrl(ent.company_id ? "/learn/company" : "/learn/courses") },
      });
    }
    sent++;
  }
  return sent;
}

async function invoiceReminders(reminderDays: number, delivery: "foremint" | "whop"): Promise<{ reminders: number; pastDue: number }> {
  const admin = db();
  const now = new Date();
  let reminders = 0;
  let pastDue = 0;

  // Past due: open invoices whose due date has passed.
  const { data: overdue } = await admin
    .from("custom_invoices")
    .select("id, status, invoice_number, past_due_notified_at")
    .in("status", ["awaiting_payment", "failed"])
    .not("due_at", "is", null)
    .lt("due_at", now.toISOString())
    .limit(200);
  for (const inv of overdue ?? []) {
    const { data: moved } = await admin.from("custom_invoices").update({ status: "past_due" }).eq("id", inv.id).in("status", ["awaiting_payment", "failed"]).select("id").maybeSingle();
    if (!moved) continue;
    await logInvoiceEvent({ invoiceId: inv.id, type: "status_past_due", oldStatus: inv.status, newStatus: "past_due", dedupeKey: `past-due:${inv.id}` });
    // Whop emails its own reminders after the due date when it delivered the invoice.
    if (delivery === "foremint" && !inv.past_due_notified_at) {
      await sendInvoiceEmail(null, inv.id, "past_due").catch((err) => console.error("[invoicing] past-due email failed", inv.id, err));
    }
    pastDue++;
  }

  if (delivery === "foremint" && reminderDays > 0) {
    const { data: due } = await admin
      .from("custom_invoices")
      .select("id")
      .eq("status", "awaiting_payment")
      .is("reminder_sent_at", null)
      .gt("email_send_count", 0)
      .gt("due_at", now.toISOString())
      .lte("due_at", new Date(now.getTime() + reminderDays * DAY_MS).toISOString())
      .limit(200);
    for (const inv of due ?? []) {
      await sendInvoiceEmail(null, inv.id, "reminder").then(() => reminders++).catch((err) => console.error("[invoicing] reminder failed", inv.id, err));
    }
  }
  return { reminders, pastDue };
}

/** Payment links with an expiry date: void them on Whop so they stop working, then mark the invoice expired. */
async function expirePaymentLinks(): Promise<number> {
  const admin = db();
  const { data } = await admin
    .from("custom_invoices")
    .select("*, whop_invoice_mappings(*)")
    .in("status", ["awaiting_payment", "past_due", "failed"])
    .not("link_expires_at", "is", null)
    .lte("link_expires_at", new Date().toISOString())
    .limit(50);
  let n = 0;
  for (const row of data ?? []) {
    const { whop_invoice_mappings: maps, ...invRest } = row as CustomInvoiceRow & { whop_invoice_mappings: WhopInvoiceMappingRow[] | WhopInvoiceMappingRow | null };
    const mapping = Array.isArray(maps) ? maps[0] : maps;
    try {
      if (mapping && invRest.collection_method === "payment_link") {
        const status = await refreshInvoiceStatus(null, invRest.id);
        if (status === "paid" || status === "under_review") continue;
        const closed = await closePaymentLink(mapping);
        await admin.from("whop_invoice_mappings").update({ cleanup_status: closed ? "archived" : "archive_failed", provider_status: "void" }).eq("id", mapping.id);
      } else if (mapping?.whop_invoice_id) {
        // Refresh first: if it was paid in the meantime, the payment wins.
        const status = await refreshInvoiceStatus(null, invRest.id);
        if (status === "paid" || status === "under_review") continue;
        await voidWhopInvoice(mapping.whop_invoice_id);
        if (mapping.whop_product_id) {
          const archived = await archiveWhopProduct(mapping.whop_product_id);
          await admin.from("whop_invoice_mappings").update({ cleanup_status: archived ? "archived" : "archive_failed", provider_status: "void", checkout_link: null }).eq("id", mapping.id);
        }
      }
      const { data: moved } = await admin.from("custom_invoices").update({ status: "expired", status_reason: "The payment link expired" }).eq("id", invRest.id).in("status", ["awaiting_payment", "past_due", "failed"]).select("id").maybeSingle();
      if (moved) {
        await logInvoiceEvent({ invoiceId: invRest.id, type: "status_expired", oldStatus: invRest.status, newStatus: "expired", dedupeKey: `link-expired:${invRest.id}` });
        n++;
      }
    } catch (err) {
      console.error("[invoicing] link expiry failed", invRest.id, err);
    }
  }
  return n;
}

/** Backstop for missed webhooks: re-read open invoices from Whop. */
async function reconcileOpenInvoices(): Promise<number> {
  if (!(await isWhopReady())) return 0;
  const staleBefore = new Date(Date.now() - 3 * 3600_000).toISOString();
  const { data } = await db()
    .from("custom_invoices")
    .select("id")
    .in("status", ["awaiting_payment", "past_due", "failed"])
    .or(`last_synced_at.is.null,last_synced_at.lt.${staleBefore}`)
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(50);
  let n = 0;
  for (const inv of data ?? []) {
    try {
      await refreshInvoiceStatus(null, inv.id);
      n++;
    } catch (err) {
      console.error("[invoicing] reconcile failed", inv.id, err);
    }
  }
  return n;
}

export async function runInvoicingMaintenance() {
  const settings = await getInvoicingSettings();
  const invitationsExpired = await expireLapsedInvitations();
  const reconciled = await reconcileOpenInvoices();
  const subscriptions = await reconcileSubscriptionPackages();
  const packagesExpired = await expirePackages();
  const packageReminders = await remindExpiringPackages(settings.packageExpiryReminderDays);
  const links = await expirePaymentLinks();
  const invoices = await invoiceReminders(settings.paymentReminderDays, settings.delivery);
  return { invitationsExpired, reconciled, subscriptions, packagesExpired, packageReminders, linksExpired: links, ...invoices };
}
