"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/guards";
import { fail, ok, runAction, type ActionResult } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import { SETTINGS_TAG } from "@/lib/settings";
import { settingsRows, settingsSchemas, SETTINGS_SECTION_LABELS, type SettingsSection } from "@/lib/services/admin/settings-schema";
import { PUBLIC_TAGS, refreshPublic } from "@/lib/services/admin/revalidate";
import type { Json } from "@/types/database";

const SECTIONS = Object.keys(settingsSchemas) as [SettingsSection, ...SettingsSection[]];

export async function saveSettings(input: { section: string; values: unknown }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const section = z.enum(SECTIONS).parse(input.section);
    const parsed = settingsSchemas[section].safeParse(input.values);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) (fieldErrors[issue.path.join(".") || "_"] ??= []).push(issue.message);
      return fail("Check the highlighted fields.", fieldErrors);
    }
    const rows = settingsRows(section, parsed.data as never).map((r) => ({ ...r, value: (r.value ?? null) as Json, updated_by: user.id }));
    const supabase = await createClient();
    const { data: before } = await supabase.from("platform_settings").select("key, value").in("key", rows.map((r) => r.key));
    const previous = new Map(((before ?? []) as { key: string; value: unknown }[]).map((r) => [r.key, JSON.stringify(r.value)]));
    const { error } = await supabase.from("platform_settings").upsert(rows, { onConflict: "key" });
    if (error) throw error;

    const changed = rows.filter((r) => previous.get(r.key) !== JSON.stringify(r.value)).map((r) => r.key);
    await audit({
      actor: user,
      action: section === "security" ? "settings.security_updated" : "settings.updated",
      entityType: "platform_settings",
      entityId: section,
      summary: `${SETTINGS_SECTION_LABELS[section]} settings`,
      // Values for security toggles are recorded; others list keys only.
      metadata: section === "security" ? { changed, values: parsed.data } : { changed },
    });
    updateTag(SETTINGS_TAG);
    if (section === "legal" || section === "contact") refreshPublic(PUBLIC_TAGS.legal, PUBLIC_TAGS.cms);
    if (section === "brand") refreshPublic(PUBLIC_TAGS.cms);
    return ok(null, `${SETTINGS_SECTION_LABELS[section]} settings saved`);
  });
}
