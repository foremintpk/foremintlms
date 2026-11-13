"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CloudUpload, Film, Link2, Loader2, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import * as tus from "tus-js-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/common/status-badge";
import { ConfirmAction } from "@/components/common/confirm-action";
import { useAction } from "@/hooks/use-action";
import { formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  addYouTubeVideo,
  createVideoUpload,
  deleteVideo,
  markVideoUploaded,
  refreshVideo,
  type VideoSummaryDTO,
} from "@/lib/services/courses/actions/video";
import type { VideoAssetSummary } from "@/lib/services/courses/builder";
import { useSyncedState } from "./form-bits";

export type ProviderStatuses = Record<"youtube" | "mux" | "bunny", boolean>;

const PROVIDER_LABEL = { youtube: "YouTube", mux: "Mux", bunny: "Bunny Stream" } as const;
const MAX_VIDEO_BYTES = 20 * 1024 * 1024 * 1024; // provider limits apply; this only guards obvious mistakes

function statusLabel(v: { status: string }) {
  if (v.status === "ready") return "Ready";
  if (v.status === "errored") return "Failed";
  if (v.status === "waiting") return "Waiting for upload";
  return "Processing";
}

export function VideoCard({
  video,
  courseId,
  onRemove,
  compact,
}: {
  video: VideoAssetSummary | VideoSummaryDTO;
  courseId: string;
  onRemove?: () => void;
  compact?: boolean;
}) {
  const [current, setCurrent] = useSyncedState<VideoAssetSummary | VideoSummaryDTO>(video);
  const refresh = useAction(refreshVideo, { silent: true, onSuccess: (v) => setCurrent((c) => ({ ...c, ...v })) });
  const polls = useRef(0);

  // Poll while the provider is still processing (webhooks normally beat this).
  useEffect(() => {
    if (current.status === "ready" || current.status === "errored" || current.provider === "youtube") return;
    if (polls.current > 120) return;
    const t = setTimeout(() => {
      polls.current += 1;
      void refresh.run({ courseId, assetId: current.id });
    }, polls.current < 12 ? 5000 : 15000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-arm only when status changes
  }, [current.status, current.id, courseId]);

  return (
    <div className={cn("flex items-center gap-3 rounded-xl border bg-card p-2.5", compact && "p-2")}>
      <div className="relative grid aspect-video w-24 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
        {current.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- provider thumbnails
          <img src={current.thumbnail_url} alt="" className="size-full object-cover" />
        ) : (
          <Film className="size-5 text-muted-foreground" aria-hidden />
        )}
        {current.duration_seconds ? (
          <span className="absolute right-1 bottom-1 rounded bg-ink/80 px-1 text-[10px] text-paper tabular-nums">
            {formatTimestamp(current.duration_seconds)}
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{current.title || "Untitled video"}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{PROVIDER_LABEL[current.provider]}</span>
          <StatusBadge
            status={current.status === "ready" ? "ready" : current.status === "errored" ? "error" : "processing"}
            label={statusLabel(current)}
            tone={current.status === "ready" ? "success" : current.status === "errored" ? "danger" : "info"}
          />
        </div>
        {current.status === "errored" && current.error_message ? <p className="mt-1 text-xs text-destructive">{current.error_message}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {current.provider !== "youtube" && current.status !== "ready" ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Check processing status"
            disabled={refresh.pending}
            onClick={() => void refresh.run({ courseId, assetId: current.id })}
          >
            <RefreshCw className={cn(refresh.pending && "animate-spin")} />
          </Button>
        ) : null}
        {onRemove ? (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            Change
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function UploadPanel({
  courseId,
  provider,
  onDone,
}: {
  courseId: string;
  provider: "mux" | "bunny";
  onDone: (v: VideoSummaryDTO) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const tusRef = useRef<tus.Upload | null>(null);

  useEffect(
    () => () => {
      xhrRef.current?.abort();
      void tusRef.current?.abort();
    },
    [],
  );

  const start = async () => {
    if (!file) return;
    if (!file.type.startsWith("video/")) return setError("Choose a video file (MP4, MOV, WebM…).");
    if (file.size > MAX_VIDEO_BYTES) return setError("This file is too large.");
    setBusy(true);
    setError(null);
    setProgress(0);
    const res = await createVideoUpload({ courseId, provider, title: title.trim() || file.name.replace(/\.[^.]+$/, "") });
    if (!res.ok) {
      setBusy(false);
      setProgress(null);
      return setError(res.error);
    }
    const { videoAssetId, upload } = res.data;

    const finish = async () => {
      const done = await markVideoUploaded({ courseId, assetId: videoAssetId });
      setBusy(false);
      if (done.ok) {
        toast.success("Upload complete — the video is processing");
        onDone(done.data);
      } else setError(done.error);
    };
    const failed = (message: string) => {
      setBusy(false);
      setProgress(null);
      setError(message);
    };

    if (upload.kind === "mux") {
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.open("PUT", upload.url);
      xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? void finish() : failed("Mux rejected the upload. Try again."));
      xhr.onerror = () => failed("The upload was interrupted. Check your connection and try again.");
      xhr.send(file);
    } else if (upload.kind === "bunny-tus") {
      const tusUpload = new tus.Upload(file, {
        endpoint: upload.endpoint,
        retryDelays: [0, 3000, 5000, 10000, 20000, 60000],
        chunkSize: 50 * 1024 * 1024,
        headers: upload.headers,
        metadata: { filetype: file.type, title: title.trim() || file.name },
        onError: () => failed("The upload was interrupted. Check your connection and try again."),
        onProgress: (sent, total) => setProgress(Math.round((sent / total) * 100)),
        onSuccess: () => void finish(),
      });
      tusRef.current = tusUpload;
      const previous = await tusUpload.findPreviousUploads();
      if (previous.length) tusUpload.resumeFromPreviousUpload(previous[0]);
      tusUpload.start();
    } else {
      failed("This provider doesn't support uploads.");
    }
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <label htmlFor={`video-file-${provider}`} className="text-sm font-medium">
          Video file
        </label>
        <Input
          id={`video-file-${provider}`}
          type="file"
          accept="video/*"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""));
          }}
        />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor={`video-title-${provider}`} className="text-sm font-medium">
          Title
        </label>
        <Input id={`video-title-${provider}`} value={title} maxLength={200} disabled={busy} onChange={(e) => setTitle(e.target.value)} />
      </div>
      {progress !== null ? (
        <div className="grid gap-1.5" aria-live="polite">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {progress < 100 ? `Uploading… ${progress}% — keep this tab open` : "Finishing upload…"}
          </p>
        </div>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="button" onClick={() => void start()} disabled={!file || busy}>
        {busy ? <Loader2 className="animate-spin" /> : <CloudUpload />}
        Upload to {PROVIDER_LABEL[provider]}
      </Button>
      <p className="text-xs text-muted-foreground">
        {provider === "mux"
          ? "Mux creates adaptive quality and English captions automatically. Playback is signed when a signing key is configured."
          : "Bunny Stream encodes the video and serves it through token-protected embeds when a token key is configured."}
      </p>
    </div>
  );
}

function YouTubePanel({ courseId, onDone }: { courseId: string; onDone: (v: VideoSummaryDTO) => void }) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const add = useAction(addYouTubeVideo, { onSuccess: onDone });
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void add.run({ courseId, url, title: title || undefined });
      }}
    >
      <div className="grid gap-1.5">
        <label htmlFor="yt-url" className="text-sm font-medium">
          YouTube link
        </label>
        <Input id="yt-url" placeholder="https://youtu.be/…" value={url} onChange={(e) => setUrl(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="yt-title" className="text-sm font-medium">
          Title <span className="font-normal text-muted-foreground">(optional — defaults to the YouTube title)</span>
        </label>
        <Input id="yt-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
      </div>
      {add.error ? <p className="text-sm text-destructive">{add.error}</p> : null}
      <Button type="submit" disabled={!url.trim() || add.pending}>
        {add.pending ? <Loader2 className="animate-spin" /> : <Link2 />} Add YouTube video
      </Button>
      <p className="flex gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
        Unlisted YouTube videos can be watched by anyone who has the link. Use Mux or Bunny for paid content that must stay private.
      </p>
    </form>
  );
}

/** Choose a course video, upload a new one, or add a YouTube link. */
export function VideoPicker({
  courseId,
  videos,
  value,
  onChange,
  providers,
  disabled,
}: {
  courseId: string;
  videos: VideoAssetSummary[];
  value: string | null;
  onChange: (id: string | null, video?: VideoSummaryDTO | VideoAssetSummary) => void;
  providers: ProviderStatuses;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [library, setLibrary] = useSyncedState<(VideoAssetSummary | VideoSummaryDTO)[]>(videos);
  const selected = library.find((v) => v.id === value) ?? null;
  const uploadTabs = (["mux", "bunny"] as const).filter((p) => providers[p]);
  const defaultTab = library.length ? "library" : uploadTabs[0] ?? (providers.youtube ? "youtube" : "library");

  const choose = (v: VideoSummaryDTO | VideoAssetSummary) => {
    setLibrary((l) => (l.some((x) => x.id === v.id) ? l : [v, ...l]));
    onChange(v.id, v);
    setOpen(false);
  };

  return (
    <div className="grid gap-2">
      {selected ? (
        <VideoCard video={selected} courseId={courseId} onRemove={disabled ? undefined : () => setOpen(true)} />
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-muted/30 px-4 py-8 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-brand-soft/40 disabled:opacity-60"
        >
          <Film className="size-6" aria-hidden />
          <span className="font-medium text-foreground">Choose or upload a video</span>
          <span className="text-xs">Mux, Bunny Stream or an unlisted YouTube link</span>
        </button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add a video</DialogTitle>
            <DialogDescription>Videos belong to this course and can be reused in any of its lessons.</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue={defaultTab}>
            <TabsList className="w-full overflow-x-auto">
              <TabsTrigger value="library">Course videos ({library.length})</TabsTrigger>
              <TabsTrigger value="mux">Upload to Mux</TabsTrigger>
              <TabsTrigger value="bunny">Upload to Bunny</TabsTrigger>
              <TabsTrigger value="youtube">YouTube link</TabsTrigger>
            </TabsList>
            <TabsContent value="library" className="mt-4 grid gap-2">
              {library.length === 0 ? (
                <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                  No videos yet. Upload one or add a YouTube link.
                </p>
              ) : (
                library.map((v) => (
                  <div key={v.id} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <VideoCard video={v} courseId={courseId} compact />
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <Button type="button" size="sm" variant={v.id === value ? "secondary" : "default"} onClick={() => choose(v)}>
                        {v.id === value ? <CheckCircle2 /> : null}
                        {v.id === value ? "Selected" : "Use"}
                      </Button>
                      <ConfirmAction
                        trigger={
                          <Button type="button" size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive">
                            <Trash2 /> Delete
                          </Button>
                        }
                        title={`Delete “${v.title || "this video"}”?`}
                        description="It's removed from the video provider and from every lesson that uses it. This can't be undone."
                        confirmLabel="Delete video"
                        destructive
                        action={() => deleteVideo({ courseId, assetId: v.id })}
                        onDone={() => {
                          setLibrary((l) => l.filter((x) => x.id !== v.id));
                          if (v.id === value) onChange(null);
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
            {(["mux", "bunny"] as const).map((p) => (
              <TabsContent key={p} value={p} className="mt-4">
                {providers[p] ? (
                  <UploadPanel courseId={courseId} provider={p} onDone={choose} />
                ) : (
                  <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                    {PROVIDER_LABEL[p]} isn&apos;t connected. An administrator can add its credentials in Admin → Integrations.
                  </p>
                )}
              </TabsContent>
            ))}
            <TabsContent value="youtube" className="mt-4">
              {providers.youtube ? (
                <YouTubePanel courseId={courseId} onDone={choose} />
              ) : (
                <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                  YouTube videos are switched off in integration settings.
                </p>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
