"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MuxPlayer from "@mux/mux-player-react/lazy";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PlaybackSource } from "@/lib/services/video/types";
import { playbackStore, reportProgress } from "./playback-store";

const REPORT_EVERY_MS = 10_000;

// ---------------------------------------------------------------------------
// Progress reporting shared by every provider
// ---------------------------------------------------------------------------

function useProgressReporter(lessonId: string, track: boolean) {
  const router = useRouter();
  const last = useRef({ pos: 0, dur: null as number | null, sentAt: 0, sentPos: -1 });
  const completed = useRef(false);

  const send = useCallback(
    (beacon = false) => {
      if (!track) return;
      const { pos, dur, sentPos } = last.current;
      if (Math.abs(pos - sentPos) < 1 && !beacon) return;
      last.current.sentAt = Date.now();
      last.current.sentPos = pos;
      void reportProgress(lessonId, pos, dur, beacon).then((res) => {
        if (res?.completed && !completed.current) {
          completed.current = true;
          router.refresh();
        }
      });
    },
    [lessonId, router, track],
  );

  const tick = useCallback(
    (pos: number, dur: number | null) => {
      if (!Number.isFinite(pos)) return;
      last.current.pos = pos;
      if (dur && Number.isFinite(dur)) last.current.dur = dur;
      playbackStore.setTime(lessonId, pos);
      if (Date.now() - last.current.sentAt >= REPORT_EVERY_MS) send();
    },
    [lessonId, send],
  );

  useEffect(() => {
    if (!track) return;
    const flush = () => send(true);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, [send, track]);

  return { tick, flush: () => send(false) };
}

interface ProviderProps {
  onTime: (pos: number, dur: number | null) => void;
  onPauseOrEnd: () => void;
  onError: (message: string) => void;
}

// ---------------------------------------------------------------------------
// YouTube (privacy-enhanced IFrame API)
// ---------------------------------------------------------------------------

interface YTPlayer {
  getCurrentTime(): number;
  getDuration(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  destroy(): void;
}
interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      host?: string;
      videoId: string;
      width?: string;
      height?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: () => void;
        onStateChange?: (e: { data: number }) => void;
        onError?: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
    playerjs?: { Player: new (iframe: HTMLIFrameElement) => PlayerJs };
  }
}

let youTubeApi: Promise<YTNamespace> | null = null;
function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youTubeApi) return youTubeApi;
  youTubeApi = new Promise<YTNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      youTubeApi = null;
      reject(new Error("YouTube player could not load"));
    };
    document.head.appendChild(script);
    setTimeout(() => reject(new Error("YouTube player timed out")), 15_000);
  });
  return youTubeApi;
}

const YT_ERRORS: Record<number, string> = {
  2: "The video link is invalid.",
  5: "This video can't be played in the browser.",
  100: "This video was removed or made private.",
  101: "The video owner doesn't allow embedding.",
  150: "The video owner doesn't allow embedding.",
};

function YouTubeVideo({ videoId, startSeconds, title, onTime, onPauseOrEnd, onError }: ProviderProps & { videoId: string; startSeconds: number; title: string }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let player: YTPlayer | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let disposed = false;
    const stopPoll = () => {
      if (poll) clearInterval(poll);
      poll = null;
    };
    loadYouTubeApi()
      .then((YT) => {
        if (disposed || !host.current) return;
        const mount = document.createElement("div");
        host.current.replaceChildren(mount);
        player = new YT.Player(mount, {
          host: "https://www.youtube-nocookie.com",
          videoId,
          width: "100%",
          height: "100%",
          playerVars: { start: Math.floor(startSeconds), rel: 0, modestbranding: 1, playsinline: 1, origin: window.location.origin },
          events: {
            onReady: () => {
              host.current?.querySelector("iframe")?.setAttribute("title", title);
            },
            onStateChange: (e) => {
              if (e.data === 1) {
                stopPoll();
                poll = setInterval(() => player && onTime(player.getCurrentTime(), player.getDuration() || null), 1000);
              } else if (e.data === 2 || e.data === 0) {
                stopPoll();
                if (player) onTime(player.getCurrentTime(), player.getDuration() || null);
                onPauseOrEnd();
              }
            },
            onError: (e) => onError(YT_ERRORS[e.data] ?? "This video couldn't be played."),
          },
        });
      })
      .catch((err: Error) => onError(err.message));
    const off = playbackStore.onSeek((s) => player?.seekTo(s, true));
    return () => {
      disposed = true;
      stopPoll();
      off();
      player?.destroy();
    };
    // The player is created once per mount; parent remounts on retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);
  return <div ref={host} className="size-full [&_iframe]:size-full" />;
}

// ---------------------------------------------------------------------------
// Mux (signed playback, captions, quality selection built in)
// ---------------------------------------------------------------------------

type MediaEl = HTMLElement & { currentTime: number; duration: number };

