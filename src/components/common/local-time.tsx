"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Renders a UTC timestamp in the viewer's own time zone. The server renders
 * a UTC fallback (no hydration mismatch), the browser swaps in local time.
 */
export function LocalTime({
  value,
  format = "datetime",
  className,
}: {
  value: string | null | undefined;
  format?: "date" | "datetime" | "time" | "weekday" | "relative";
  className?: string;
}) {
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  if (!value) return <span className={className}>—</span>;
  const date = new Date(value);
  const tz = isClient ? undefined : "UTC";

  let text: string;
  if (format === "relative" && isClient) {
    const diff = date.getTime() - Date.now();
    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    const abs = Math.abs(diff);
    const units: [Intl.RelativeTimeFormatUnit, number][] = [
      ["year", 31536000000],
      ["month", 2592000000],
      ["week", 604800000],
      ["day", 86400000],
      ["hour", 3600000],
      ["minute", 60000],
    ];
    const unit = units.find(([, ms]) => abs >= ms) ?? ["minute", 60000];
    text = rtf.format(Math.round(diff / unit[1]), unit[0]);
  } else {
    const options: Intl.DateTimeFormatOptions =
      format === "date"
        ? { day: "numeric", month: "short", year: "numeric" }
        : format === "time"
          ? { hour: "2-digit", minute: "2-digit" }
          : format === "weekday"
            ? { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
            : { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" };
    text = new Intl.DateTimeFormat("en-GB", { ...options, timeZone: tz, timeZoneName: format === "date" ? undefined : isClient ? "short" : undefined }).format(date);
    if (!isClient && format !== "date") text += " UTC";
  }

  return (
    <time dateTime={value} className={className} suppressHydrationWarning>
      {text}
    </time>
  );
}
