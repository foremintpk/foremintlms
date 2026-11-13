import { PageHeader } from "@/components/app-shell/page-header";
import { AccountSettings } from "@/components/account/account-settings";
import { parseAccountTab } from "@/components/account/constants";
import { requireUser } from "@/lib/auth/guards";

export const instant = false;

export const metadata = { title: "Account settings" };

export default async function LearnSettingsPage({ searchParams }: PageProps<"/learn/settings">) {
  const user = await requireUser("/learn/settings");
  const { tab } = await searchParams;
  return (
    <>
      <PageHeader title="Account settings" description="Manage your profile, sign-in security, notifications and privacy." />
      <AccountSettings user={user} defaultTab={parseAccountTab(tab)} settingsPath="/learn/settings" />
    </>
  );
}
