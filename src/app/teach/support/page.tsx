import { StaffTicketsScreen } from "@/components/communication/support/screens";

export const instant = false;
export const metadata = { title: "Support tickets" };

export default async function StaffSupportPage({ searchParams }: PageProps<"/teach/support">) {
  return <StaffTicketsScreen area="teach" searchParams={await searchParams} />;
}
