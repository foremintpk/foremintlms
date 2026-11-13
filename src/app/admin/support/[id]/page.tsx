import { TicketDetailScreen } from "@/components/communication/support/screens";

export const instant = false;
export const metadata = { title: "Support ticket" };

export default async function TicketPage({ params }: PageProps<"/admin/support/[id]">) {
  const { id } = await params;
  return <TicketDetailScreen area="admin" id={id} />;
}
