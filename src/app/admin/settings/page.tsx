import Link from "next/link";
import { PageHeader } from "@/components/app-shell/page-header";
import { SettingsForms } from "@/components/admin/settings/settings-forms";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { sectionValues, settingsSchemas, type SettingsSection } from "@/lib/services/admin/settings-schema";

export const instant = false;
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireAdmin("/admin/settings");
  const supabase = await createClient();
  const { data, error } = await supabase.from("platform_settings").select("key, value");
  if (error) throw new Error(error.message);
  const all = Object.fromEntries(((data ?? []) as { key: string; value: unknown }[]).map((r) => [r.key, r.value]));
  const sections = Object.fromEntries(
    (Object.keys(settingsSchemas) as SettingsSection[]).map((s) => [s, sectionValues(s, all)]),
  ) as Record<SettingsSection, Record<string, unknown>>;

  return (
    <>
      <PageHeader
        title="Settings"
        description={
          <>
            Brand, contact, legal and platform behaviour. Email sender details live in{" "}
            <Link href="/admin/emails" className="text-primary hover:underline">
              Email templates
            </Link>
            ; service credentials in{" "}
            <Link href="/admin/integrations" className="text-primary hover:underline">
              Integrations
            </Link>
            .
          </>
        }
      />
      <SettingsForms initial={sections} />
    </>
  );
}
