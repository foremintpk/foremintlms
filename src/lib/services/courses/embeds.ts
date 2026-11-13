import { parseYouTubeId } from "@/lib/services/video/youtube-id";

/**
 * Embed allow-list. Authors paste a normal share link; we only ever store
 * and render a canonical embed URL on a known host, so a lesson can never
 * frame an arbitrary site. Pure function (shared by server, UI and tests).
 */
export type EmbedProvider =
  | "youtube"
  | "vimeo"
  | "loom"
  | "google_docs"
  | "google_slides"
  | "google_sheets"
  | "google_forms"
  | "google_drive"
  | "figma"
  | "codepen"
  | "miro";

export interface NormalizedEmbed {
  provider: EmbedProvider;
  embedUrl: string;
}

export const EMBED_PROVIDER_LABELS: Record<EmbedProvider, string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  loom: "Loom",
  google_docs: "Google Docs",
  google_slides: "Google Slides",
  google_sheets: "Google Sheets",
  google_forms: "Google Forms",
  google_drive: "Google Drive",
  figma: "Figma",
  codepen: "CodePen",
  miro: "Miro",
};

/** Hosts the player is allowed to frame (used for the iframe allow-list check). */
export const EMBED_HOSTS = [
  "www.youtube-nocookie.com",
  "player.vimeo.com",
  "www.loom.com",
  "docs.google.com",
  "drive.google.com",
  "www.figma.com",
  "codepen.io",
  "miro.com",
];

const SAFE_ID = /^[A-Za-z0-9_-]+$/;

export function normalizeEmbedUrl(input: string): NormalizedEmbed | null {
  const raw = input.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  // YouTube (watch, share, shorts, embed)
  if (["youtube.com", "m.youtube.com", "youtu.be", "youtube-nocookie.com"].includes(host)) {
    const id = parseYouTubeId(raw);
    return id ? { provider: "youtube", embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0` } : null;
  }

  // Vimeo: vimeo.com/123456789[/hash] or player.vimeo.com/video/123456789?h=hash
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const idx = host === "player.vimeo.com" ? parts.indexOf("video") + 1 : 0;
    const id = parts[idx];
    if (!id || !/^\d+$/.test(id)) return null;
    const hash = url.searchParams.get("h") ?? (host === "vimeo.com" && parts[1] && SAFE_ID.test(parts[1]) ? parts[1] : null);
    return { provider: "vimeo", embedUrl: `https://player.vimeo.com/video/${id}${hash ? `?h=${hash}` : ""}` };
  }

  // Loom: loom.com/share/<id> or /embed/<id>
  if (host === "loom.com") {
    const marker = parts.findIndex((p) => p === "share" || p === "embed");
    const id = marker >= 0 ? parts[marker + 1] : undefined;
    return id && SAFE_ID.test(id) ? { provider: "loom", embedUrl: `https://www.loom.com/embed/${id}` } : null;
  }

  // Google Workspace documents
  if (host === "docs.google.com") {
    const [kind, d, id] = parts;
    if (d === "d" && id && SAFE_ID.test(id)) {
      if (kind === "document") return { provider: "google_docs", embedUrl: `https://docs.google.com/document/d/${id}/preview` };
      if (kind === "presentation") return { provider: "google_slides", embedUrl: `https://docs.google.com/presentation/d/${id}/embed?start=false&loop=false` };
      if (kind === "spreadsheets") return { provider: "google_sheets", embedUrl: `https://docs.google.com/spreadsheets/d/${id}/preview` };
    }
    if (kind === "forms" && parts[1] === "d") {
      // /forms/d/e/<id>/viewform  or  /forms/d/<id>/viewform
      const id = parts[2] === "e" ? parts[3] : parts[2];
      const prefix = parts[2] === "e" ? "d/e" : "d";
      if (id && SAFE_ID.test(id)) {
        return { provider: "google_forms", embedUrl: `https://docs.google.com/forms/${prefix}/${id}/viewform?embedded=true` };
      }
    }
    return null;
  }

  if (host === "drive.google.com") {
    const marker = parts.indexOf("d");
    const id = parts[0] === "file" && marker === 1 ? parts[2] : url.searchParams.get("id");
    return id && SAFE_ID.test(id) ? { provider: "google_drive", embedUrl: `https://drive.google.com/file/d/${id}/preview` } : null;
  }

  // Figma files, designs and prototypes
  if (host === "figma.com") {
    if (!["file", "design", "proto", "board", "slides"].includes(parts[0] ?? "")) return null;
    if (!parts[1] || !SAFE_ID.test(parts[1])) return null;
    return {
      provider: "figma",
      embedUrl: `https://www.figma.com/embed?embed_host=foremint&url=${encodeURIComponent(`https://www.figma.com${url.pathname}${url.search}`)}`,
    };
  }

  // CodePen: codepen.io/<user>/pen/<id>
  if (host === "codepen.io") {
    const [user, kind, id] = parts;
    if (user && (kind === "pen" || kind === "embed") && id && SAFE_ID.test(user) && SAFE_ID.test(id)) {
      return { provider: "codepen", embedUrl: `https://codepen.io/${user}/embed/${id}?default-tab=result` };
    }
    return null;
  }

  // Miro: miro.com/app/board/<id>/
  if (host === "miro.com") {
    const [app, board, id] = parts;
    if (app === "app" && (board === "board" || board === "live-embed") && id && /^[A-Za-z0-9_=-]+$/.test(id)) {
      return { provider: "miro", embedUrl: `https://miro.com/app/live-embed/${id}/` };
    }
    return null;
  }

  return null;
}

/** True when a stored embed URL is on an allow-listed host (defence in depth for renderers). */
export function isAllowedEmbedUrl(embedUrl: string): boolean {
  try {
    const u = new URL(embedUrl);
    return u.protocol === "https:" && EMBED_HOSTS.includes(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}
