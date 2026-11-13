import { requireTeacher } from "@/lib/auth/guards";
import { LiveSessionDetail } from "@/components/live/live-session-detail";

export const instant = false;
export const metadata = { title: "Live class" };

export default async function TeachLiveSessionPage({ params }: PageProps<"/teach/live/[id]">) {
  const { id } = await params;
  const user = await requireTeacher(`/teach/live/${id}`);
  return <LiveSessionDetail user={user} area="teach" sessionId={id} />;
}
