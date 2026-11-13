"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";

export interface SeriesPoint {
  bucket: string;
  value: number;
}

type Format = "number" | "currency";

function formatValue(value: number, format: Format, currency: string, compact = false) {
  if (format === "currency") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      notation: compact && Math.abs(value / 100) >= 10_000 ? "compact" : "standard",
      maximumFractionDigits: compact ? 0 : 2,
    }).format(value / 100);
  }
  if (compact && Math.abs(value) >= 10_000) {
    return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
  }
  return new Intl.NumberFormat("en-US").format(value);
}

function formatBucket(iso: string, bucket: "day" | "week" | "month", long = false) {
  const d = new Date(`${iso}T00:00:00Z`);
  if (bucket === "month") {
    return new Intl.DateTimeFormat("en-GB", { month: "short", year: long ? "numeric" : "2-digit", timeZone: "UTC" }).format(d);
  }
  const text = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC", ...(long ? { year: "numeric" } : {}) }).format(d);
  return bucket === "week" && long ? `Week of ${text}` : text;
}

/**
 * Single-series trend: 2px line over a 10% wash, hairline horizontal grid,
 * crosshair tooltip, and a table view for screen readers and exact values.
 * One series ⇒ no legend box; the card title names what is plotted.
 */
export function TimeSeriesChart({
  data,
  label,
  bucket,
  format = "number",
  currency = "usd",
  height = 220,
}: {
  data: SeriesPoint[];
  label: string;
  bucket: "day" | "week" | "month";
  format?: Format;
  currency?: string;
  height?: number;
}) {
  const config = { value: { label, color: "var(--chart-1)" } } satisfies ChartConfig;
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div>
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`wash-${label.replace(/\W/g, "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.12} />
              <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
          <XAxis
            dataKey="bucket"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            tickFormatter={(v: string) => formatBucket(v, bucket)}
            className="text-xs"
          />
          <YAxis
            width={56}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            tickFormatter={(v: number) => formatValue(v, format, currency, true)}
            className="text-xs"
          />
          <ChartTooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0].payload as SeriesPoint;
              return (
                <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                  <p className="text-muted-foreground">{formatBucket(point.bucket, bucket, true)}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 font-semibold text-foreground tabular-nums">
                    <span className="size-2 rounded-full bg-[var(--color-value)]" aria-hidden />
                    {formatValue(point.value, format, currency)}
                  </p>
                </div>
              );
            }}
          />
          <Area
            dataKey="value"
            type="monotone"
            stroke="var(--color-value)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={`url(#wash-${label.replace(/\W/g, "")})`}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ChartContainer>
      <details className="mt-2 text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none hover:text-foreground">View as table</summary>
        <div className="mt-2 max-h-56 overflow-auto rounded-lg border">
          <table className="w-full text-left">
            <caption className="sr-only">{label}</caption>
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th className="px-3 py-1.5 font-medium">Period</th>
                <th className="px-3 py-1.5 text-right font-medium">{label}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.bucket} className="border-t">
                  <td className="px-3 py-1.5">{formatBucket(d.bucket, bucket, true)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-foreground">{formatValue(d.value, format, currency)}</td>
                </tr>
              ))}
              <tr className="border-t font-medium text-foreground">
                <td className="px-3 py-1.5">Total</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formatValue(total, format, currency)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
