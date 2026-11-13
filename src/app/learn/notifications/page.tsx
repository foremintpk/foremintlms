import { PageHeader } from "@/components/app-shell/page-header";
import { NotificationsView } from "@/components/account/notifications-view";
import { requireUser } from "@/lib/auth/guards";

export const instant = false;

export const metadata = { title: "Notifications" };

export default async function LearnNotificationsPage({ searchParams }: PageProps<"/learn/notifications">) {
  const user = await requireUser("/learn/notifications");
  return (
    <>
      <PageHeader
        title="Notifications"
        description="Updates about your courses, live classes, messages and account."
      />
      <NotificationsView userId={user.id} basePath="/learn/notifications" searchParams={await searchParams} />
    </>
  );
}
