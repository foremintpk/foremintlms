"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          setCopied(false);
        }
      }}
      aria-label={copied ? "Copied" : `${label}: ${value}`}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "Copied" : label}
    </Button>
  );
}

/** A read-only value with a copy button (webhook URLs, IDs). */
export function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg border bg-muted/50 px-2.5 py-1.5 font-mono text-xs">{value}</code>
        <CopyButton value={value} />
      </div>
    </div>
  );
}
