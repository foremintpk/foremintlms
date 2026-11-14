import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { AdvisorNav } from "@/components/admin/advisor/advisor-nav";
import { AdvisorSettingsForm } from "@/components/admin/advisor/settings-form";
import { requireAdmin } from "@/lib/auth/guards";
import { getAdvisorAdminSettings } from "@/lib/services/advisor/admin";

export const instant = false;
export const metadata: Metadata = { title: "Advisor behaviour" };

export default async function AdvisorSettingsPage() {
  await requireAdmin("/admin/advisor/settings");
  const { config, retentionDays } = await getAdvisorAdminSettings();
  return (
    <>
      <PageHeader title="Course advisor" description="What the advisor says when it opens, when it can't help, and how long conversations and logs last." />
      <AdvisorNav active="settings" />
      <div className="max-w-3xl">
        <AdvisorSettingsForm config={config} retentionDays={retentionDays} />
      </div>
    </>
  );
}
