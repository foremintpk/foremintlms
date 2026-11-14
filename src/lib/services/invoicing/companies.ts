import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserFacingError } from "@/lib/actions";
import { notify } from "@/lib/services/notifications";
import { appUrl } from "@/lib/env";
import type { SessionUser } from "@/lib/auth/session";
import type { Tables } from "@/types/database";
import { syncCompanyAccess, welcomeCoveredLearners, describePackage } from "./access";
import { logCompanyAudit, type CompanyActorRole } from "./events";
import { createAccessInvitation, revokeAccessInvitation, resendAccessInvitation, type AccessInvitationRow } from "./invitations";

/**
 * Company workspaces. Members are ordinary Student accounts; "company
 * manager" is a scoped capability on the membership row (can_invite_members),
 * never a platform role and never read from user metadata. Every check here
 * resolves the caller's rights from the database, so a request naming
 * another company's id gains nothing.
 */

export type CompanyRow = Tables<"companies">;
export type CompanyMemberRow = Tables<"company_members">;

const db = () => createAdminClient();

export interface CompanyMembership {
  companyId: string;
  companyName: string;
  memberId: string;
  canInviteMembers: boolean;
  canViewBilling: boolean;
  isPrimaryContact: boolean;
  companyStatus: string;
  accessStatus: string;
}

/** Companies the signed-in user actively belongs to. */
export async function getUserCompanies(userId: string): Promise<CompanyMembership[]> {
  const { data } = await db()
    .from("company_members")
    .select("id, company_id, can_invite_members, can_view_billing, companies!inner(id, name, status, access_status, primary_contact_user_id)")
    .eq("user_id", userId)
    .eq("membership_status", "active");
  return (data ?? [])
    .map((m) => {
      const c = m.companies as unknown as { id: string; name: string; status: string; access_status: string; primary_contact_user_id: string | null };
      return {
        companyId: c.id,
        companyName: c.name,
        memberId: m.id,
        canInviteMembers: m.can_invite_members,
        canViewBilling: m.can_view_billing,
        isPrimaryContact: c.primary_contact_user_id === userId,
        companyStatus: c.status,
        accessStatus: c.access_status,
      };
    })
    .filter((c) => c.companyStatus !== "archived");
}

export type CompanyActor = { user: SessionUser; role: "admin" } | { user: SessionUser; role: "company_contact"; membership: CompanyMembership };

/**
 * Resolve how the caller may act on a company: as a Foremint admin, or as a
 * manager of that specific company. Throws otherwise.
 */
export async function resolveCompanyActor(user: SessionUser, companyId: string, opts: { asAdmin: boolean }): Promise<CompanyActor> {
  if (opts.asAdmin) {
    if (!user.roles.includes("admin")) throw new UserFacingError("Only administrators can do this.");
    return { user, role: "admin" };
  }
  const membership = (await getUserCompanies(user.id)).find((c) => c.companyId === companyId);
  if (!membership || !membership.canInviteMembers) throw new UserFacingError("You don't manage this company's team.");
  if (membership.companyStatus !== "active") throw new UserFacingError("This company's access is suspended. Contact Foremint Academy.");
  return { user, role: "company_contact", membership };
}

function actorRole(actor: CompanyActor): CompanyActorRole {
  return actor.role === "admin" ? "admin" : "company_contact";
}

export async function loadCompany(id: string): Promise<CompanyRow> {
  const { data } = await db().from("companies").select("*").eq("id", id).maybeSingle();
  if (!data) throw new UserFacingError("Company not found.");
  return data as CompanyRow;
}

async function seatUsage(companyId: string): Promise<number> {
  const admin = db();
  const [members, invites] = await Promise.all([
    admin.from("company_members").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("membership_status", "active"),
    admin.from("access_invitations").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "pending").gt("expires_at", new Date().toISOString()),
  ]);
  return (members.count ?? 0) + (invites.count ?? 0);
}

