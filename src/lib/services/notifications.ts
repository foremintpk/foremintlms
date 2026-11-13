import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueEmail } from "@/lib/services/email/outbox";
import { firstName } from "@/lib/format";
import type { Json } from "@/types/database";

export type NotificationCategory = "learning" | "billing" | "messages" | "discussions" | "support" | "live" | "system";

export interface NotifyInput {
  category: NotificationCategory;
  type: string;
  title: string;
  body?: string;
  url?: string;
  data?: Record<string, unknown>;
  email?: {
    templateKey: string;
    payload?: Record<string, unknown>;
    /** Base key; the recipient id is appended so each person gets one email. */
    idempotencyKey: string;
    /** Security/transactional mail that ignores notification preferences. */
    required?: boolean;
  };
  /** Skip the in-app notification (email only). */
  emailOnly?: boolean;
}

/**
 * Create in-app notifications and queue emails for one or more users,
 * respecting each user's per-category preferences.
 */
export async function notify(userIds: string | string[], input: NotifyInput): Promise<void> {
  const ids = [...new Set(Array.isArray(userIds) ? userIds : [userIds])].filter(Boolean);
  if (ids.length === 0) return;
  const admin = createAdminClient();
  const prefCategory = input.category === "system" ? null : input.category;

  const [prefsRes, peopleRes, templateRes] = await Promise.all([
    prefCategory
      ? admin.from("notification_preferences").select("user_id, email_enabled, in_app_enabled").in("user_id", ids).eq("category", prefCategory)
      : Promise.resolve({ data: [] as { user_id: string; email_enabled: boolean; in_app_enabled: boolean }[] }),
    input.email
      ? admin.from("profile_private").select("user_id, email, status").in("user_id", ids)
      : Promise.resolve({ data: [] as { user_id: string; email: string; status: string }[] }),
    input.email
      ? admin.from("email_templates").select("is_enabled, is_required").eq("key", input.email.templateKey).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const prefs = new Map((prefsRes.data ?? []).map((p) => [p.user_id, p]));

  if (!input.emailOnly) {
    const rows = ids
      .filter((id) => prefs.get(id)?.in_app_enabled !== false)
      .map((id) => ({
        user_id: id,
        category: input.category,
        type: input.type,
        title: input.title.slice(0, 200),
        body: input.body?.slice(0, 2000) ?? null,
        url: input.url ?? null,
        data: (input.data ?? {}) as Json,
      }));
    if (rows.length) {
      const { error } = await admin.from("notifications").insert(rows);
      if (error) console.error("[notify] insert failed", error.message);
    }
  }

  if (input.email) {
    const template = templateRes.data as { is_enabled: boolean; is_required: boolean } | null;
    const required = input.email.required || template?.is_required;
    if (template && !template.is_enabled && !required) return;
    const people = (peopleRes.data ?? []) as { user_id: string; email: string; status: string }[];
    const names = new Map<string, string>();
    if (people.length) {
      const { data } = await admin.from("profiles").select("id, full_name").in("id", people.map((p) => p.user_id));
      for (const p of data ?? []) names.set(p.id, p.full_name);
    }
    await Promise.all(
      people
        .filter((p) => p.status === "active" && (required || prefs.get(p.user_id)?.email_enabled !== false))
        .map((p) =>
          enqueueEmail({
            templateKey: input.email!.templateKey,
            to: p.email,
            userId: p.user_id,
            idempotencyKey: `${input.email!.idempotencyKey}:${p.user_id}`,
            payload: { first_name: firstName(names.get(p.user_id)), ...input.email!.payload },
          }),
        ),
    );
  }
}

/** Email a staff mailbox (support address) rather than a user account. */
export async function notifyStaffEmail(to: string | null | undefined, templateKey: string, idempotencyKey: string, payload: Record<string, unknown>) {
  if (!to) return;
  await enqueueEmail({ templateKey, to, idempotencyKey, payload });
}
