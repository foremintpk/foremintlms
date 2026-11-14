import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserFacingError } from "@/lib/actions";
import { appUrl } from "@/lib/env";
import { firstName, formatDate } from "@/lib/format";
import { randomToken, sha256 } from "@/lib/security/crypto";
import { enqueueEmail } from "@/lib/services/email/outbox";
import type { Tables } from "@/types/database";
import { courseTitlesText, orderAccessSummary } from "@/lib/domain/commerce";
import { loadOrder, loadOrderItems } from "@/lib/services/commerce/store";
import { describePackage } from "./access";
import { getInvoicingSettings } from "./settings";

/**
 * Access invitations. The emailed link carries a random 32-byte token; only
 * its SHA-256 is stored. Links are single use (claimed with a conditional
 * update), expire, can be revoked and re-sent (which rotates the token, so an
 * older email stops working). Accepting never grants access by itself: access
 * always comes from a paid package (see access.ts).
 */

export type AccessInvitationRow = Tables<"access_invitations">;
export type InvitationKind = "company_member" | "company_contact" | "purchase_activation" | "order_activation";
export type InvitationState = "valid" | "expired" | "revoked" | "accepted" | "invalid";

export function accessInvitationState(row: Pick<AccessInvitationRow, "status" | "expires_at"> | null, now = new Date()): InvitationState {
  if (!row) return "invalid";
  if (row.status === "accepted") return "accepted";
  if (row.status === "revoked") return "revoked";
  if (row.status === "expired" || new Date(row.expires_at).getTime() <= now.getTime()) return "expired";
  return "valid";
}

const db = () => createAdminClient();

export async function findAccessInvitationByToken(token: string): Promise<AccessInvitationRow | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const { data } = await db().from("access_invitations").select("*").eq("token_hash", sha256(token)).maybeSingle();
  return (data as AccessInvitationRow | null) ?? null;
}

interface CreateInput {
  kind: InvitationKind;
  email: string;
  fullName?: string | null;
  companyId?: string | null;
  invoiceId?: string | null;
  /** Course-package order whose learner has no account yet (kind "order_activation"). */
  publicOrderId?: string | null;
  canInviteMembers?: boolean;
  invitedBy?: string | null;
  invitedByRole: "admin" | "company" | "system";
}

/**
 * Create an invitation and email it. A pending invitation for the same
 * company (or purchase) and email is refused for people-initiated invites,
 * and refreshed (new token, new email) for system-initiated ones.
 */
export async function createAccessInvitation(input: CreateInput, inviterName?: string | null): Promise<{ invitation: AccessInvitationRow; resent: boolean }> {
  const admin = db();
  const emailAddr = input.email.trim().toLowerCase();
  const settings = await getInvoicingSettings();
  const expiresAt = new Date(Date.now() + settings.invitationTtlDays * 86_400_000).toISOString();

  let pendingQuery = admin.from("access_invitations").select("*").eq("email", emailAddr).eq("status", "pending");
  pendingQuery = input.companyId
    ? pendingQuery.eq("company_id", input.companyId)
    : input.publicOrderId
      ? pendingQuery.eq("public_order_id", input.publicOrderId).eq("kind", "order_activation")
      : pendingQuery.eq("invoice_id", input.invoiceId!).eq("kind", "purchase_activation");
  const { data: pending } = await pendingQuery.maybeSingle();
  if (pending) {
    if (input.invitedByRole !== "system" && new Date(pending.expires_at).getTime() > Date.now()) {
      throw new UserFacingError("This person already has a pending invitation. Resend it instead.");
    }
    return { invitation: await rotateAndSend(pending as AccessInvitationRow, inviterName, { promoteToManager: input.canInviteMembers }), resent: true };
  }

  const token = randomToken(32);
  const { data, error } = await admin
    .from("access_invitations")
    .insert({
      kind: input.kind,
      company_id: input.companyId ?? null,
      invoice_id: input.invoiceId ?? null,
      public_order_id: input.publicOrderId ?? null,
      email: emailAddr,
      full_name: input.fullName ?? null,
      token_hash: sha256(token),
      can_invite_members: Boolean(input.canInviteMembers),
      invited_by: input.invitedBy ?? null,
      invited_by_role: input.invitedByRole,
      expires_at: expiresAt,
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") throw new UserFacingError("This person already has a pending invitation. Resend it instead.");
    throw new Error(`invitation insert failed: ${error.message}`);
  }
  const row = data as AccessInvitationRow;
  await sendInvitationEmail(row, token, inviterName);
  return { invitation: row, resent: false };
}

async function rotateAndSend(row: AccessInvitationRow, inviterName?: string | null, opts: { promoteToManager?: boolean } = {}): Promise<AccessInvitationRow> {
  const settings = await getInvoicingSettings();
  const token = randomToken(32);
  const { data, error } = await db()
    .from("access_invitations")
    .update({
      token_hash: sha256(token),
      status: "pending",
      expires_at: new Date(Date.now() + settings.invitationTtlDays * 86_400_000).toISOString(),
      send_count: row.send_count + 1,
      last_sent_at: new Date().toISOString(),
      ...(opts.promoteToManager ? { can_invite_members: true } : {}),
    })
    .eq("id", row.id)
    .in("status", ["pending", "expired"])
    .select("*")
    .single();
  if (error || !data) throw new UserFacingError("This invitation can't be resent.");
  await sendInvitationEmail(data as AccessInvitationRow, token, inviterName);
  return data as AccessInvitationRow;
}

/** Resend: rotates the token (old links stop working) and extends the expiry. */
export async function resendAccessInvitation(id: string, inviterName?: string | null): Promise<AccessInvitationRow> {
  const { data } = await db().from("access_invitations").select("*").eq("id", id).maybeSingle();
  const row = data as AccessInvitationRow | null;
  if (!row || row.status === "accepted" || row.status === "revoked") throw new UserFacingError("This invitation can't be resent.");
  if (Date.now() - new Date(row.last_sent_at).getTime() < 60_000) throw new UserFacingError("This invitation was just sent. Wait a minute before sending it again.");
  return rotateAndSend(row, inviterName);
}

export async function revokeAccessInvitation(id: string, actorId: string | null): Promise<AccessInvitationRow> {
  const { data, error } = await db()
    .from("access_invitations")
    .update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_by: actorId })
    .eq("id", id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`invitation revoke failed: ${error.message}`);
  if (!data) throw new UserFacingError("This invitation was already used or withdrawn.");
  return data as AccessInvitationRow;
}

