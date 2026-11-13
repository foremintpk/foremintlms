"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/common/confirm-action";
import { disconnectMeetingAccountAction } from "@/lib/services/live/actions";

const LABEL = { zoom: "Zoom", google_meet: "Google Meet" } as const;

function ToastInner() {
  const params = useSearchParams();
  const router = useRouter();
  const shown = useRef(false);
  useEffect(() => {
    const provider = params.get("meeting") as keyof typeof LABEL | null;
    const status = params.get("status");
    if (shown.current || !provider || !status || !(provider in LABEL)) return;
    shown.current = true;
    const name = LABEL[provider];
    if (status === "connected") toast.success(`${name} connected`);
    else if (status === "denied") toast.error(`${name} wasn't connected — access was declined.`);
    else if (status === "not_configured") toast.error(`${name} isn't set up on this platform yet. Ask an administrator.`);
    else toast.error(params.get("reason") || `${name} couldn't be connected. Try again.`);
    // Drop the status params so a refresh doesn't repeat the message.
    const next = new URLSearchParams(params.toString());
    ["meeting", "status", "reason"].forEach((k) => next.delete(k));
    router.replace(`${window.location.pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  }, [params, router]);
  return null;
}

/** Shows the result of an OAuth round-trip (?meeting=zoom&status=connected). */
export function ConnectionResultToast() {
  return (
    <Suspense fallback={null}>
      <ToastInner />
    </Suspense>
  );
}

export function DisconnectButton({ provider }: { provider: "zoom" | "google_meet" }) {
  return (
    <ConfirmAction
      trigger={
        <Button variant="outline" size="sm">
          Disconnect
        </Button>
      }
      title={`Disconnect ${LABEL[provider]}?`}
      description={`Existing classes keep their links, but they can no longer be updated or synced through ${LABEL[provider]} until you reconnect.`}
      confirmLabel="Disconnect"
      destructive
      action={() => disconnectMeetingAccountAction({ provider })}
    />
  );
}
