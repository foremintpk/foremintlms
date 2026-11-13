import { MessagesIndexScreen } from "@/components/communication/messaging/screens";

export const instant = false;
export const metadata = { title: "Messages" };

export default async function MessagesPage({ searchParams }: PageProps<"/learn/messages">) {
  return <MessagesIndexScreen area="learn" searchParams={await searchParams} />;
}
