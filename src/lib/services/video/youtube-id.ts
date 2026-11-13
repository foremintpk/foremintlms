/**
 * Extract an 11-character YouTube video ID from a URL or a bare ID.
 * Pure function (no I/O) so it can be shared by the server, the editor UI
 * and unit tests.
 */
const ID_RE = /^[A-Za-z0-9_-]{11}$/;

export function parseYouTubeId(input: string | null | undefined): string | null {
  if (!input) return null;
  const value = input.trim();
  if (ID_RE.test(value)) return value;

  let url: URL;
  try {
    url = new URL(value.startsWith("http") ? value : `https://${value}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, "").toLowerCase();

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    return ID_RE.test(id) ? id : null;
  }

  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const v = url.searchParams.get("v");
    if (v && ID_RE.test(v)) return v;
    const parts = url.pathname.split("/").filter(Boolean);
    const marker = parts.findIndex((p) => ["embed", "shorts", "live", "v", "e"].includes(p));
    if (marker >= 0) {
      const id = parts[marker + 1] ?? "";
      return ID_RE.test(id) ? id : null;
    }
  }
  return null;
}

export function youTubeThumbnail(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export function youTubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}
