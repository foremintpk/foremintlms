import { cn } from "@/lib/utils";

/** Learning progress. Mint is reserved for progress and completion. */
export function ProgressBar({
  value,
  label,
  showValue = false,
  className,
  size = "md",
}: {
  value: number;
  label?: string;
  showValue?: boolean;
  className?: string;
  size?: "sm" | "md";
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={label ?? "Progress"}
        className={cn("relative w-full overflow-hidden rounded-full bg-muted", size === "sm" ? "h-1.5" : "h-2")}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", pct >= 100 ? "bg-mint-strong" : "bg-mint")}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showValue ? <span className="w-10 shrink-0 text-right text-xs font-medium text-muted-foreground tabular-nums">{pct}%</span> : null}
    </div>
  );
}

/** Circular progress for summary tiles. */
export function ProgressRing({ value, size = 64, label }: { value: number; size?: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label ?? `${pct}% complete`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--mint)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (pct / 100) * c}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="fill-foreground font-heading text-[15px] font-semibold">
        {pct}%
      </text>
    </svg>
  );
}
