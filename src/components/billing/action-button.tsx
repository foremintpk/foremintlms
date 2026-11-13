"use client";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAction, type ClientActionResult } from "@/hooks/use-action";

/**
 * Runs a server action with a fixed input and reports the result as a toast.
 * `successHref` may contain {key} placeholders filled from the action's data.
 */
export function ActionButton<I, T>({
  action,
  input,
  children,
  pendingLabel,
  successHref,
  variant = "outline",
  size = "sm",
  className,
  disabled,
  title,
}: {
  action: (input: I) => Promise<ClientActionResult<T>>;
  input: I;
  children: React.ReactNode;
  pendingLabel?: string;
  successHref?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
  size?: "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm";
  className?: string;
  disabled?: boolean;
  title?: string;
}) {
  const router = useRouter();
  const { run, pending } = useAction(action, {
    onSuccess: (data) => {
      if (successHref) {
        const href = successHref.replace(/\{(\w+)\}/g, (_, k: string) => String((data as Record<string, unknown> | null)?.[k] ?? ""));
        router.push(href);
      } else {
        router.refresh();
      }
    },
  });
  return (
    <Button type="button" variant={variant} size={size} className={className} disabled={disabled || pending} title={title} onClick={() => void run(input)}>
      {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
