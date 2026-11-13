import { PageHeader } from "@/components/app-shell/page-header";
import { AccountSettings } from "@/components/account/account-settings";
import { parseAccountTab } from "@/components/account/constants";
import { requireAdmin } from "@/lib/auth/guards";

export const instant = false;

export const metadata = { title: "My account" };

export default async function AdminAccountPage({ searchParams }: PageProps<"/admin/account">) {
  const user = await requireAdmin("/admin/account");
  const { tab } = await searchParams;
  return (
    <>
      <PageHeader title="My account" description="Your own profile, password, authenticator apps and signed-in devices." />
      <AccountSettings user={user} defaultTab={parseAccountTab(tab)} settingsPath="/admin/account" />
    </>
  );
}