async function assertSeatAvailable(company: CompanyRow, extra = 1) {
  if (!company.seat_limit) return;
  const used = await seatUsage(company.id);
  if (used + extra > company.seat_limit) {
    throw new UserFacingError(`This company has used all ${company.seat_limit} seats (members plus pending invitations).`);
  }
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export async function inviteToCompany(
  actor: CompanyActor,
  companyId: string,
  input: { email: string; fullName?: string | null; canInviteMembers?: boolean },
): Promise<AccessInvitationRow> {
  const company = await loadCompany(companyId);
  if (company.status !== "active") throw new UserFacingError("This company is suspended or archived, so it can't invite people.");
  // Company managers may only invite ordinary members; manager rights are granted by admins.
  const canInvite = actor.role === "admin" ? Boolean(input.canInviteMembers) : false;
  if (actor.role === "company_contact") {
    const { data: invoices } = await db().from("custom_invoices").select("allow_contact_invites").eq("company_id", companyId).eq("status", "paid");
    if (invoices && invoices.length > 0 && invoices.every((i) => !i.allow_contact_invites)) {
      throw new UserFacingError("Invitations for this company are handled by Foremint Academy. Contact us to add people.");
    }
  }

  const emailAddr = input.email.trim().toLowerCase();
  const { data: existingUser } = await db().from("profile_private").select("user_id").eq("email", emailAddr).maybeSingle();
  if (existingUser) {
    const { data: member } = await db()
      .from("company_members")
      .select("membership_status")
      .eq("company_id", companyId)
      .eq("user_id", existingUser.user_id)
      .maybeSingle();
    if (member?.membership_status === "active") throw new UserFacingError("This person is already a member of the company.");
  }
  await assertSeatAvailable(company);

  const { invitation } = await createAccessInvitation(
    {
      kind: "company_member",
      companyId,
      email: emailAddr,
      fullName: input.fullName ?? null,
      canInviteMembers: canInvite,
      invitedBy: actor.user.id,
      invitedByRole: actor.role === "admin" ? "admin" : "company",
    },
    actor.user.fullName || actor.user.displayName,
  );
  await logCompanyAudit({
    companyId,
    action: "member_invited",
    performedBy: actor.user.id,
    performerRole: actorRole(actor),
    next: { email: emailAddr, can_invite_members: canInvite },
  });
  return invitation;
}

async function assertInvitationOfCompany(companyId: string, invitationId: string): Promise<AccessInvitationRow> {
  const { data } = await db().from("access_invitations").select("*").eq("id", invitationId).eq("company_id", companyId).maybeSingle();
  if (!data) throw new UserFacingError("Invitation not found.");
  return data as AccessInvitationRow;
}

export async function resendCompanyInvitation(actor: CompanyActor, companyId: string, invitationId: string) {
  await assertInvitationOfCompany(companyId, invitationId);
  const row = await resendAccessInvitation(invitationId, actor.user.fullName || actor.user.displayName);
  await logCompanyAudit({ companyId, action: "invitation_resent", performedBy: actor.user.id, performerRole: actorRole(actor), next: { email: row.email } });
  return row;
}

export async function revokeCompanyInvitation(actor: CompanyActor, companyId: string, invitationId: string) {
  await assertInvitationOfCompany(companyId, invitationId);
  const row = await revokeAccessInvitation(invitationId, actor.user.id);
  await logCompanyAudit({ companyId, action: "invitation_revoked", performedBy: actor.user.id, performerRole: actorRole(actor), previous: { email: row.email } });
  return row;
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

/**
 * Add (or re-activate) a member and give them the company's package. Used
 * by invitation acceptance and by payment provisioning for an existing
 * primary contact. Idempotent.
 */
export async function addCompanyMember(input: {
  companyId: string;
  userId: string;
  canInviteMembers?: boolean;
  canViewBilling?: boolean;
  invitationId?: string | null;
  performedBy?: string | null;
  performerRole: CompanyActorRole;
  enforceSeats?: boolean;
}): Promise<{ member: CompanyMemberRow; newlyCovered: boolean }> {
  const admin = db();
  const company = await loadCompany(input.companyId);
  if (company.status === "archived") throw new UserFacingError("This company is no longer active.");
  const { data: existing } = await admin.from("company_members").select("*").eq("company_id", input.companyId).eq("user_id", input.userId).maybeSingle();
  if (input.enforceSeats && existing?.membership_status !== "active" && company.seat_limit) {
    const { count } = await admin.from("company_members").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("membership_status", "active");
    if ((count ?? 0) >= company.seat_limit) throw new UserFacingError("This company has no free seats. Ask your company contact or Foremint Academy.");
  }

  const values = {
    company_id: input.companyId,
    user_id: input.userId,
    membership_status: "active",
    can_invite_members: Boolean(input.canInviteMembers) || Boolean(existing?.can_invite_members && existing.membership_status === "active"),
    can_view_billing: Boolean(input.canViewBilling) || Boolean(existing?.can_view_billing && existing.membership_status === "active"),
    invitation_id: input.invitationId ?? existing?.invitation_id ?? null,
    removed_at: null,
    removed_by: null,
    removal_reason: null,
    ...(existing?.membership_status === "active" ? {} : { joined_at: new Date().toISOString() }),
  };
  const { data, error } = await admin.from("company_members").upsert(values, { onConflict: "company_id,user_id" }).select("*").single();
  if (error || !data) throw new Error(`member upsert failed: ${error?.message}`);

  const covered = await syncCompanyAccess(input.companyId);
  if (existing?.membership_status !== "active") {
    await logCompanyAudit({
      companyId: input.companyId,
      action: existing ? "member_reactivated" : "member_added",
      affectedUserId: input.userId,
      performedBy: input.performedBy ?? null,
      performerRole: input.performerRole,
      next: { can_invite_members: values.can_invite_members, invitation_id: values.invitation_id },
    });
  }
  return { member: data as CompanyMemberRow, newlyCovered: covered.includes(input.userId) };
}

async function loadMember(companyId: string, memberId: string): Promise<CompanyMemberRow> {
  const { data } = await db().from("company_members").select("*").eq("id", memberId).eq("company_id", companyId).maybeSingle();
  if (!data) throw new UserFacingError("Member not found.");
  return data as CompanyMemberRow;
}

/**
 * Remove a member: their company-derived access ends immediately (courses
 * they bought themselves are untouched; their progress is kept).
 */
export async function removeCompanyMember(actor: CompanyActor, companyId: string, memberId: string, reason: string | null) {
  const company = await loadCompany(companyId);
  const member = await loadMember(companyId, memberId);
  if (member.membership_status !== "active") throw new UserFacingError("This person has already been removed.");
  if (company.primary_contact_user_id === member.user_id) {
    throw new UserFacingError("Change the primary contact before removing this person.");
  }
  if (actor.role === "company_contact") {
    if (member.user_id === actor.user.id) throw new UserFacingError("You can't remove yourself. Contact Foremint Academy.");
    if (member.can_invite_members) throw new UserFacingError("Only Foremint Academy can remove another team manager.");
  }
  const { error } = await db()
    .from("company_members")
    .update({ membership_status: "removed", removed_at: new Date().toISOString(), removed_by: actor.user.id, removal_reason: reason, can_invite_members: false, can_view_billing: false })
    .eq("id", member.id)
    .eq("membership_status", "active");
  if (error) throw new Error(`member removal failed: ${error.message}`);
  await syncCompanyAccess(companyId);
  await logCompanyAudit({
    companyId,
    action: "member_removed",
    affectedUserId: member.user_id,
    performedBy: actor.user.id,
    performerRole: actorRole(actor),
    reason,
    previous: { membership_status: "active", can_invite_members: member.can_invite_members },
    next: { membership_status: "removed" },
  });
  await notify(member.user_id, {
    category: "billing",
    type: "company_access_removed",
    title: `Your ${company.name} access has ended`,
    body: "Your own account, progress and personal purchases are not affected.",
    url: "/learn/courses",
    email: {
      templateKey: "company.member_removed",
      idempotencyKey: `company-removed:${member.id}:${Date.now()}`,
      payload: { company_name: company.name, cta_url: appUrl("/learn/courses") },
    },
  });
}

/** Admin only: grant or remove the team-management capability. */
export async function setMemberManager(actorId: string, companyId: string, memberId: string, canInvite: boolean, reason: string | null) {
  const company = await loadCompany(companyId);
  const member = await loadMember(companyId, memberId);
  if (!canInvite && company.primary_contact_user_id === member.user_id) throw new UserFacingError("The primary contact always manages the team.");
  await db().from("company_members").update({ can_invite_members: canInvite, can_view_billing: canInvite ? member.can_view_billing : false }).eq("id", member.id);
  await logCompanyAudit({
    companyId,
    action: canInvite ? "manager_granted" : "manager_revoked",
    affectedUserId: member.user_id,
    performedBy: actorId,
    performerRole: "admin",
    reason,
    previous: { can_invite_members: member.can_invite_members },
    next: { can_invite_members: canInvite },
  });
}

/** Admin only: make another active member the primary contact. */
export async function changePrimaryContact(actorId: string, companyId: string, memberId: string, reason: string) {
  const company = await loadCompany(companyId);
  const member = await loadMember(companyId, memberId);
  if (member.membership_status !== "active") throw new UserFacingError("Choose an active member.");
  const { data: email } = await db().from("profile_private").select("email").eq("user_id", member.user_id).single();
  const { data: profile } = await db().from("profiles").select("full_name").eq("id", member.user_id).single();
  await db()
    .from("companies")
    .update({ primary_contact_user_id: member.user_id, primary_contact_email: email!.email, primary_contact_name: profile?.full_name || null })
    .eq("id", companyId);
  await db().from("company_members").update({ can_invite_members: true, can_view_billing: true }).eq("id", member.id);
  await logCompanyAudit({
    companyId,
    action: "primary_contact_changed",
    affectedUserId: member.user_id,
    performedBy: actorId,
    performerRole: "admin",
    reason,
    previous: { primary_contact_user_id: company.primary_contact_user_id, primary_contact_email: company.primary_contact_email },
    next: { primary_contact_user_id: member.user_id, primary_contact_email: email!.email },
  });
}

export async function setCompanySuspended(actorId: string, companyId: string, suspend: boolean, reason: string) {
  const company = await loadCompany(companyId);
  if (company.status === "archived") throw new UserFacingError("Archived companies can't be changed.");
  if ((company.status === "suspended") === suspend) return;
  await db()
    .from("companies")
    .update(suspend ? { status: "suspended", suspended_reason: reason, suspended_at: new Date().toISOString() } : { status: "active", suspended_reason: null, suspended_at: null })
    .eq("id", companyId);
  await syncCompanyAccess(companyId);
  await logCompanyAudit({
    companyId,
    action: suspend ? "company_suspended" : "company_reactivated",
    performedBy: actorId,
    performerRole: "admin",
    reason,
    previous: { status: company.status },
    next: { status: suspend ? "suspended" : "active" },
  });
}

export async function updateCompanyDetails(
  actorId: string,
  input: { companyId: string; name: string; description: string | null; servicesDescription: string | null; seatLimit: number | null; internalNotes: string | null; reason?: string | null },
) {
  const company = await loadCompany(input.companyId);
  if (input.seatLimit) {
    const { count } = await db().from("company_members").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("membership_status", "active");
    if ((count ?? 0) > input.seatLimit) throw new UserFacingError(`The company already has ${count} active members. Remove people first or choose a higher limit.`);
  }
  const next = {
    name: input.name,
    description: input.description,
    services_description: input.servicesDescription,
    seat_limit: input.seatLimit,
    internal_notes: input.internalNotes,
  };
  await db().from("companies").update(next).eq("id", company.id);
  await logCompanyAudit({
    companyId: company.id,
    action: "company_updated",
    performedBy: actorId,
    performerRole: "admin",
    reason: input.reason ?? null,
    previous: { name: company.name, seat_limit: company.seat_limit },
    next: { name: input.name, seat_limit: input.seatLimit },
  });
}

/** Admin: create an empty workspace (access arrives with a paid invoice). */
export async function createCompanyWorkspace(actorId: string, input: { name: string; contactEmail: string; contactName: string | null; description: string | null; servicesDescription: string | null; seatLimit: number | null }) {
  const { data, error } = await db()
    .from("companies")
    .insert({
      name: input.name,
      primary_contact_email: input.contactEmail.toLowerCase(),
      primary_contact_name: input.contactName,
      description: input.description,
      services_description: input.servicesDescription,
      seat_limit: input.seatLimit,
      created_by: actorId,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`company insert failed: ${error?.message}`);
  await logCompanyAudit({ companyId: data.id, action: "company_created", performedBy: actorId, performerRole: "admin", next: { name: input.name } });
  return data as CompanyRow;
}

/** Tell company managers someone joined (and welcome the new member). */
export async function announceMemberJoined(companyId: string, userId: string) {
  const admin = db();
  const [{ data: company }, { data: managers }, { data: profile }, { data: priv }, { data: ents }] = await Promise.all([
    admin.from("companies").select("name").eq("id", companyId).single(),
    admin.from("company_members").select("user_id").eq("company_id", companyId).eq("membership_status", "active").eq("can_invite_members", true),
    admin.from("profiles").select("full_name").eq("id", userId).single(),
    admin.from("profile_private").select("email").eq("user_id", userId).single(),
    admin
      .from("invoice_entitlements")
      .select("expires_at, status, custom_invoices!inner(invoice_description, company_name, invoice_type, selected_course_snapshot, includes_future_courses, billing_type)")
      .eq("company_id", companyId)
      .eq("status", "active")
      .limit(1),
  ]);
  const name = profile?.full_name || priv?.email || "A new member";
  const recipients = (managers ?? []).map((m) => m.user_id).filter((id) => id !== userId);
  await notify(recipients, {
    category: "system",
    type: "company_member_joined",
    title: `${name} joined ${company?.name ?? "your company"}`,
    url: "/learn/company",
    email: {
      templateKey: "company.member_joined",
      idempotencyKey: `company-joined:${companyId}:${userId}`,
      payload: { company_name: company?.name ?? "", member_name: name, member_email: priv?.email ?? "", cta_url: appUrl("/learn/company") },
    },
  });
  const ent = ents?.[0];
  if (ent) {
    const pkg = describePackage(ent.custom_invoices as unknown as Tables<"custom_invoices">, ent);
    await welcomeCoveredLearners([userId], pkg, { companyName: company?.name, dedupe: `company:${companyId}` });
  }
}
