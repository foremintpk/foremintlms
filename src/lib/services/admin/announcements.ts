import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueEmail } from "@/lib/services/email/outbox";
import { notify } from "@/lib/services/notifications";
import { appUrl } from "@/lib/env";
import { firstName } from "@/lib/format";

export type Audience = "all" | "students" | "teachers" | "course";

const PAGE = 1000;

/** Every active account in the audience (service role; callers must be admins). */
export async function resolveAudience(audience: Audience, courseId: string | null): Promise<string[]> {
  const admin = createAdminClient();
  const ids = new Set<string>();

  const page = async (fetch: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>, pick: (row: Record<string, unknown>) => string) => {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await fetch(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Record<string, unknown>[];
      for (const r of rows) ids.add(pick(r));
      if (rows.length < PAGE) break;
    }
  };

  if (audience === "all") {
    await page((f, t) => admin.from("profile_private").select("user_id").eq("status", "active").range(f, t), (r) => r.user_id as string);
  } else if (audience === "students") {
    await page((f, t) => admin.from("user_roles").select("user_id").eq("role", "student").range(f, t), (r) => r.user_id as string);
    // Administrators hold the student role too, but they are staff, not learners.
    const { data: admins, error: adminsError } = await admin.from("user_roles").select("user_id").eq("role", "admin");
    if (adminsError) throw new Error(adminsError.message);
    for (const a of admins ?? []) ids.delete(a.user_id);
  } else if (audience === "teachers") {
    await page((f, t) => admin.from("teacher_profiles").select("user_id").eq("status", "approved").range(f, t), (r) => r.user_id as string);
  } else if (audience === "course" && courseId) {
    await page(
      (f, t) => admin.from("enrollments").select("user_id").eq("course_id", courseId).in("status", ["active", "completed"]).range(f, t),
      (r) => r.user_id as string,
    );
    await page((f, t) => admin.from("course_instructors").select("user_id").eq("course_id", courseId).range(f, t), (r) => r.user_id as string);
  }

  if (audience !== "all" && ids.size) {
    // Drop suspended accounts.
    const all = [...ids];
    const active = new Set<string>();
    for (let i = 0; i < all.length; i += PAGE) {
      const { data } = await admin.from("profile_private").select("user_id").in("user_id", all.slice(i, i + PAGE)).eq("status", "active");
      for (const r of (data ?? []) as { user_id: string }[]) active.add(r.user_id);
    }
    return [...active];
  }
  return [...ids];
}

export function preview(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/** Publish-now delivery: bell notification for everyone, email when requested. */
export async function deliverAnnouncementNow(a: { id: string; title: string; body: string; send_email: boolean }, userIds: string[]) {
  const url = "/learn";
  for (let i = 0; i < userIds.length; i += 500) {
    await notify(userIds.slice(i, i + 500), {
      category: "system",
      type: "announcement",
      title: a.title,
      body: preview(a.body, 300),
      url,
      data: { announcementId: a.id },
      email: a.send_email
        ? {
            templateKey: "communication.announcement",
            idempotencyKey: `announcement:${a.id}`,
            payload: {
              announcement_title: a.title,
              announcement_body: a.body,
              preview: preview(a.body),
              cta_url: appUrl(url),
            },
          }
        : undefined,
    });
  }
}

/** Scheduled delivery: queue emails to go out at the publish time. */
export async function scheduleAnnouncementEmails(a: { id: string; title: string; body: string }, userIds: string[], sendAt: Date) {
  const admin = createAdminClient();
  for (let i = 0; i < userIds.length; i += 500) {
    const chunk = userIds.slice(i, i + 500);
    const [{ data: people }, { data: names }] = await Promise.all([
      admin.from("profile_private").select("user_id, email").in("user_id", chunk).eq("status", "active"),
      admin.from("profiles").select("id, full_name").in("id", chunk),
    ]);
    const nameById = new Map(((names ?? []) as { id: string; full_name: string }[]).map((n) => [n.id, n.full_name]));
    await Promise.all(
      ((people ?? []) as { user_id: string; email: string }[]).map((p) =>
        enqueueEmail({
          templateKey: "communication.announcement",
          to: p.email,
          userId: p.user_id,
          idempotencyKey: `announcement:${a.id}:${p.user_id}`,
          sendAt,
          payload: {
            first_name: firstName(nameById.get(p.user_id)),
            announcement_title: a.title,
            announcement_body: a.body,
            preview: preview(a.body),
            cta_url: appUrl("/learn"),
          },
        }),
      ),
    );
  }
}

/** Cancel queued emails that haven't been sent yet. */
export async function cancelAnnouncementEmails(announcementId: string): Promise<number> {
  const { data, error } = await createAdminClient()
    .from("email_outbox")
    .update({ status: "cancelled" })
    .like("idempotency_key", `announcement:${announcementId}:%`)
    .in("status", ["pending", "failed"])
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}
