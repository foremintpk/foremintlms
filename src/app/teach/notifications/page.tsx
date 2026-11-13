import { PageHeader } from "@/components/app-shell/page-header";
import { NotificationsView } from "@/components/account/notifications-view";
import { requireTeacher } from "@/lib/auth/guards";

export const instant = false;

export const metadata = { title: "Notifications" };

export default async function TeachNotificationsPage({ searchParams }: PageProps<"/teach/notifications">) {
  const user = await requireTeacher("/teach/notifications");
  return (
    <>
      <PageHeader
        title="Notifications"
        description="Submissions to review, student questions, live class changes and account activity."
      />
      <NotificationsView userId={user.id} basePath="/teach/notifications" searchParams={await searchParams} />
    </>
  );
}