/** Claim a valid invitation for a user, exactly once. */
export async function claimAccessInvitation(row: AccessInvitationRow, user: { id: string; email: string }): Promise<AccessInvitationRow> {
  if (accessInvitationState(row) !== "valid") throw new UserFacingError("This invitation is no longer valid.");
  if (row.email.toLowerCase() !== user.email.toLowerCase()) throw new UserFacingError("This invitation was sent to a different email address.");
  const { data } = await db()
    .from("access_invitations")
    .update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_by: user.id })
    .eq("id", row.id)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .select("*")
    .maybeSingle();
  if (!data) throw new UserFacingError("This invitation has already been used.");
  return data as AccessInvitationRow;
}

/** Cron: mark lapsed invitations expired (the acceptance check never relies on this). */
export async function expireLapsedInvitations(): Promise<number> {
  const { data } = await db()
    .from("access_invitations")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lte("expires_at", new Date().toISOString())
    .select("id");
  return data?.length ?? 0;
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

async function packageForInvitation(row: AccessInvitationRow) {
  const admin = db();
  if (row.kind === "order_activation" && row.public_order_id) {
    const [order, items] = await Promise.all([loadOrder(row.public_order_id), loadOrderItems(row.public_order_id)]);
    const titles = items.map((i) => i.course_title_snapshot);
    return {
      companyName: null,
      invoice: null,
      pkg: {
        packageName: order?.order_number ?? "",
        courseList: courseTitlesText(titles, 12),
        accessSummary: order ? orderAccessSummary(order.duration_days, order.paid_at ? new Date(order.paid_at) : null) : "",
        courseCount: titles.length,
      },
    };
  }
  if (row.kind === "purchase_activation" && row.invoice_id) {
    const { data: inv } = await admin.from("custom_invoices").select("*").eq("id", row.invoice_id).single();
    const { data: ent } = await admin.from("invoice_entitlements").select("expires_at, status").eq("invoice_id", row.invoice_id).maybeSingle();
    return { companyName: null, invoice: inv, pkg: describePackage(inv!, ent) };
  }
  const { data: company } = await admin.from("companies").select("name").eq("id", row.company_id!).single();
  const { data: ents } = await admin
    .from("invoice_entitlements")
    .select("expires_at, status, invoice_id, custom_invoices!inner(invoice_description, company_name, invoice_type, selected_course_snapshot, includes_future_courses, billing_type)")
    .eq("company_id", row.company_id!)
    .eq("status", "active")
    .order("expires_at", { ascending: false, nullsFirst: true })
    .limit(1);
  const ent = ents?.[0];
  const inv = ent ? (ent.custom_invoices as unknown as Tables<"custom_invoices">) : null;
  return {
    companyName: company?.name ?? "your company",
    invoice: inv,
    pkg: inv ? describePackage(inv, ent!) : { packageName: company?.name ?? "", courseList: "your company's courses", accessSummary: "Access starts when your company's package is active.", courseCount: 0 },
  };
}

async function sendInvitationEmail(row: AccessInvitationRow, token: string, inviterName?: string | null) {
  const { companyName, invoice, pkg } = await packageForInvitation(row);
  const templateKey =
    row.kind === "order_activation"
      ? "order.account_activation"
      : row.kind === "purchase_activation"
        ? "invoice.account_activation"
        : row.kind === "company_contact"
          ? "company.contact_invitation"
          : "company.employee_invitation";
  await enqueueEmail({
    templateKey,
    to: row.email,
    idempotencyKey: `access-invite:${row.id}:${row.send_count}`,
    payload: {
      first_name: firstName(row.full_name),
      company_name: companyName ?? "",
      inviter_name: inviterName || "The Foremint Academy team",
      invoice_description: invoice?.invoice_description ?? "",
      course_list: pkg.courseList,
      access_summary: pkg.accessSummary,
      expires_at: formatDate(row.expires_at),
      learner_email: row.email,
      cta_url: appUrl(`/join/${token}`),
    },
  });
}
