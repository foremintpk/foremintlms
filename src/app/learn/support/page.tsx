import { MyTicketsScreen } from "@/components/communication/support/screens";

export const instant = false;
export const metadata = { title: "Support" };

export default async function SupportPage({ searchParams }: PageProps<"/learn/support">) {
  return <MyTicketsScreen searchParams={await searchParams} />;
}
