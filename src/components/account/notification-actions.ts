"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, runAction, type ActionResult } from "@/lib/actions";
import { assertUser } from "@/lib/auth/guards";

const idSchema = z.object({ id: z.uuid() });

export async function markNotificationReadAction(input: { id: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const { id } = idSchema.parse(input);
    const supabase = await createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .is("read_at", null);
    if (error) throw new Error(`mark read failed: ${error.message}`);
    return ok(null);
  });
}

export async function markAllNotificationsReadAction(): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const supabase = await createClient();
    const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
    if (error) throw new Error(`mark all read failed: ${error.message}`);
    return ok(null, "All notifications marked as read");
  });
}

export async function deleteNotificationAction(input: { id: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const { id } = idSchema.parse(input);
    const supabase = await createClient();
    const { error } = await supabase.from("notifications").delete().eq("id", id).eq("user_id", user.id);
    if (error) throw new Error(`delete notification failed: ${error.message}`);
    return ok(null, "Notification deleted");
  });
}
