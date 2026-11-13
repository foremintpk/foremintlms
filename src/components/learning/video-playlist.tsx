"use client";

import { useState } from "react";
import { Loader2, PlayCircle } from "lucide-react";
import type { PlaybackSource } from "@/lib/services/video/types";
import { cn } from "@/lib/utils";
import { VideoPlayer } from "./video-player";

interface Item {
  assetId: string;
  title: string | null;
  status: string;
  playback: PlaybackSource | null;
}

export function VideoPlaylist({ items, lessonId, title, track }: { items: Item[]; lessonId: string; title: string; track: boolean }) {
  const playable = items.filter((i) => i.playback);
  const [index, setIndex] = useState(0);
  const current = playable[index];
  return (
    <div className="space-y-3">
      {current?.playback ? (
        <VideoPlayer key={current.assetId} source={current.playback} lessonId={lessonId} title={current.title ?? title} track={track && index === 0} />
      ) : (
        <VideoUnavailable status={items[0]?.status ?? "missing"} />
      )}
      <ol className="divide-y rounded-xl border bg-card" aria-label="Playlist">
        {items.map((item, i) => {
          const playableIndex = playable.indexOf(item);
          const active = playableIndex === index && playableIndex >= 0;
          return (
            <li key={`${item.assetId}-${i}`}>
              <button
                type="button"
                disabled={playableIndex < 0}
                onClick={() => setIndex(playableIndex)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60",
                  active && "bg-brand-soft text-primary hover:bg-brand-soft",
                )}
              >
                <span className="w-5 text-center text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                {item.playback ? <PlayCircle className="size-4 shrink-0" /> : <Loader2 className="size-4 shrink-0" />}
                <span className="min-w-0 flex-1 truncate">{item.title ?? `Video ${i + 1}`}</span>
                {!item.playback ? <span className="text-xs text-muted-foreground">{item.status === "errored" ? "Unavailable" : "Processing"}</span> : null}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function VideoUnavailable({ status }: { status: string }) {
  const message =
    status === "processing" || status === "waiting"
      ? "This video is still processing. Check back in a few minutes."
      : status === "errored"
        ? "This video couldn't be loaded. Try again later or contact support."
        : "This video isn't available yet.";
  return (
    <div className="grid aspect-video w-full place-items-center rounded-2xl border border-dashed bg-muted/40 p-6 text-center text-sm text-muted-foreground" role="status">
      <div className="flex flex-col items-center gap-2">
        {status === "processing" || status === "waiting" ? <Loader2 className="size-6 animate-spin" aria-hidden /> : <PlayCircle className="size-6" aria-hidden />}
        {message}
      </div>
    </div>
  );
}
