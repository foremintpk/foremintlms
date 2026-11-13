"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

/**
 * Single-series charts for instructor analytics. One series ⇒ no legend box
 * (the title names it); violet marks; recessive solid hairline grid; hover
 * tooltip on every mark; a data table for screen readers and exact values.
 */

const SERIES_COLOR = "var(--chart-1)";

export function ChartFrame({
  title,
  description,
  children,
  table,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  table: { headers: string[]; rows: (string | number)[][] };
  className?: string;
}) {
  return (
    <figure className={cn("rounded-2xl border bg-card p-5 shadow-card", className)}>
      <figcaption className="mb-4">
        <p className="font-heading text-base font-semibold">{title}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </figcaption>
      {children}
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">Show data table</summary>
        <div className="mt-2 max-h-72 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b">
                {table.headers.map((h) => (
                  <th key={h} className="py-1.5 pr-3 font-medium text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, i) => (
                <tr key={i} className="border-b last:border-0">
                  {row.map((cell, j) => (
                    <td key={j} className="py-1.5 pr-3 tabular-nums">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

function shortDate(iso: string, bucket: "day" | "week") {
  const d = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(d) + (bucket === "week" ? " wk" : "");
}

export function EnrollmentTrendChart({
  data,
  bucket,
}: {
  data: { date: string; enrollments: number }[];
  bucket: "day" | "week";
}) {
  const config = { enrollments: { label: "New enrollments", color: SERIES_COLOR } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={(v: string) => shortDate(v, bucket)} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
        <ChartTooltip
          cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
          content={<ChartTooltipContent indicator="line" labelFormatter={(v) => (typeof v === "string" ? shortDate(v, bucket) : String(v))} />}
        />
        <Area
          dataKey="enrollments"
          type="monotone"
          stroke="var(--color-enrollments)"
          strokeWidth={2}
          fill="var(--color-enrollments)"
          fillOpacity={0.1}
          activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
          dot={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}

/** Horizontal bars for a ranked list (completion rate, quiz averages…). */
export function RankedBarChart({
  data,
  valueLabel,
  max = 100,
  suffix = "%",
}: {
  data: { label: string; value: number; hint?: string }[];
  valueLabel: string;
  max?: number;
  suffix?: string;
}) {
  const config = { value: { label: valueLabel, color: SERIES_COLOR } } satisfies ChartConfig;
  const height = Math.max(120, data.length * 40 + 24);
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }} barCategoryGap={8}>
        <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="0" />
        <XAxis type="number" domain={[0, max]} hide />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={150}
          tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 21)}…` : v)}
        />
        <ChartTooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent hideIndicator formatter={(value, _name, item) => (
          <div className="grid gap-0.5">
            <span className="font-medium text-foreground">{`${value}${suffix}`}</span>
            {item?.payload?.hint ? <span className="text-muted-foreground">{item.payload.hint}</span> : null}
          </div>
        )} />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]} maxBarSize={24}>
          <LabelList dataKey="value" position="right" offset={8} className="fill-foreground text-xs" formatter={(v: unknown) => `${v}${suffix}`} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/** Columns in curriculum order — share of students who completed each lesson. */
export function DropoffChart({ data }: { data: { position: number; title: string; percent: number; completed: number; enrolled: number }[] }) {
  const config = { percent: { label: "Completed the lesson", color: SERIES_COLOR } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
        <XAxis dataKey="position" tickLine={false} axisLine={false} tickMargin={6} minTickGap={8} tickFormatter={(v: number) => `L${v}`} />
        <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => `${v}%`} />
        <ChartTooltip
          cursor={{ fill: "var(--muted)" }}
          content={
            <ChartTooltipContent
              hideIndicator
              labelFormatter={(_, payload) => {
                const p = payload?.[0]?.payload as { position: number; title: string } | undefined;
                return p ? `Lesson ${p.position}: ${p.title}` : "";
              }}
              formatter={(value, _n, item) => (
                <span className="text-foreground">
                  {`${value}%`} <span className="text-muted-foreground">({item?.payload?.completed} of {item?.payload?.enrolled} students)</span>
                </span>
              )}
            />
          }
        />
        <Bar dataKey="percent" fill="var(--color-percent)" radius={[4, 4, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ChartContainer>
  );
}
