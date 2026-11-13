import { requireTeacher } from "@/lib/auth/guards";
import { LiveSessionsPage } from "@/components/live/live-sessions-page";

export const instant = false;
export const metadata = { title: "Live classes" };

export default async function TeachLivePage({ searchParams }: PageProps<"/teach/live">) {
  const user = await requireTeacher("/teach/live");
  return <LiveSessionsPage user={user} area="teach" searchParams={await searchParams} />;
}
