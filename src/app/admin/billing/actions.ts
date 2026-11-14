"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/guards";
import { ok, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { SETTINGS_TAG } from "@/lib/settings";
import type { Json } from "@/types/database";
import {
  bulkInviteSchema,
  changeContactSchema,
  companySettingsSchema,
  extendAccessSchema,
  idSchema,
  invitationActionSchema,
  inviteMemberSchema,
  invoicingSettingsSchema,
  memberActionSchema,
  reasonSchema,
} from "@/lib/validation/invoicing";
import {
  approveUnderReview,
  cancelInvoiceSubscription,
  createOrUpdateInvoice,
  generateWhopInvoice,
  loadInvoice,
  refreshInvoiceStatus,
  sendInvoiceEmail,
  voidCustomInvoice,
} from "@/lib/services/invoicing/invoices";
import { generateServiceSummary } from "@/lib/services/invoicing/summary";
import {
  changePrimaryContact,
  createCompanyWorkspace,
  inviteToCompany,
  removeCompanyMember,
  resendCompanyInvitation,
  resolveCompanyActor,
  revokeCompanyInvitation,
  setCompanySuspended,
  setMemberManager,
  updateCompanyDetails,
} from "@/lib/services/invoicing/companies";
import { extendPackage, setPackageStatus } from "@/lib/services/invoicing/access";
import { resendAccessInvitation } from "@/lib/services/invoicing/invitations";
import { INVOICING_SETTING_KEYS } from "@/lib/services/invoicing/settings";

function refreshInvoice(id?: string) {
  revalidatePath("/admin/billing", "layout");
  if (id) revalidatePath(`/admin/billing/invoices/${id}`);
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

const saveInvoiceSchema = z.object({
  form: z.unknown(),
  intent: z.enum(["draft", "generate"]),
  draftId: z.uuid().nullable().optional(),
  revisionOf: z.uuid().nullable().optional(),
  termsConfirmed: z.boolean().optional(),
});

export async function saveCustomInvoice(input: z.input<typeof saveInvoiceSchema>): Promise<ActionResult<{ id: string; status: string; generationError: string | null }>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = saveInvoiceSchema.parse(input);
    if (data.intent === "generate" && data.termsConfirmed !== true) throw new UserFacingError("Confirm the commercial terms before generating the invoice.");
    await enforceRateLimit("custom-invoice-save", 30, 600, user.id);
    const result = await createOrUpdateInvoice(user, data.form, { intent: data.intent, draftId: data.draftId ?? null, revisionOf: data.revisionOf ?? null });
    refreshInvoice(result.id);
    const message =
      data.intent === "draft" ? "Draft saved" : result.generationError ? "Invoice saved — Whop couldn't issue it yet" : "Whop invoice generated";
    return ok(result, message);
  });
}

export async function generateInvoiceAction(input: { id: string }): Promise<ActionResult<{ paymentUrl: string | null; error: string | null }>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const { id } = idSchema.parse(input);
    await enforceRateLimit("custom-invoice-generate", 20, 600, user.id);
    const result = await generateWhopInvoice(user, id);
    refreshInvoice(id);
    if (result.error) throw new UserFacingError(result.error);
    return ok({ paymentUrl: result.paymentUrl, error: null }, "Whop invoice generated");
  });
}

export async function voidInvoiceAction(input: { id: string; reason?: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const { id, reason } = reasonSchema.parse(input);
    await voidCustomInvoice(user, id, reason);
    refreshInvoice(id);
    return ok(null, "Invoice voided");
  });
}

export async function sendInvoiceEmailAction(input: { id: string }): Promise<ActionResult<{ channel: string }>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const { id } = idSchema.parse(input);
    await enforceRateLimit("custom-invoice-send", 20, 3600, user.id);
    const result = await sendInvoiceEmail(user, id, "link");
    await audit({ actor: user, action: "custom_invoice.sent", entityType: "custom_invoice", entityId: id, summary: `Sent invoice email via ${result.channel}` });
    refreshInvoice(id);
    return ok(result, result.channel === "whop" ? "Whop emailed the invoice" : "Invoice email sent");
  });
}

export async function refreshInvoiceAction(input: { id: string }): Promise<ActionResult<{ status: string }>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const { id } = idSchema.parse(input);
    await enforceRateLimit("custom-invoice-refresh", 30, 600, user.id);
    const status = await refreshInvoiceStatus(user, id);
    refreshInvoice(id);
    return ok({ status }, "Payment status refreshed from Whop");
  });
}

export async function approveReviewAction(input: { id: string; reason?: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const { id, reason } = reasonSchema.parse(input);
    await approveUnderReview(user, id, reason);
    refreshInvoice(id);
    return ok(null, "Payment approved and access provisioned");
  });
}

const cancelSubSchema = z.object({ id: z.uuid(), atPeriodEnd: z.boolean(), reason: z.string().trim().min(3, "Give a short reason").max(1000) });
export async function cancelSubscriptionAction(input: z.input<typeof cancelSubSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = cancelSubSchema.parse(input);
    await cancelInvoiceSubscription(user, data.id, data.atPeriodEnd, data.reason);
    refreshInvoice(data.id);
    return ok(null, data.atPeriodEnd ? "Subscription will end at the period end" : "Subscription cancelled");
  });
}

