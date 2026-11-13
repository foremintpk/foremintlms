"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyButton({ value, label = "Copy link", copiedLabel = "Link copied" }: { value: string; label?: string; copiedLabel?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success(copiedLabel);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          toast.error("Copy failed. Select the link and copy it manually.");
        }
      }}
    >
      {copied ? <Check /> : <Copy />} {copied ? "Copied" : label}
    </Button>
  );
}
