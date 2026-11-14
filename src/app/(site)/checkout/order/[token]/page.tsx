import type { Metadata } from "next";
import { OrderStatusView } from "@/components/commerce/order-status-view";

// Per-request: reads the order (and asks Whop for its status) for this token.
export const instant = false;

export const metadata: Metadata = {
  title: "Order status",
  robots: { index: false, follow: false },
};

export default async function OrderStatusPage({ params, searchParams }: PageProps<"/checkout/order/[token]">) {
  const { token } = await params;
  const search = await searchParams;
  const status = typeof search.status === "string" ? search.status : null;
  return <OrderStatusView token={token} providerStatus={status} returnedFromCheckout={Boolean(status)} />;
}
