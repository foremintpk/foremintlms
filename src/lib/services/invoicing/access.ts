import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/services/notifications";
import { appUrl } from "@/lib/env";
import { formatDate } from "@/lib/format";
import {
  computeExtendedExpiry,
  courseListText,
  type CourseSnapshotItem,
  type ExtensionMode,
} from "@/lib/domain/invoicing";
import type { Tables } from "@/types/database";
import { logCompanyAudit, logInvoiceEvent, type CompanyActorRole } from "./events";

/**
 * Package entitlements → learner access. `invoice_entitlements` is the
 * single source of truth for a paid package; this module changes it and then
 * re-materialises course access atomically in SQL
 * (sync_invoice_entitlement_access), so every existing access check applies.
 */

export type InvoiceEntitlementRow = Tables<"invoice_entitlements">;

const db = () => createAdminClient();

/** Re-materialise access for one package. Returns the (user, course) rows created by this run. */
export async function syncPackageAccess(entitlementId: string): Promise<{ user_id: string; course_id: string | null }[]> {
  const { data, error } = await db().rpc("sync_invoice_entitlement_access", { p_entitlement: entitlementId });
  if (error) throw new Error(`package access sync failed: ${error.message}`);
  return ((data ?? []) as { user_id: string; course_id: string | null; inserted: boolean }[])
    .filter((r) => r.inserted)
    .map((r) => ({ user_id: r.user_id, course_id: r.course_id }));
}

/** Re-sync every package a company owns (after members join or leave, or a suspension). */
export async function syncCompanyAccess(companyId: string): Promise<string[]> {
  const { data } = await db().from("invoice_entitlements").select("id").eq("company_id", companyId);
  const newlyCovered = new Set<string>();
  for (const row of data ?? []) {
    for (const r of await syncPackageAccess(row.id)) newlyCovered.add(r.user_id);
  }
  if (!data?.length) await db().rpc("refresh_company_access_status", { p_company: companyId });
  return [...newlyCovered];
}

export interface PackageDescription {
  packageName: string;
  courseList: string;
  accessSummary: string;
  courseCount: number;
}

export function describePackage(
  inv: Pick<Tables<"custom_invoices">, "invoice_description" | "company_name" | "invoice_type" | "selected_course_snapshot" | "includes_future_courses" | "billing_type">,
  ent: Pick<InvoiceEntitlementRow, "expires_at" | "status"> | null,
): PackageDescription {
  const snapshot = (inv.selected_course_snapshot as unknown as CourseSnapshotItem[]) ?? [];
  const courseList = courseListText(snapshot, inv.includes_future_courses);
  let accessSummary: string;
  if (!ent) accessSummary = "Access starts when the payment is confirmed.";
  else if (ent.status !== "active") accessSummary = "Access is currently paused.";
  else if (ent.expires_at) accessSummary = `Access runs until ${formatDate(ent.expires_at)}.`;
  else accessSummary = inv.billing_type === "recurring" ? "Access continues while the subscription is active." : "Access does not expire.";
  const packageName = inv.invoice_type === "company" && inv.company_name ? `${inv.company_name} — ${inv.invoice_description}` : inv.invoice_description;
  return { packageName, courseList, accessSummary, courseCount: snapshot.length };
}

/** One in-app notification per newly covered learner (no per-course spam). */
export async function welcomeCoveredLearners(userIds: string[], pkg: PackageDescription, opts: { companyName?: string | null; dedupe: string }) {
  if (userIds.length === 0) return;
  await notify(userIds, {
    category: "learning",
    type: opts.companyName ? "company_access_granted" : "package_access_granted",
    title: opts.companyName ? `You now have access through ${opts.companyName}` : "Your new courses are ready",
    body: `${pkg.courseList}. ${pkg.accessSummary}`.slice(0, 500),
    url: "/learn/courses",
    data: { dedupe: opts.dedupe },
  });
}