function MuxVideo({
  source,
  lessonId,
  viewerTitle,
  onTime,
  onPauseOrEnd,
  onError,
}: ProviderProps & { source: Extract<PlaybackSource, { provider: "mux" }>; lessonId: string; viewerTitle: string }) {
  const el = useRef<MediaEl | null>(null);
  useEffect(() => playbackStore.onSeek((s) => {
    if (el.current) el.current.currentTime = s;
  }), []);
  const read = (e: Event) => {
    const target = e.target as MediaEl;
    el.current = target;
    onTime(target.currentTime, Number.isFinite(target.duration) ? target.duration : null);
  };
  return (
    <MuxPlayer
      playbackId={source.playbackId}
      tokens={source.tokens}
      startTime={source.startSeconds}
      streamType="on-demand"
      accentColor="#5B3DF5"
      metadataVideoTitle={source.title ?? viewerTitle}
      metadataVideoId={lessonId}
      title={source.title ?? viewerTitle}
      className="size-full"
      style={{ aspectRatio: "16 / 9", width: "100%", height: "100%" }}
      onLoadedMetadata={(e) => {
        el.current = e.target as unknown as MediaEl;
      }}
      onTimeUpdate={(e) => read(e as unknown as Event)}
      onPause={(e) => {
        read(e as unknown as Event);
        onPauseOrEnd();
      }}
      onEnded={(e) => {
        read(e as unknown as Event);
        onPauseOrEnd();
      }}
      onError={() => onError("This video couldn't be played. It may still be processing.")}
    />
  );
}

// ---------------------------------------------------------------------------
// Bunny Stream (iframe + player.js)
// ---------------------------------------------------------------------------

interface PlayerJs {
  on(event: "ready" | "pause" | "ended" | "error", cb: () => void): void;
  on(event: "timeupdate", cb: (data: { seconds: number; duration: number }) => void): void;
  setCurrentTime(seconds: number): void;
  off(event?: string): void;
}

const PLAYERJS_SOURCES = [
  "https://assets.mediadelivery.net/playerjs/player-0.1.0.min.js",
  "https://cdn.embed.ly/player-0.1.0.min.js",
];
let playerJsLoad: Promise<boolean> | null = null;
function loadPlayerJs(): Promise<boolean> {
  if (window.playerjs) return Promise.resolve(true);
  if (playerJsLoad) return playerJsLoad;
  playerJsLoad = (async () => {
    for (const src of PLAYERJS_SOURCES) {
      const ok = await new Promise<boolean>((resolve) => {
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.onload = () => resolve(Boolean(window.playerjs));
        s.onerror = () => resolve(false);
        document.head.appendChild(s);
      });
      if (ok) return true;
    }
    return false;
  })();
  return playerJsLoad;
}

function withStart(embedUrl: string, startSeconds: number): string {
  try {
    const u = new URL(embedUrl);
    if (startSeconds > 0 && !u.searchParams.has("t")) u.searchParams.set("t", String(Math.floor(startSeconds)));
    if (!u.searchParams.has("autoplay")) u.searchParams.set("autoplay", "false");
    return u.toString();
  } catch {
    return embedUrl;
  }
}

function BunnyVideo({ embedUrl, startSeconds, title, onTime, onPauseOrEnd }: ProviderProps & { embedUrl: string; startSeconds: number; title: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [tracking, setTracking] = useState<"pending" | "on" | "off">("pending");
  useEffect(() => {
    let player: PlayerJs | null = null;
    let cancelled = false;
    loadPlayerJs().then((ok) => {
      if (cancelled || !frame.current) return;
      if (!ok || !window.playerjs) {
        setTracking("off");
        return;
      }
      player = new window.playerjs.Player(frame.current);
      player.on("ready", () => {
        setTracking("on");
        player?.on("timeupdate", (d) => onTime(d.seconds, d.duration || null));
        player?.on("pause", onPauseOrEnd);
        player?.on("ended", onPauseOrEnd);
      });
    });
    const off = playbackStore.onSeek((s) => player?.setCurrentTime(s));
    return () => {
      cancelled = true;
      off();
      player?.off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedUrl]);
  return (
    <>
      <iframe
        ref={frame}
        src={withStart(embedUrl, startSeconds)}
        title={title}
        className="size-full border-0"
        loading="lazy"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
      {tracking === "off" ? (
        <p className="sr-only" role="status">
          Progress for this video can&apos;t be tracked automatically; use “Mark as complete” if available.
        </p>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export function VideoPlayer({
  source,
  lessonId,
  title,
  track = true,
}: {
  source: PlaybackSource;
  lessonId: string;
  title: string;
  /** False for staff previews and public preview lessons. */
  track?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { tick, flush } = useProgressReporter(lessonId, track);

  const common: ProviderProps = { onTime: tick, onPauseOrEnd: flush, onError: setError };

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-ink shadow-card" data-testid="video-player">
      {error ? (
        <div role="alert" className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-ink/95 p-6 text-center text-white">
          <AlertTriangle className="size-7 text-warning" aria-hidden />
          <p className="max-w-sm text-sm">{error}</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setError(null);
              setAttempt((a) => a + 1);
            }}
          >
            <RotateCcw /> Try again
          </Button>
        </div>
      ) : null}
      <div key={attempt} className="size-full">
        {source.provider === "youtube" ? (
          <YouTubeVideo videoId={source.videoId} startSeconds={source.startSeconds} title={title} {...common} />
        ) : source.provider === "mux" ? (
          <MuxVideo source={source} lessonId={lessonId} viewerTitle={title} {...common} />
        ) : (
          <BunnyVideo embedUrl={source.embedUrl} startSeconds={source.startSeconds} title={title} {...common} />
        )}
      </div>
    </div>
  );
}
