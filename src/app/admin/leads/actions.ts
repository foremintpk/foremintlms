"use server";

import { z } from "zod";
import { assertAdmin } from "@/lib/auth/guards";
import { ok, runAction, type ActionResult } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";

export async function setLeadStatus(input: { ids: string[]; status: "new" | "contacted" | "closed" | "spam" }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = z.object({ ids: z.array(z.uuid()).min(1).max(200), status: z.enum(["new", "contacted", "closed", "spam"]) }).parse(input);
    const supabase = await createClient();
    const { error } = await supabase.from("marketing_leads").update({ status: data.status }).in("id", data.ids);
    if (error) throw error;
    await audit({ actor: user, action: "lead.status_changed", entityType: "marketing_lead", entityId: data.ids.length === 1 ? data.ids[0] : null, metadata: { ids: data.ids, status: data.status } });
    return ok(null, data.ids.length === 1 ? "Lead updated" : `${data.ids.length} leads updated`);
  });
}

export async function unsubscribeNewsletter(input: { id: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const { id } = z.object({ id: z.uuid() }).parse(input);
    const supabase = await createClient();
    const { error } = await supabase
      .from("newsletter_subscriptions")
      .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    await audit({ actor: user, action: "newsletter.unsubscribed_by_admin", entityType: "newsletter_subscription", entityId: id });
    return ok(null, "Subscriber unsubscribed");
  });
}
