import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserFacingError } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { logAuthEvent } from "@/lib/services/account";
import { describePackage, syncPackageAccess, welcomeCoveredLearners } from "./access";
import { addCompanyMember, announceMemberJoined, loadCompany } from "./companies";
import { logCompanyAudit, logInvoiceEvent } from "./events";
import { accessInvitationState, claimAccessInvitation, type AccessInvitationRow } from "./invitations";
import type { CustomInvoiceRow } from "./whop-invoices";

/**
 * Accepting an access invitation links the (existing or newly created)
 * Student account to the company or purchase. The account keeps its own
 * login, progress and history; access comes only from paid packages.
 */

export async function acceptAccessInvitation(row: AccessInvitationRow, user: { id: string; email: string }): Promise<{ redirectTo: string }> {
  const admin = createAdminClient();
  if (accessInvitationState(row) !== "valid") throw new UserFacingError("This invitation is no longer valid.");

  if (row.kind === "purchase_activation") {
    const invitation = await claimAccessInvitation(row, user);
    const { data: ent } = await admin.from("invoice_entitlements").select("*").eq("invoice_id", invitation.invoice_id!).maybeSingle();
    await admin.from("custom_invoices").update({ customer_user_id: user.id }).eq("id", invitation.invoice_id!).is("customer_user_id", null);
    await admin.from("payment_transactions").update({ user_id: user.id }).eq("custom_invoice_id", invitation.invoice_id!).is("user_id", null);
    if (ent) {
      await admin.from("invoice_entitlements").update({ user_id: user.id }).eq("id", ent.id).is("user_id", null);
      const covered = await syncPackageAccess(ent.id);
      const { data: inv } = await admin.from("custom_invoices").select("*").eq("id", invitation.invoice_id!).single();
      if (covered.length) await welcomeCoveredLearners([user.id], describePackage(inv as CustomInvoiceRow, ent), { dedupe: `package:${ent.id}` });
    }
    await logInvoiceEvent({ invoiceId: invitation.invoice_id!, type: "account_activated", dedupeKey: `activated:${invitation.invoice_id}`, data: { user_id: user.id } });
    await logAuthEvent({ userId: user.id, email: user.email, event: "invitation_accepted", metadata: { kind: row.kind } });
    return { redirectTo: "/learn/courses" };
  }

  const company = await loadCompany(row.company_id!);
  if (company.status !== "active") throw new UserFacingError("This company's access is paused. Contact your company contact or Foremint Academy.");
  const { data: existing } = await admin.from("company_members").select("membership_status").eq("company_id", company.id).eq("user_id", user.id).maybeSingle();
  if (row.kind === "company_member" && existing?.membership_status !== "active" && company.seat_limit) {
    const { count } = await admin.from("company_members").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("membership_status", "active");
    if ((count ?? 0) >= company.seat_limit) throw new UserFacingError("This company has no free seats right now. Ask your company contact.");
  }

  const invitation = await claimAccessInvitation(row, user);
  const isContact = row.kind === "company_contact";
  await addCompanyMember({
    companyId: company.id,
    userId: user.id,
    canInviteMembers: isContact || invitation.can_invite_members,
    canViewBilling: isContact,
    invitationId: invitation.id,
    performerRole: "system",
  });
  if (isContact && (!company.primary_contact_user_id || company.primary_contact_email.toLowerCase() === user.email.toLowerCase())) {
    await admin.from("companies").update({ primary_contact_user_id: user.id }).eq("id", company.id);
    await admin
      .from("payment_transactions")
      .update({ user_id: user.id })
      .is("user_id", null)
      .in("custom_invoice_id", ((await admin.from("custom_invoices").select("id").eq("company_id", company.id)).data ?? []).map((r) => r.id));
  }
  await logCompanyAudit({
    companyId: company.id,
    action: isContact ? "contact_joined" : "invitation_accepted",
    affectedUserId: user.id,
    performerRole: "system",
    next: { email: user.email, can_invite_members: isContact || invitation.can_invite_members },
  });
  await logAuthEvent({ userId: user.id, email: user.email, event: "invitation_accepted", metadata: { kind: row.kind, company_id: company.id } });
  await audit({ actor: null, action: "company.invitation_accepted", entityType: "company", entityId: company.id, summary: `${user.email} joined ${company.name}`, metadata: { kind: row.kind } });
  await announceMemberJoined(company.id, user.id);
  return { redirectTo: "/learn/company" };
}
