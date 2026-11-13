import { requireAdmin } from "@/lib/auth/guards";
import { LiveSessionsPage } from "@/components/live/live-sessions-page";

export const instant = false;
export const metadata = { title: "Live classes" };

export default async function AdminLivePage({ searchParams }: PageProps<"/admin/live">) {
  const user = await requireAdmin("/admin/live");
  return <LiveSessionsPage user={user} area="admin" searchParams={await searchParams} />;
}
