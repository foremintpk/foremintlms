/**
 * Pure learner-side helpers shared by server pages and client components.
 * No I/O — unit tested in tests/unit/learning.
 */

/** A video lesson counts as watched at this percentage. */
export const VIDEO_COMPLETION_THRESHOLD = 90;

export type CompletionRule = "manual" | "video_watched" | "quiz_passed" | "assignment_approved";

export function videoPercent(positionSeconds: number, durationSeconds: number | null | undefined): number {
  if (!durationSeconds || durationSeconds <= 0 || !Number.isFinite(durationSeconds)) return 0;
  const pct = (Math.max(0, positionSeconds) / durationSeconds) * 100;
  return Math.min(100, Math.round(pct * 100) / 100);
}

export function shouldAutoComplete(rule: CompletionRule, percent: number): boolean {
  return rule === "video_watched" && percent >= VIDEO_COMPLETION_THRESHOLD;
}

/** Resume a little before the saved point; restart when the video was finished. */
export function resumePosition(savedSeconds: number | null | undefined, durationSeconds: number | null | undefined): number {
  const saved = Math.max(0, Number(savedSeconds ?? 0));
  if (saved < 5) return 0;
  if (durationSeconds && saved >= durationSeconds - 10) return 0;
  return Math.max(0, Math.floor(saved - 3));
}

export interface EmbedSource {
  provider: "youtube" | "vimeo" | "loom" | "google" | "figma" | "codepen" | "miro";
  src: string;
  title: string;
}

/**
 * Turn a pasted URL into an embeddable URL from an allow-listed provider.
 * Anything else returns null and is rendered as a plain external link.
 */
export function embedSource(raw: string | null | undefined): EmbedSource | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be" || host === "youtube-nocookie.com") {
    let id: string | null = null;
    if (host === "youtu.be") id = parts[0] ?? null;
    else if (parts[0] === "watch") id = url.searchParams.get("v");
    else if (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live") id = parts[1] ?? null;
    if (!id || !/^[A-Za-z0-9_-]{6,20}$/.test(id)) return null;
    return { provider: "youtube", src: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`, title: "YouTube video" };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = parts.find((p) => /^\d{5,12}$/.test(p));
    if (!id) return null;
    return { provider: "vimeo", src: `https://player.vimeo.com/video/${id}?dnt=1`, title: "Vimeo video" };
  }
  if (host === "loom.com") {
    const id = parts[0] === "share" || parts[0] === "embed" ? parts[1] : null;
    if (!id || !/^[A-Za-z0-9]{10,64}$/.test(id)) return null;
    return { provider: "loom", src: `https://www.loom.com/embed/${id}`, title: "Loom video" };
  }
  if (host === "docs.google.com") {
    const kind = parts[0];
    const id = parts[1] === "d" ? parts[2] : null;
    if (!id || !/^[A-Za-z0-9_-]{10,}$/.test(id)) return null;
    if (kind === "document") return { provider: "google", src: `https://docs.google.com/document/d/${id}/preview`, title: "Google Doc" };
    if (kind === "presentation") return { provider: "google", src: `https://docs.google.com/presentation/d/${id}/embed`, title: "Google Slides" };
    if (kind === "spreadsheets") return { provider: "google", src: `https://docs.google.com/spreadsheets/d/${id}/preview`, title: "Google Sheet" };
    return null;
  }
  if (host === "figma.com") {
    if (!["file", "design", "proto", "board"].includes(parts[0] ?? "")) return null;
    return {
      provider: "figma",
      src: `https://www.figma.com/embed?embed_host=foremint&url=${encodeURIComponent(url.toString())}`,
      title: "Figma file",
    };
  }
  if (host === "codepen.io") {
    const user = parts[0];
    const id = parts[1] === "pen" || parts[1] === "embed" ? parts[2] : null;
    if (!user || !id || !/^[A-Za-z0-9]+$/.test(id) || !/^[A-Za-z0-9_-]+$/.test(user)) return null;
    return { provider: "codepen", src: `https://codepen.io/${user}/embed/${id}?default-tab=result`, title: "CodePen" };
  }
  if (host === "miro.com") {
    const idx = parts.indexOf("board");
    const id = idx >= 0 ? parts[idx + 1] : null;
    if (!id || !/^[A-Za-z0-9_=-]+$/.test(id)) return null;
    return { provider: "miro", src: `https://miro.com/app/live-embed/${id}/`, title: "Miro board" };
  }
  return null;
}

/** Only https links leave the platform (join URLs, external links). */
export function isSafeExternalUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** Live classes can be joined from 15 minutes before start until they end. */
export const JOIN_WINDOW_MINUTES = 15;

export function liveJoinState(
  startsAt: string,
  durationMinutes: number,
  status: string,
  now: Date = new Date(),
): "upcoming" | "joinable" | "ended" | "canceled" {
  if (status === "canceled") return "canceled";
  const start = new Date(startsAt).getTime();
  const end = start + durationMinutes * 60_000;
  if (status === "completed" || now.getTime() > end) return "ended";
  if (now.getTime() >= start - JOIN_WINDOW_MINUTES * 60_000) return "joinable";
  return "upcoming";
}

/** Minimal iCalendar escaping (RFC 5545 §3.3.11). */
export function icsEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

export function icsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Fold long content lines to 75 octets as RFC 5545 requires. */
export function icsFold(line: string): string {
  if (line.length <= 74) return line;
  const chunks: string[] = [];
  for (let i = 0; i < line.length; i += 73) chunks.push((i === 0 ? "" : " ") + line.slice(i, i + 73));
  return chunks.join("\r\n");
}

export function buildIcs(event: {
  uid: string;
  title: string;
  description?: string | null;
  url?: string | null;
  start: Date;
  durationMinutes: number;
  stamp: Date;
}): string {
  const end = new Date(event.start.getTime() + event.durationMinutes * 60_000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Foremint Academy//Live classes//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${icsDate(event.stamp)}`,
    `DTSTART:${icsDate(event.start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsEscape(event.title)}`,
    event.description ? `DESCRIPTION:${icsEscape(event.description)}` : null,
    event.url ? `URL:${icsEscape(event.url)}` : null,
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape(event.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((l): l is string => l !== null);
  return lines.map(icsFold).join("\r\n") + "\r\n";
}

/** ISO timestamp n hours before now (server components read the clock through this helper). */
export function isoHoursAgo(hours: number, from: number = Date.now()): string {
  return new Date(from - hours * 3_600_000).toISOString();
}
