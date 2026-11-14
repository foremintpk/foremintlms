import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json, Tables } from "@/types/database";
import { isPlausibleToken, tokenHash } from "./tokens";

/** Row access for public course orders (service role; callers check permissions). */

export type OrderRow = Tables<"public_course_orders">;
export type OrderItemRow = Tables<"public_course_order_items">;

const db = () => createAdminClient();

export async function loadOrder(id: string): Promise<OrderRow | null> {
  const { data } = await db().from("public_course_orders").select("*").eq("id", id).maybeSingle();
  return (data as OrderRow | null) ?? null;
}

export async function loadOrderByToken(token: string | null | undefined): Promise<OrderRow | null> {
  if (!isPlausibleToken(token)) return null;
  const { data } = await db().from("public_course_orders").select("*").eq("access_token_hash", tokenHash(token)).maybeSingle();
  return (data as OrderRow | null) ?? null;
}

export async function loadOrderItems(orderId: string): Promise<OrderItemRow[]> {
  const { data } = await db().from("public_course_order_items").select("*").eq("order_id", orderId).order("sort_order");
  return (data ?? []) as OrderItemRow[];
}

export async function updateOrder(id: string, patch: Partial<OrderRow>): Promise<OrderRow> {
  const { data, error } = await db().from("public_course_orders").update(patch).eq("id", id).select("*").single();
  if (error || !data) throw new Error(`order update failed: ${error?.message}`);
  return data as OrderRow;
}

/**
 * Append to the order timeline. `dedupeKey` makes webhook-driven entries
 * idempotent: returns false when the same entry was already recorded.
 */
export async function logOrderEvent(input: {
  orderId: string;
  type: string;
  oldStatus?: string | null;
  newStatus?: string | null;
  actorId?: string | null;
  dedupeKey?: string | null;
  data?: Record<string, unknown>;
}): Promise<boolean> {
  const { error } = await db()
    .from("public_course_order_events")
    .insert({
      order_id: input.orderId,
      event_type: input.type,
      old_status: input.oldStatus ?? null,
      new_status: input.newStatus ?? null,
      actor_id: input.actorId ?? null,
      dedupe_key: input.dedupeKey ?? null,
      event_data: (input.data ?? {}) as Json,
    });
  if (error) {
    if (error.code === "23505") return false;
    console.error("[orders] event insert failed", error.message);
    return false;
  }
  return true;
}
