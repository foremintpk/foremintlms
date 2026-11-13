import { AlertTriangle, CheckCircle2, PlugZap } from "lucide-react";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { isMeetingProviderConfigured, listConnectionSummaries } from "@/lib/services/live/providers";
import type { MeetingProviderId } from "@/lib/services/live/types";
import { ConnectionResultToast, DisconnectButton } from "./meeting-accounts-client";

const PROVIDERS: { id: MeetingProviderId; name: string; path: "zoom" | "google"; body: string }[] = [
  {
    id: "zoom",
    name: "Zoom",
    path: "zoom",
    body: "Create Zoom meetings for your classes, keep them in sync when you reschedule, and import cloud recordings and attendance where your Zoom plan allows.",
  },
  {
    id: "google_meet",
    name: "Google Meet",
    path: "google",
    body: "Create Google Meet links for your classes. Attendance and recordings are imported when your Google Workspace edition supports them.",
  },
];

/** Connect/disconnect the signed-in user's own Zoom and Google accounts. */
export async function MeetingAccounts({ userId, returnTo }: { userId: string; returnTo: string }) {
  const [connections, zoomConfigured, googleConfigured] = await Promise.all([
    listConnectionSummaries(userId),
    isMeetingProviderConfigured("zoom"),
    isMeetingProviderConfigured("google_meet"),
  ]);
  const configured: Record<MeetingProviderId, boolean> = { zoom: zoomConfigured, google_meet: googleConfigured };

  return (
    <div className="grid gap-4">
      <ConnectionResultToast />
      {PROVIDERS.map((p) => {
        const connection = connections.find((c) => c.provider === p.id);
        const connectHref = `/api/integrations/${p.path}/connect?returnTo=${encodeURIComponent(returnTo)}`;
        return (
          <section key={p.id} className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-card sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-heading text-base font-semibold">{p.name}</h3>
                {!configured[p.id] ? (
                  <StatusBadge status="not_configured" label="Not set up" />
                ) : !connection ? (
                  <StatusBadge status="not_configured" label="Not connected" />
                ) : connection.status === "connected" ? (
                  <StatusBadge status="connected" />
                ) : (
                  <StatusBadge status="error" label="Reconnect needed" />
                )}
              </div>
              <p className="max-w-xl text-sm text-muted-foreground">{p.body}</p>
              {connection ? (
                <p className="flex items-center gap-1.5 text-sm">
                  {connection.status === "connected" ? (
                    <CheckCircle2 className="size-4 text-success" />
                  ) : (
                    <AlertTriangle className="size-4 text-warning" />
                  )}
                  {connection.account_email ?? "Connected account"} · since {formatDate(connection.updated_at)}
                </p>
              ) : null}
              {connection && connection.status !== "connected" && connection.last_error ? (
                <p className="text-xs text-warning">{connection.last_error}</p>
              ) : null}
              {!configured[p.id] ? (
                <p className="text-xs text-muted-foreground">
                  An administrator needs to add the {p.name} app credentials in Admin → Integrations. You can still schedule classes with an external meeting link.
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 gap-2">
              {configured[p.id] ? (
                <Button asChild size="sm" variant={connection?.status === "connected" ? "outline" : "default"}>
                  <a href={connectHref}>
                    <PlugZap /> {connection ? (connection.status === "connected" ? "Reconnect" : "Reconnect account") : `Connect ${p.name}`}
                  </a>
                </Button>
              ) : null}
              {connection ? <DisconnectButton provider={p.id} /> : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
