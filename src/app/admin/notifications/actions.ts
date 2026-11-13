"use server";

import { z } from "zod";
import { assertAdmin } from "@/lib/auth/guards";
import { fail, ok, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import {
  cancelAnnouncementEmails,
  deliverAnnouncementNow,
  resolveAudience,
  scheduleAnnouncementEmails,
} from "@/lib/services/admin/announcements";

const schema = z
  .object({
    id: z.uuid().optional(),
    title: z.string().trim().min(1, "Enter a title").max(200),
    body: z.string().trim().min(1, "Write the announcement").max(5000),
    audience: z.enum(["all", "students", "teachers", "course"]),
    course_id: z.union([z.literal(""), z.uuid()]).default(""),
    mode: z.enum(["draft", "now", "schedule"]),
    publish_at: z.string().default(""),
    send_email: z.boolean(),
  })
  .refine((a) => a.audience !== "course" || a.course_id, { path: ["course_id"], message: "Choose a course" });

export async function saveAnnouncement(input: z.input<typeof schema>): Promise<ActionResult<{ recipients: number }>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = schema.parse(input);
    const supabase = await createClient();

    let publishedAt: string | null = null;
    if (data.mode === "now") publishedAt = new Date().toISOString();
    if (data.mode === "schedule") {
      const at = new Date(data.publish_at);
      if (!data.publish_at || Number.isNaN(at.getTime()) || at.getTime() <= Date.now()) {
        return fail("Check the highlighted fields.", { publish_at: ["Choose a time in the future"] });
      }
      publishedAt = at.toISOString();
    }

    let previous: { published_at: string | null } | null = null;
    if (data.id) {
      const { data: row } = await supabase.from("announcements").select("published_at").eq("id", data.id).maybeSingle();
      if (!row) throw new UserFacingError("This announcement no longer exists.");
      previous = row as { published_at: string | null };
      if (previous.published_at && new Date(previous.published_at).getTime() <= Date.now()) {
        throw new UserFacingError("This announcement is already live. Unpublish it before editing.");
      }
    }

    const row = {
      title: data.title,
      body: data.body,
      audience: data.audience,
      course_id: data.audience === "course" ? data.course_id : null,
      send_email: data.send_email,
      published_at: publishedAt,
    };
    let id = data.id;
    if (id) {
      const { error } = await supabase.from("announcements").update(row).eq("id", id);
      if (error) throw error;
      // A changed schedule replaces any emails queued for the old one.
      await cancelAnnouncementEmails(id);
    } else {
      const { data: created, error } = await supabase.from("announcements").insert({ ...row, created_by: user.id }).select("id").single();
      if (error) throw error;
      id = created.id as string;
    }

    let recipients = 0;
    if (data.mode !== "draft") {
      const userIds = await resolveAudience(data.audience, data.audience === "course" ? data.course_id : null);
      recipients = userIds.length;
      const payload = { id: id!, title: data.title, body: data.body, send_email: data.send_email };
      if (data.mode === "now") await deliverAnnouncementNow(payload, userIds);
      else if (data.send_email) await scheduleAnnouncementEmails(payload, userIds, new Date(publishedAt!));
    }

    await audit({
      actor: user,
      action: data.mode === "now" ? "announcement.published" : data.mode === "schedule" ? "announcement.scheduled" : "announcement.saved",
      entityType: "announcement",
      entityId: id,
      summary: data.title,
      metadata: { audience: data.audience, courseId: data.course_id || null, sendEmail: data.send_email, recipients, publishedAt },
    });
    const message =
      data.mode === "now"
        ? `Announcement published to ${recipients} ${recipients === 1 ? "person" : "people"}`
        : data.mode === "schedule"
          ? "Announcement scheduled"
          : "Draft saved";
    return ok({ recipients }, message);
  });
}

export async function unpublishAnnouncement(input: { id: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const { id } = z.object({ id: z.uuid() }).parse(input);
    const supabase = await createClient();
    const { error } = await supabase.from("announcements").update({ published_at: null }).eq("id", id);
    if (error) throw error;
    const cancelled = await cancelAnnouncementEmails(id);
    await audit({ actor: user, action: "announcement.unpublished", entityType: "announcement", entityId: id, metadata: { cancelledEmails: cancelled } });
    return ok(null, "Announcement unpublished");
  });
}

export async function deleteAnnouncement(input: { id: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const { id } = z.object({ id: z.uuid() }).parse(input);
    const cancelled = await cancelAnnouncementEmails(id);
    const supabase = await createClient();
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) throw error;
    await audit({ actor: user, action: "announcement.deleted", entityType: "announcement", entityId: id, metadata: { cancelledEmails: cancelled } });
    return ok(null, "Announcement deleted");
  });
}
