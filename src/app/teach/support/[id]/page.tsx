import { TicketDetailScreen } from "@/components/communication/support/screens";

export const instant = false;
export const metadata = { title: "Support ticket" };

export default async function TicketPage({ params }: PageProps<"/teach/support/[id]">) {
  const { id } = await params;
  return <TicketDetailScreen area="teach" id={id} />;
}
