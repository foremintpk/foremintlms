import { TZDate } from "@date-fns/tz";
import { format, formatDistanceToNowStrict } from "date-fns";

/** Format integer minor units (cents) as currency. */
export function formatMoney(cents: number | null | undefined, currency = "usd", opts: { compact?: boolean } = {}): string {
  const value = (cents ?? 0) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: opts.compact && Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(n: number | null | undefined): string {
  return new Intl.NumberFormat("en-US").format(n ?? 0);
}

export function formatPercent(n: number | null | undefined, digits = 0): string {
  return `${(n ?? 0).toFixed(digits)}%`;
}

/** Date in a given IANA time zone (defaults to UTC for server rendering). */
export function formatDate(value: string | Date | null | undefined, pattern = "d MMM yyyy", timeZone = "UTC"): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return format(new TZDate(d, timeZone), pattern);
}

export function formatDateTime(value: string | Date | null | undefined, timeZone = "UTC"): string {
  return formatDate(value, "d MMM yyyy, HH:mm", timeZone);
}

export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

/** "1h 25m" from minutes. */
export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** "12:05" from seconds. */
export function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

export function formatBytes(bytes: number | null | undefined): string {
  const b = bytes ?? 0;
  if (b < 1024) return `${b} B`;
  const units = ["KB", "MB", "GB"];
  let v = b / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function firstName(name: string | null | undefined, fallback = "there"): string {
  return (name ?? "").trim().split(/\s+/)[0] || fallback;
}

/** Billing period in days → human label. */
export function billingPeriodLabel(days: number | null | undefined): string {
  if (!days) return "";
  if (days === 7) return "week";
  if (days === 30 || days === 31) return "month";
  if (days === 90) return "quarter";
  if (days === 365) return "year";
  return `${days} days`;
}

export function accessDurationLabel(days: number | null | undefined): string {
  if (!days) return "Lifetime access";
  if (days % 365 === 0) return `${days / 365} year${days === 365 ? "" : "s"} of access`;
  return `${days} days of access`;
}