export async function loadEntitlement(id: string): Promise<InvoiceEntitlementRow | null> {
  const { data } = await db().from("invoice_entitlements").select("*").eq("id", id).maybeSingle();
  return (data as InvoiceEntitlementRow | null) ?? null;
}

/**
 * Manual extension by an administrator (always requires a reason). Payment
 * driven renewals never come through here; they set the expiry from Whop's
 * current billing period instead, so a retried webhook can't extend twice.
 */
export async function extendPackage(input: {
  entitlementId: string;
  mode: ExtensionMode;
  days?: number | null;
  date?: Date | null;
  reason: string;
  actorId: string;
}): Promise<{ previous: string | null; next: string }> {
  const ent = await loadEntitlement(input.entitlementId);
  if (!ent) throw new Error("Package not found");
  const next = computeExtendedExpiry({ mode: input.mode, days: input.days, date: input.date }, ent.expires_at ? new Date(ent.expires_at) : null);
  if (next.getTime() <= new Date(ent.starts_at).getTime()) throw new Error("The new end date must be after the package start");
  const reactivate = ent.status === "expired" && next.getTime() > Date.now();
  const { error } = await db()
    .from("invoice_entitlements")
    .update({
      expires_at: next.toISOString(),
      // A manual extension also lifts a fixed-term contract cap.
      contract_ends_at: ent.contract_ends_at && new Date(ent.contract_ends_at) < next ? next.toISOString() : ent.contract_ends_at,
      ...(reactivate ? { status: "active", status_reason: "Extended by an administrator" } : {}),
      expiry_reminder_sent_at: null,
      expired_notified_at: null,
    })
    .eq("id", ent.id);
  if (error) throw new Error(`extend failed: ${error.message}`);
  await syncPackageAccess(ent.id);

  await logInvoiceEvent({
    invoiceId: ent.invoice_id,
    type: "access_extended",
    actorId: input.actorId,
    data: { previous_expires_at: ent.expires_at, new_expires_at: next.toISOString(), mode: input.mode, days: input.days ?? null, reason: input.reason },
  });
  if (ent.company_id) {
    await logCompanyAudit({
      companyId: ent.company_id,
      action: "access_extended",
      performedBy: input.actorId,
      performerRole: "admin",
      reason: input.reason,
      previous: { expires_at: ent.expires_at, status: ent.status },
      next: { expires_at: next.toISOString(), status: reactivate ? "active" : ent.status },
    });
  }
  return { previous: ent.expires_at, next: next.toISOString() };
}

/** Change a package's state (suspend for review, revoke after refund, restore). */
export async function setPackageStatus(input: {
  entitlementId: string;
  status: "active" | "suspended" | "revoked" | "expired";
  reason: string;
  actorId?: string | null;
  actorRole?: CompanyActorRole;
}): Promise<InvoiceEntitlementRow | null> {
  const ent = await loadEntitlement(input.entitlementId);
  if (!ent) return null;
  if (ent.status === input.status && ent.status_reason === input.reason) {
    await syncPackageAccess(ent.id);
    return ent;
  }
  const { data, error } = await db()
    .from("invoice_entitlements")
    .update({ status: input.status, status_reason: input.reason })
    .eq("id", ent.id)
    .select("*")
    .single();
  if (error) throw new Error(`package status update failed: ${error.message}`);
  await syncPackageAccess(ent.id);
  if (ent.company_id && ent.status !== input.status) {
    await logCompanyAudit({
      companyId: ent.company_id,
      action: `package_${input.status}`,
      performedBy: input.actorId ?? null,
      performerRole: input.actorRole ?? "system",
      reason: input.reason,
      previous: { status: ent.status },
      next: { status: input.status },
    });
  }
  return data as InvoiceEntitlementRow;
}

export function packageLink(companyId: string | null): string {
  return appUrl(companyId ? "/learn/company" : "/learn/courses");
}
