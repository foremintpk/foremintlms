import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestMeta } from "@/lib/security/request";
import type { SessionUser } from "@/lib/auth/session";
import type { Json } from "@/types/database";

export interface AuditEntry {
  actor: SessionUser | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary?: string;
  metadata?: Record<string, unknown>;
}

/** Append-only audit trail for sensitive actions. Never throws. */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    const meta = await getRequestMeta().catch(() => ({ ip: null, userAgent: null }));
    const { error } = await createAdminClient()
      .from("audit_logs")
      .insert({
        actor_id: entry.actor?.id ?? null,
        actor_role: entry.actor?.primaryRole ?? "system",
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId ?? null,
        summary: entry.summary ?? null,
        metadata: (entry.metadata ?? {}) as Json,
        ip_address: meta.ip,
        user_agent: meta.userAgent,
      });
    if (error) console.error("[audit] insert failed", error.message);
  } catch (err) {
    console.error("[audit] failed", err);
  }
}
