import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

/**
 * Invoice timeline and company access history. Both are append-only; a
 * `dedupeKey` makes system events (webhook-driven) idempotent so a retried
 * webhook never writes the same entry twice.
 */

export async function logInvoiceEvent(input: {
  invoiceId: string;
  type: string;
  oldStatus?: string | null;
  newStatus?: string | null;
  actorId?: string | null;
  dedupeKey?: string | null;
  data?: Record<string, unknown>;
}): Promise<boolean> {
  const { error } = await createAdminClient()
    .from("custom_invoice_events")
    .insert({
      invoice_id: input.invoiceId,
      event_type: input.type,
      old_status: input.oldStatus ?? null,
      new_status: input.newStatus ?? null,
      actor_id: input.actorId ?? null,
      dedupe_key: input.dedupeKey ?? null,
      event_data: (input.data ?? {}) as Json,
    });
  if (error) {
    if (error.code === "23505") return false; // already recorded
    console.error("[invoicing] event insert failed", error.message);
    return false;
  }
  return true;
}

export type CompanyActorRole = "admin" | "company_contact" | "system";

export async function logCompanyAudit(input: {
  companyId: string;
  action: string;
  performedBy?: string | null;
  performerRole: CompanyActorRole;
  affectedUserId?: string | null;
  reason?: string | null;
  previous?: Record<string, unknown>;
  next?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await createAdminClient()
    .from("company_access_audit_logs")
    .insert({
      company_id: input.companyId,
      action: input.action,
      performed_by: input.performedBy ?? null,
      performer_role: input.performerRole,
      affected_user_id: input.affectedUserId ?? null,
      reason: input.reason ?? null,
      previous_values: (input.previous ?? {}) as Json,
      new_values: (input.next ?? {}) as Json,
    });
  if (error) console.error("[invoicing] company audit insert failed", error.message);
}
