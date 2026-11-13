import { requireAdmin } from "@/lib/auth/guards";
import { LiveSessionDetail } from "@/components/live/live-session-detail";

export const instant = false;
export const metadata = { title: "Live class" };

export default async function AdminLiveSessionPage({ params }: PageProps<"/admin/live/[id]">) {
  const { id } = await params;
  const user = await requireAdmin(`/admin/live/${id}`);
  return <LiveSessionDetail user={user} area="admin" sessionId={id} />;
}
