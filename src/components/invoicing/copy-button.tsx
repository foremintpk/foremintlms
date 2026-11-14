"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Copies `value` to the clipboard (with a fallback for older browsers) and confirms it. */
export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  variant = "outline",
  size = "sm",
  className,
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "xs" | "icon-sm";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const el = document.createElement("textarea");
        el.value = value;
        el.setAttribute("readonly", "");
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        el.remove();
      }
      setCopied(true);
      toast.success("Payment link copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Select the link and copy it manually.");
    }
  };

  return (
    <Button type="button" variant={variant} size={size} className={className} onClick={() => void copy()} data-testid="copy-payment-link">
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      {copied ? copiedLabel : label}
    </Button>
  );
}