export async function regenerateSummaryAction(input: { id: string }): Promise<ActionResult<{ version: number }>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const { id } = idSchema.parse(input);
    const { invoice } = await loadInvoice(id);
    const { version } = await generateServiceSummary(invoice, user.id);
    await audit({ actor: user, action: "custom_invoice.summary_regenerated", entityType: "custom_invoice", entityId: id, summary: `Service summary v${version}` });
    refreshInvoice(id);
    return ok({ version }, `Service summary v${version} generated`);
  });
}

export async function resendActivationAction(input: { invitationId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const { invitationId } = z.object({ invitationId: z.uuid() }).parse(input);
    const row = await resendAccessInvitation(invitationId, user.fullName || user.displayName);
    await audit({ actor: user, action: "access_invitation.resent", entityType: "access_invitation", entityId: invitationId, summary: `Resent ${row.kind} invitation to ${row.email}` });
    revalidatePath("/admin/billing", "layout");
    return ok(null, "Invitation re-sent");
  });
}

// ---------------------------------------------------------------------------
// Packages
// ---------------------------------------------------------------------------

export async function extendAccessAction(input: z.input<typeof extendAccessSchema>): Promise<ActionResult<{ expiresAt: string }>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = extendAccessSchema.parse(input);
    const result = await extendPackage({
      entitlementId: data.entitlementId,
      mode: data.mode,
      days: data.days ?? null,
      date: data.date ? new Date(`${data.date}T23:59:59.000Z`) : null,
      reason: data.reason,
      actorId: user.id,
    });
    await audit({ actor: user, action: "package.extended", entityType: "invoice_entitlement", entityId: data.entitlementId, summary: `Access extended to ${result.next.slice(0, 10)}`, metadata: { ...result, reason: data.reason } });
    revalidatePath("/admin/billing", "layout");
    return ok({ expiresAt: result.next }, "Access extended");
  });
}

const packageStatusSchema = z.object({ entitlementId: z.uuid(), status: z.enum(["active", "suspended", "revoked"]), reason: z.string().trim().min(3, "Give a reason for the audit log").max(1000) });
export async function setPackageStatusAction(input: z.input<typeof packageStatusSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = packageStatusSchema.parse(input);
    const ent = await setPackageStatus({ entitlementId: data.entitlementId, status: data.status, reason: data.reason, actorId: user.id, actorRole: "admin" });
    if (!ent) throw new UserFacingError("Package not found.");
    await audit({ actor: user, action: `package.${data.status}`, entityType: "invoice_entitlement", entityId: data.entitlementId, summary: `Package ${data.status}`, metadata: { reason: data.reason } });
    revalidatePath("/admin/billing", "layout");
    return ok(null, data.status === "active" ? "Access restored" : data.status === "suspended" ? "Access suspended" : "Access revoked");
  });
}

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

const createCompanySchema = z.object({
  name: z.string().trim().min(1, "Enter the company name").max(200),
  contactEmail: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
  contactName: z.string().trim().max(160).optional().transform((v) => v || null),
  description: z.string().trim().max(4000).optional().transform((v) => v || null),
  servicesDescription: z.string().trim().max(4000).optional().transform((v) => v || null),
  seatLimit: z.coerce.number().int().min(1).max(100000).nullable().optional(),
});
export async function createCompanyAction(input: z.input<typeof createCompanySchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = createCompanySchema.parse(input);
    const company = await createCompanyWorkspace(user.id, { ...data, seatLimit: data.seatLimit ?? null });
    await audit({ actor: user, action: "company.created", entityType: "company", entityId: company.id, summary: `Created company ${company.name}` });
    revalidatePath("/admin/billing", "layout");
    return ok({ id: company.id }, "Company created");
  });
}

export async function updateCompanyAction(input: z.input<typeof companySettingsSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = companySettingsSchema.parse(input);
    await updateCompanyDetails(user.id, { ...data, seatLimit: data.seatLimit ?? null, reason: data.reason ?? null });
    await audit({ actor: user, action: "company.updated", entityType: "company", entityId: data.companyId, summary: `Updated ${data.name}` });
    revalidatePath(`/admin/billing/companies/${data.companyId}`);
    return ok(null, "Company saved");
  });
}

const suspendSchema = z.object({ id: z.uuid(), suspend: z.boolean(), reason: z.string().trim().min(3, "Give a reason for the audit log").max(1000) });
export async function setCompanySuspendedAction(input: z.input<typeof suspendSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = suspendSchema.parse(input);
    await setCompanySuspended(user.id, data.id, data.suspend, data.reason);
    await audit({ actor: user, action: data.suspend ? "company.suspended" : "company.reactivated", entityType: "company", entityId: data.id, summary: data.reason });
    revalidatePath("/admin/billing", "layout");
    return ok(null, data.suspend ? "Company access suspended" : "Company access restored");
  });
}

