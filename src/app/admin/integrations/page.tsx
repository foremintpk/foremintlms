import { PageHeader } from "@/components/app-shell/page-header";
import { IntegrationCard } from "@/components/admin/integrations/integration-card";
import { requireAdmin } from "@/lib/auth/guards";
import { getProviderStates } from "@/lib/services/admin/integrations-admin";

export const instant = false;
export const metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  await requireAdmin("/admin/integrations");
  const providers = await getProviderStates();
  const connected = providers.filter((p) => p.status === "connected" || p.status === "configured").length;
  return (
    <>
      <PageHeader
        title="Integrations"
        description={`${connected} of ${providers.length} services have credentials. Environment variables always take priority over values saved here; secrets are stored encrypted and never shown again.`}
      />
      <div className="grid gap-6">
        {providers.map((p) => (
          <IntegrationCard key={p.id} provider={p} />
        ))}
      </div>
    </>
  );
}
