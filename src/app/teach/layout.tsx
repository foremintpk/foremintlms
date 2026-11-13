import { AppShell } from "@/components/app-shell/app-shell";
import { requireTeacher } from "@/lib/auth/guards";
import { getShellBadges, toShellUser } from "@/lib/services/shell";

export const instant = false;

export const metadata = { robots: { index: false, follow: false } };

export default async function TeachLayout({ children }: LayoutProps<"/teach">) {
  const user = await requireTeacher("/teach");
  const badges = await getShellBadges(user, "teach");
  return (
    <AppShell area="teach" user={toShellUser(user)} badges={badges}>
      {children}
    </AppShell>
  );
}
