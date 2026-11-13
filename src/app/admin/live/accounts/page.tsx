import { PageHeader } from "@/components/app-shell/page-header";
import { MeetingAccounts } from "@/components/teaching/meeting-accounts";
import { requireAdmin } from "@/lib/auth/guards";

export const instant = false;
export const metadata = { title: "Meeting accounts" };

/** Administrators connect their own Zoom / Google accounts to host classes. */
export default async function AdminMeetingAccountsPage() {
  const user = await requireAdmin("/admin/live/accounts");
  return (
    <>
      <PageHeader
        back={{ href: "/admin/live", label: "Live classes" }}
        title="Your meeting accounts"
        description="Connect your own Zoom or Google account to host classes you schedule. Each instructor connects theirs from their settings. App credentials live in Admin → Integrations."
      />
      <div className="max-w-3xl">
        <MeetingAccounts userId={user.id} returnTo="/admin/live/accounts" />
      </div>
    </>
  );
}
