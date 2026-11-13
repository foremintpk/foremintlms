"use client";

import { useRouter } from "next/navigation";
import { RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { cancelOutboxEmailAction, retryOutboxEmailAction } from "../actions";

export function OutboxActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const retry = useAction(retryOutboxEmailAction, { onSuccess: () => router.refresh() });
  const cancel = useAction(cancelOutboxEmailAction, { onSuccess: () => router.refresh() });
  const canRetry = ["failed", "cancelled", "skipped"].includes(status);
  const canCancel = ["pending", "failed"].includes(status);
  if (!canRetry && !canCancel) return null;
  return (
    <div className="flex items-center gap-1">
      {canRetry ? (
        <Button type="button" size="sm" variant="outline" disabled={retry.pending} onClick={() => retry.run({ id })}>
          <RotateCcw className="size-3.5" /> Retry
        </Button>
      ) : null}
      {canCancel ? (
        <Button type="button" size="sm" variant="ghost" disabled={cancel.pending} onClick={() => cancel.run({ id })}>
          <X className="size-3.5" /> Cancel
        </Button>
      ) : null}
    </div>
  );
}
