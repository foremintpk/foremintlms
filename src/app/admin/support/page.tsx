import { StaffTicketsScreen } from "@/components/communication/support/screens";

export const instant = false;
export const metadata = { title: "Support tickets" };

export default async function StaffSupportPage({ searchParams }: PageProps<"/admin/support">) {
  return <StaffTicketsScreen area="admin" searchParams={await searchParams} />;
}
