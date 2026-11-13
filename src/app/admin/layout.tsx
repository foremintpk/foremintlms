import { AppShell } from "@/components/app-shell/app-shell";
import { requireAdmin } from "@/lib/auth/guards";
import { getShellBadges, toShellUser } from "@/lib/services/shell";

export const instant = false;

export const metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Requires the admin role AND an MFA-verified session (redirects to /mfa).
  const user = await requireAdmin("/admin");
  const badges = await getShellBadges(user, "admin");
  return (
    <AppShell area="admin" user={toShellUser(user)} badges={badges}>
      {children}
    </AppShell>
  );
}
