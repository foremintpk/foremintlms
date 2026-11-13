import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  href?: string;
  tone?: "default" | "brand" | "success" | "warning";
  className?: string;
}) {
  const body = (
    <div
      className={cn(
        "group relative flex h-full flex-col justify-between gap-3 rounded-2xl border bg-card p-5 shadow-card transition-colors",
        href && "hover:border-primary/30",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon ? (
          <span
            className={cn(
              "grid size-8 place-items-center rounded-lg",
              tone === "brand" && "bg-brand-soft text-primary",
              tone === "success" && "bg-success-soft text-success",
              tone === "warning" && "bg-warning-soft text-warning",
              tone === "default" && "bg-muted text-muted-foreground",
            )}
          >
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>
      <div>
        <p className="font-heading text-[1.75rem] leading-none font-semibold tracking-tight tabular-nums">{value}</p>
        {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      {body}
    </Link>
  ) : (
    body
  );
}