export async function changeContactAction(input: z.input<typeof changeContactSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = changeContactSchema.parse(input);
    await changePrimaryContact(user.id, data.companyId, data.memberId, data.reason);
    await audit({ actor: user, action: "company.contact_changed", entityType: "company", entityId: data.companyId, summary: data.reason });
    revalidatePath(`/admin/billing/companies/${data.companyId}`);
    return ok(null, "Primary contact changed");
  });
}

const managerSchema = z.object({ companyId: z.uuid(), memberId: z.uuid(), canInvite: z.boolean(), reason: z.string().trim().max(1000).optional() });
export async function setManagerAction(input: z.input<typeof managerSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = managerSchema.parse(input);
    await setMemberManager(user.id, data.companyId, data.memberId, data.canInvite, data.reason ?? null);
    revalidatePath(`/admin/billing/companies/${data.companyId}`);
    return ok(null, data.canInvite ? "Team management granted" : "Team management removed");
  });
}

export async function adminInviteMemberAction(input: z.input<typeof inviteMemberSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = inviteMemberSchema.parse(input);
    await enforceRateLimit("company-invite-admin", 200, 3600, user.id);
    const actor = await resolveCompanyActor(user, data.companyId, { asAdmin: true });
    await inviteToCompany(actor, data.companyId, data);
    revalidatePath(`/admin/billing/companies/${data.companyId}`);
    return ok(null, `Invitation sent to ${data.email}`);
  });
}

export async function adminBulkInviteAction(input: z.input<typeof bulkInviteSchema>): Promise<ActionResult<{ sent: number; skipped: { email: string; reason: string }[] }>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = bulkInviteSchema.parse(input);
    const emails = [...new Set(data.emails.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))].slice(0, 200);
    await enforceRateLimit("company-invite-admin", 200, 3600, user.id);
    const actor = await resolveCompanyActor(user, data.companyId, { asAdmin: true });
    let sent = 0;
    const skipped: { email: string; reason: string }[] = [];
    for (const email of emails) {
      if (!z.email().safeParse(email).success) {
        skipped.push({ email, reason: "Not a valid email address" });
        continue;
      }
      try {
        await inviteToCompany(actor, data.companyId, { email });
        sent++;
      } catch (err) {
        skipped.push({ email, reason: err instanceof UserFacingError ? err.message : "Could not invite" });
      }
    }
    revalidatePath(`/admin/billing/companies/${data.companyId}`);
    return ok({ sent, skipped }, `${sent} invitation${sent === 1 ? "" : "s"} sent`);
  });
}

export async function adminResendInvitationAction(input: z.input<typeof invitationActionSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = invitationActionSchema.parse(input);
    const actor = await resolveCompanyActor(user, data.companyId, { asAdmin: true });
    await resendCompanyInvitation(actor, data.companyId, data.invitationId);
    revalidatePath(`/admin/billing/companies/${data.companyId}`);
    return ok(null, "Invitation re-sent");
  });
}

export async function adminRevokeInvitationAction(input: z.input<typeof invitationActionSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = invitationActionSchema.parse(input);
    const actor = await resolveCompanyActor(user, data.companyId, { asAdmin: true });
    await revokeCompanyInvitation(actor, data.companyId, data.invitationId);
    revalidatePath(`/admin/billing/companies/${data.companyId}`);
    return ok(null, "Invitation withdrawn");
  });
}

export async function adminRemoveMemberAction(input: z.input<typeof memberActionSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = memberActionSchema.parse(input);
    if (!data.reason || data.reason.length < 3) throw new UserFacingError("Give a reason for the audit log.");
    const actor = await resolveCompanyActor(user, data.companyId, { asAdmin: true });
    await removeCompanyMember(actor, data.companyId, data.memberId, data.reason);
    await audit({ actor: user, action: "company.member_removed", entityType: "company", entityId: data.companyId, summary: data.reason, metadata: { memberId: data.memberId } });
    revalidatePath(`/admin/billing/companies/${data.companyId}`);
    return ok(null, "Member removed");
  });
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function saveInvoicingSettings(input: z.input<typeof invoicingSettingsSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = invoicingSettingsSchema.parse(input);
    const rows = (Object.keys(INVOICING_SETTING_KEYS) as (keyof typeof INVOICING_SETTING_KEYS)[]).map((k) => ({
      key: INVOICING_SETTING_KEYS[k],
      value: data[k] as unknown as Json,
      updated_by: user.id,
    }));
    const { error } = await createAdminClient().from("platform_settings").upsert(rows, { onConflict: "key" });
    if (error) throw new Error(`settings save failed: ${error.message}`);
    await audit({ actor: user, action: "settings.updated", entityType: "platform_settings", entityId: "invoicing", summary: "Invoice settings", metadata: { values: data } });
    updateTag(SETTINGS_TAG);
    revalidatePath("/admin/billing/settings");
    return ok(null, "Invoice settings saved");
  });
}
