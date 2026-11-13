import { ConversationScreen } from "@/components/communication/messaging/screens";

export const instant = false;
export const metadata = { title: "Conversation" };

export default async function ConversationPage({ params }: PageProps<"/admin/messages/[id]">) {
  const { id } = await params;
  return <ConversationScreen area="admin" id={id} />;
}
