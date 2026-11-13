import Link from "next/link";
import { cn } from "@/lib/utils";

export interface BarListItem {
  key: string;
  label: string;
  value: number;
  /** Formatted value shown at the bar end (text tokens, never the bar colour). */
  display: string;
  sub?: string;
  href?: string;
}

/**
 * Ranked horizontal bars (single hue). Each row carries its label and value
 * as text, so the chart doubles as its own table.
 */
export function BarList({ items, max, className, emptyLabel = "No data in this period yet." }: {
  items: BarListItem[];
  max?: number;
  className?: string;
  emptyLabel?: string;
}) {
  if (items.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  const top = max ?? Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className={cn("space-y-3", className)}>
      {items.map((item) => {
        const pct = top > 0 ? Math.max(2, Math.round((item.value / top) * 100)) : 0;
        const label = (
          <span className="min-w-0 truncate font-medium text-foreground group-hover:underline">{item.label}</span>
        );
        return (
          <li key={item.key} className="group" title={`${item.label}: ${item.display}`}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              {item.href ? (
                <Link href={item.href} className="min-w-0 truncate outline-none focus-visible:underline">
                  {label}
                </Link>
              ) : (
                label
              )}
              <span className="shrink-0 tabular-nums text-muted-foreground">
                <span className="font-medium text-foreground">{item.display}</span>
                {item.sub ? <span className="ml-1.5 text-xs">{item.sub}</span> : null}
              </span>
            </div>
            <div className="h-2 w-full rounded-r-[4px] bg-muted" aria-hidden>
              <div className="h-2 rounded-r-[4px] bg-[var(--chart-1)]" style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
