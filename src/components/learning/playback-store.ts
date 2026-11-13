"use client";

/**
 * Tiny cross-component channel for the lesson page: the video player
 * publishes its current time; bookmarks/notes read it and can request seeks.
 */

type Listener = () => void;

let currentTime = 0;
let activeLessonId: string | null = null;
const timeListeners = new Set<Listener>();
const seekListeners = new Set<(seconds: number) => void>();

export const playbackStore = {
  setTime(lessonId: string, seconds: number) {
    activeLessonId = lessonId;
    currentTime = seconds;
    for (const l of timeListeners) l();
  },
  getTime(lessonId: string): number {
    return activeLessonId === lessonId ? currentTime : 0;
  },
  subscribe(listener: Listener) {
    timeListeners.add(listener);
    return () => {
      timeListeners.delete(listener);
    };
  },
  seek(seconds: number) {
    for (const l of seekListeners) l(seconds);
  },
  onSeek(listener: (seconds: number) => void) {
    seekListeners.add(listener);
    return () => {
      seekListeners.delete(listener);
    };
  },
  hasPlayer() {
    return seekListeners.size > 0;
  },
};

/** Send progress to the server; `beacon` survives page unload. */
export function reportProgress(lessonId: string, positionSeconds: number, durationSeconds: number | null, beacon = false): Promise<{ completed?: boolean } | null> {
  const body = JSON.stringify({
    lessonId,
    positionSeconds: Math.max(0, Math.round(positionSeconds * 100) / 100),
    durationSeconds: durationSeconds && Number.isFinite(durationSeconds) ? Math.round(durationSeconds * 100) / 100 : null,
  });
  if (beacon && typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    navigator.sendBeacon("/api/progress", new Blob([body], { type: "text/plain" }));
    return Promise.resolve(null);
  }
  return fetch("/api/progress", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } })
    .then((r) => (r.ok ? (r.json() as Promise<{ completed?: boolean }>) : null))
    .catch(() => null);
}
