import { MessagesIndexScreen } from "@/components/communication/messaging/screens";

export const instant = false;
export const metadata = { title: "Messages" };

export default async function MessagesPage({ searchParams }: PageProps<"/admin/messages">) {
  return <MessagesIndexScreen area="admin" searchParams={await searchParams} />;
}
