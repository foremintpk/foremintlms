import { NewTicketScreen } from "@/components/communication/support/screens";

export const instant = false;
export const metadata = { title: "Open a support ticket" };

export default async function NewTicketPage({ searchParams }: PageProps<"/learn/support/new">) {
  return <NewTicketScreen searchParams={await searchParams} />;
}
