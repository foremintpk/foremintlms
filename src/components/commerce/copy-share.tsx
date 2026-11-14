"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy, ExternalLink, Share2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Copy text to the clipboard, with a fallback for browsers without the async Clipboard API. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

/**
 * A generated Whop payment link with Copy, Share (Web Share API where
 * available) and Open actions. The URL is the real purchase URL Whop returned.
 */
export function PaymentLinkActions({ url, title, className, compact = false }: { url: string; title: string; className?: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  // Read on the client only (the server render has no navigator).
  const canShare = useSyncExternalStore(
    () => () => {},
    () => typeof navigator.share === "function",
    () => false,
  );

  async function copy() {
    const ok = await copyText(url);
    if (ok) {
      setCopied(true);
      toast.success("Payment link copied");
      setTimeout(() => setCopied(false), 2500);
    } else {
      toast.error("Couldn't copy automatically — select the link and copy it.");
    }
  }

  async function share() {
    try {
      await navigator.share({ title, text: "Here's the secure payment link for my Foremint Academy courses:", url });
    } catch {
      /* cancelled */
    }
  }

  const btn = "inline-flex h-10 items-center justify-center gap-2 rounded-full border bg-background px-3.5 text-sm font-semibold transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 outline-none";
  return (
    <div className={cn("grid gap-3", className)}>
      <label className="grid gap-1.5">
        <span className="sr-only">Payment link</span>
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 w-full min-w-0 truncate rounded-xl border bg-muted/50 px-3 font-mono text-xs text-foreground"
          data-testid="payment-link-url"
        />
      </label>
      <div className={cn("grid gap-2", compact ? "grid-cols-3" : "grid-cols-1 sm:grid-cols-3")}>
        <button type="button" onClick={() => void copy()} className={cn(btn, copied && "border-mint-strong/40 text-mint-strong")} data-testid="copy-payment-link">
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? "Copied" : "Copy link"}
        </button>
        <button type="button" onClick={() => void share()} disabled={!canShare} className={cn(btn, "disabled:opacity-50")} title={canShare ? undefined : "Sharing isn't supported in this browser — copy the link instead."}>
          <Share2 className="size-4" aria-hidden /> Share link
        </button>
        <a href={url} target="_blank" rel="noopener noreferrer" className={btn}>
          <ExternalLink className="size-4" aria-hidden /> Open checkout
        </a>
      </div>
    </div>
  );
}
