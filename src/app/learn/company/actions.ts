"use server";

import { revalidatePath } from "next/cache";
import { assertUser } from "@/lib/auth/guards";
import { ok, runAction, type ActionResult } from "@/lib/actions";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { invitationActionSchema, inviteMemberSchema, memberActionSchema } from "@/lib/validation/invoicing";
import {
  inviteToCompany,
  removeCompanyMember,
  resendCompanyInvitation,
  resolveCompanyActor,
  revokeCompanyInvitation,
} from "@/lib/services/invoicing/companies";

/**
 * Company-manager actions for Student accounts. The caller's right to manage
 * the team is resolved from company_members for that company on every call
 * (never from the request or user metadata), and managers can only invite
 * ordinary members — never admins, teachers or other managers.
 */

export async function inviteCompanyMemberAction(input: { companyId: string; email: string; fullName?: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const data = inviteMemberSchema.parse({ ...input, canInviteMembers: false });
    await enforceRateLimit("company-invite", 30, 3600, user.id);
    const actor = await resolveCompanyActor(user, data.companyId, { asAdmin: false });
    await inviteToCompany(actor, data.companyId, { email: data.email, fullName: data.fullName, canInviteMembers: false });
    revalidatePath("/learn/company");
    return ok(null, `Invitation sent to ${data.email}`);
  });
}

export async function resendCompanyInviteAction(input: { companyId: string; invitationId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const data = invitationActionSchema.parse(input);
    await enforceRateLimit("company-invite-resend", 20, 3600, user.id);
    const actor = await resolveCompanyActor(user, data.companyId, { asAdmin: false });
    await resendCompanyInvitation(actor, data.companyId, data.invitationId);
    revalidatePath("/learn/company");
    return ok(null, "Invitation re-sent");
  });
}

export async function revokeCompanyInviteAction(input: { companyId: string; invitationId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const data = invitationActionSchema.parse(input);
    const actor = await resolveCompanyActor(user, data.companyId, { asAdmin: false });
    await revokeCompanyInvitation(actor, data.companyId, data.invitationId);
    revalidatePath("/learn/company");
    return ok(null, "Invitation withdrawn");
  });
}

export async function removeCompanyMemberAction(input: { companyId: string; memberId: string; reason?: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const data = memberActionSchema.parse(input);
    await enforceRateLimit("company-remove", 30, 3600, user.id);
    const actor = await resolveCompanyActor(user, data.companyId, { asAdmin: false });
    await removeCompanyMember(actor, data.companyId, data.memberId, data.reason ?? null);
    revalidatePath("/learn/company");
    return ok(null, "Removed from the company");
  });
}
