import { AppShell } from "@/components/app-shell/app-shell";
import { requireUser } from "@/lib/auth/guards";
import { getShellBadges, toShellUser } from "@/lib/services/shell";
import { getUserCompanies } from "@/lib/services/invoicing/companies";

// Personalised, session-dependent area: render on every request.
export const instant = false;

export const metadata = { robots: { index: false, follow: false } };

export default async function LearnLayout({ children }: LayoutProps<"/learn">) {
  const user = await requireUser("/learn");
  const [badges, companies] = await Promise.all([getShellBadges(user, "learn"), getUserCompanies(user.id)]);
  return (
    <AppShell area="learn" user={toShellUser(user)} badges={badges} features={companies.length ? ["company"] : []}>
      {children}
    </AppShell>
  );
}
