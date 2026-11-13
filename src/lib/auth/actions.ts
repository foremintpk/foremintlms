"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestMeta } from "@/lib/security/request";

/** Sign out of this device and return to the home page. */
export async function signOut() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  await supabase.auth.signOut({ scope: "local" });
  if (data?.claims?.sub) {
    const meta = await getRequestMeta();
    await createAdminClient()
      .from("auth_events")
      .insert({ user_id: data.claims.sub, event: "sign_out", ip_address: meta.ip, user_agent: meta.userAgent });
  }
  redirect("/");
}
