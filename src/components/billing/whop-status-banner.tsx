import Link from "next/link";
import { PlugZap, TriangleAlert } from "lucide-react";
import { getIntegration } from "@/lib/services/integrations";

/** Tells admins whether Whop is connected before they try to sell anything. */
export async function WhopStatusBanner() {
  const whop = await getIntegration("whop");
  const configured = Boolean(whop.apiKey && whop.companyId);
  if (configured && whop.webhookSecret) {
    return whop.environment === "sandbox" ? (
      <p className="mb-6 flex items-center gap-2 rounded-xl border border-info/30 bg-info-soft px-4 py-3 text-sm text-info">
        <PlugZap className="size-4 shrink-0" aria-hidden />
        Whop is connected in sandbox mode. No real money moves until you switch to production.
      </p>
    ) : null;
  }
  return (
    <div className="mb-6 flex flex-col gap-2 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-2">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        {configured
          ? "Whop is connected, but the webhook signing secret is missing — payments can't be confirmed and nobody will receive access."
          : "Whop is not connected. You can draft products and plans, but paid checkout stays unavailable until you add your Whop credentials."}
      </p>
      <Link href="/admin/integrations" className="shrink-0 font-semibold underline underline-offset-4">
        Open integrations
      </Link>
    </div>
  );
}
