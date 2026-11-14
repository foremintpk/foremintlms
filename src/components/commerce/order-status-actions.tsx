"use client";

import { useState } from "react";
import { Loader2, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";

async function post(token: string, action: "resend_activation" | "retry_link") {
  try {
    const res = await fetch(`/api/commerce/orders/${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
      credentials: "same-origin",
    });
    return ((await res.json().catch(() => null)) as { ok: boolean; error?: string; message?: string; paymentUrl?: string } | null) ?? { ok: false, error: "Something went wrong." };
  } catch {
    return { ok: false, error: "We couldn't reach the server." };
  }
}

export function ResendActivationButton({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await post(token, "resend_activation");
        setBusy(false);
        if (res.ok) toast.success(res.message ?? "Activation email sent");
        else toast.error(res.error ?? "Couldn't resend the email");
      }}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-full border bg-background px-5 text-sm font-semibold hover:bg-muted disabled:opacity-50"
      data-testid="resend-activation"
    >
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
      Resend activation email
    </button>
  );
}

export function RetryLinkButton({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await post(token, "retry_link");
        if (res.ok && res.paymentUrl) {
          window.location.assign(res.paymentUrl);
          return;
        }
        setBusy(false);
        toast.error(res.error ?? "Couldn't create the payment link");
      }}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-raised hover:bg-brand-strong disabled:opacity-50"
    >
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
      Try creating the payment link again
    </button>
  );
}
