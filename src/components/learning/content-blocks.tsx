/* eslint-disable @next/next/no-img-element -- private images are served through short-lived signed redirects that the image optimizer cannot fetch */
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarPlus,
  ClipboardList,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FileType2,
  Link2,
  ListChecks,
  Paperclip,
  Presentation,
  Radio,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RichContent } from "@/components/common/rich-content";
import { LocalTime } from "@/components/common/local-time";
import { StatusBadge } from "@/components/common/status-badge";
import { formatBytes, formatDuration } from "@/lib/format";
import type { FileMeta, LessonBlockView, ResourceItem } from "@/lib/services/learner";
import { cn } from "@/lib/utils";
import { liveJoinState } from "./lib";
import { VideoPlayer } from "./video-player";
import { VideoPlaylist, VideoUnavailable } from "./video-playlist";

const PROVIDER_NAME: Record<string, string> = { zoom: "Zoom", google_meet: "Google Meet", external: "Online meeting" };

function BlockFrame({ title, children, className }: { title?: string | null; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-3", className)}>
      {title ? <h2 className="text-lg font-semibold tracking-tight">{title}</h2> : null}
      {children}
    </section>
  );
}

function Caption({ text }: { text: string | null }) {
  return text ? <p className="text-sm text-muted-foreground">{text}</p> : null;
}

const FILE_ICON = {
  pdf: FileText,
  document: FileType2,
  presentation: Presentation,
  spreadsheet: FileSpreadsheet,
  image: FileText,
  file: Paperclip,
} as const;

export function FileCard({
  file,
  title,
  description,
  variant = "file",
  allowDownload = true,
}: {
  file: FileMeta;
  title?: string | null;
  description?: string | null;
  variant?: keyof typeof FILE_ICON;
  allowDownload?: boolean;
}) {
  const Icon = FILE_ICON[variant];
  const officeFile = variant === "document" || variant === "presentation" || variant === "spreadsheet";
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-primary">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{title || file.name}</p>
        <p className="text-xs text-muted-foreground">
          {file.name} · {formatBytes(file.size)}
        </p>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        {officeFile ? (
          <p className="mt-1 text-xs text-muted-foreground">Course files are private, so they open in your own app after downloading.</p>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-2">
        {!officeFile ? (
          <Button asChild variant="outline" size="sm">
            <a href={`/api/files/${file.id}`} target="_blank" rel="noopener">
              <ExternalLink /> Open
            </a>
          </Button>
        ) : null}
        {allowDownload || officeFile ? (
          <Button asChild size="sm">
            <a href={`/api/files/${file.id}?download=1`}>
              <Download /> Download
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function ResourceList({ resources, empty }: { resources: ResourceItem[]; empty?: string }) {
  if (resources.length === 0) return <p className="text-sm text-muted-foreground">{empty ?? "No resources for this lesson."}</p>;
  return (
    <ul className="space-y-2">
      {resources.map((r) => (
        <li key={r.id} className="rounded-lg border bg-card p-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
              {r.kind === "link" ? <Link2 className="size-3.5" /> : <Paperclip className="size-3.5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{r.title}</p>
              {r.description ? <p className="text-xs text-muted-foreground">{r.description}</p> : null}
              {r.kind === "file" && r.file ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="text-muted-foreground">{formatBytes(r.file.size)}</span>
                  <a className="font-medium text-primary hover:underline" href={`/api/files/${r.file.id}`} target="_blank" rel="noopener">
                    Open
                  </a>
                  {r.downloadable ? (
                    <a className="font-medium text-primary hover:underline" href={`/api/files/${r.file.id}?download=1`}>
                      Download
                    </a>
                  ) : null}
                </div>
              ) : r.kind === "link" && r.url ? (
                <a href={r.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  Visit link <ArrowUpRight className="size-3" />
                </a>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">This resource isn&apos;t available right now.</p>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function aspectClass(aspect: string) {
  switch (aspect) {
    case "4:3":
      return "aspect-[4/3]";
    case "1:1":
      return "aspect-square";
    case "9:16":
      return "mx-auto aspect-[9/16] max-w-sm";
    default:
      return "aspect-video";
  }
}

export function ContentBlocks({
  blocks,
  courseSlug,
  lessonId,
  lessonTitle,
  track,
  now,
}: {
  blocks: LessonBlockView[];
  courseSlug: string;
  lessonId: string;
  lessonTitle: string;
  track: boolean;
  now: Date;
}) {
  if (blocks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        This lesson has no content yet. Your instructor may still be adding it.
      </div>
    );
  }
  // Only the first playable video in a lesson reports progress (resume + completion).
  const trackedBlockId = track
    ? blocks.find((b) => (b.kind === "video" && b.video.playback) || (b.kind === "video_playlist" && b.items.some((i) => i.playback)))?.id
    : undefined;
  return (
    <div className="space-y-10">
      {blocks.map((block) => {
        switch (block.kind) {
          case "video": {
            const trackThis = block.id === trackedBlockId;
            return (
              <BlockFrame key={block.id} title={block.title}>
                {block.video.playback ? (
                  <VideoPlayer source={block.video.playback} lessonId={lessonId} title={block.video.title ?? block.title ?? lessonTitle} track={trackThis} />
                ) : (
                  <VideoUnavailable status={block.video.status} />
                )}
                <Caption text={block.caption} />
              </BlockFrame>
            );
          }
          case "video_playlist": {
            const trackThis = block.id === trackedBlockId;
            return (
              <BlockFrame key={block.id} title={block.title}>
                {block.items.length ? (
                  <VideoPlaylist items={block.items} lessonId={lessonId} title={block.title ?? lessonTitle} track={trackThis} />
                ) : (
                  <VideoUnavailable status="missing" />
                )}
                <Caption text={block.caption} />
              </BlockFrame>
            );
          }
          case "embed":
            return (
              <BlockFrame key={block.id} title={block.title}>
                {block.src ? (
                  <div className={cn("overflow-hidden rounded-2xl border bg-muted", aspectClass(block.aspect))}>
                    <iframe
                      src={block.src}
                      title={block.title ?? "Embedded content"}
                      className="size-full border-0"
                      loading="lazy"
                      sandbox="allow-scripts allow-same-origin allow-popups allow-presentation allow-forms"
                      allow="autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                    />
                  </div>
                ) : block.url && /^https:\/\//.test(block.url) ? (
                  <a href={block.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                    Open the embedded content <ArrowUpRight className="size-4" />
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">This embedded content isn&apos;t available.</p>
                )}
                <Caption text={block.caption} />
              </BlockFrame>
            );
          case "rich_text":
            return (
              <BlockFrame key={block.id} title={block.title}>
                <RichContent html={block.html} />
              </BlockFrame>
            );
          case "file": {
            if (!block.file) {
              return (
                <BlockFrame key={block.id} title={block.title}>
                  <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">This file isn&apos;t available right now.</p>
                </BlockFrame>
              );
            }
            if (block.variant === "image") {
              return (
                <BlockFrame key={block.id} title={block.title}>
                  <figure className="space-y-2">
                    <img
                      src={`/api/files/${block.file.id}`}
                      alt={block.alt ?? block.caption ?? block.title ?? ""}
                      loading="lazy"
                      className="mx-auto max-h-[70vh] w-auto rounded-xl border"
                    />
                    {block.caption ? <figcaption className="text-center text-sm text-muted-foreground">{block.caption}</figcaption> : null}
                  </figure>
                  {block.allowDownload ? (
                    <a href={`/api/files/${block.file.id}?download=1`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                      <Download className="size-4" /> Download image
                    </a>
                  ) : null}
                </BlockFrame>
              );
            }
            if (block.variant === "pdf") {
              return (
                <BlockFrame key={block.id} title={block.title}>
                  <div className="overflow-hidden rounded-2xl border bg-muted">
                    <iframe src={`/api/files/${block.file.id}`} title={block.title ?? block.file.name} className="h-[70vh] w-full border-0" loading="lazy" />
                  </div>
                  <FileCard file={block.file} title={block.title} description={block.description} variant="pdf" allowDownload={block.allowDownload} />
                </BlockFrame>
              );
            }
            return (
              <BlockFrame key={block.id} title={null}>
                <FileCard file={block.file} title={block.title} description={block.description} variant={block.variant} allowDownload={block.allowDownload} />
              </BlockFrame>
            );
          }
          case "link":
            return (
              <BlockFrame key={block.id}>
                {block.url ? (
                  <a
                    href={block.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="group flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
                  >
                    <span className="grid size-10 place-items-center rounded-lg bg-brand-soft text-primary">
                      <Link2 className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium group-hover:text-primary">{block.label}</span>
                      {block.description ? <span className="block text-sm text-muted-foreground">{block.description}</span> : null}
                      <span className="block truncate text-xs text-muted-foreground">{new URL(block.url).hostname}</span>
                    </span>
                    <ArrowUpRight className="size-4 text-muted-foreground" />
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">This link isn&apos;t available.</p>
                )}
              </BlockFrame>
            );
          case "quiz": {
            const q = block.quiz;
            return (
              <BlockFrame key={block.id}>
                <div className="rounded-2xl border bg-card p-5">
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-primary">
                      <ListChecks className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-heading text-lg font-semibold">{q?.title ?? block.title ?? "Quiz"}</p>
                      {block.intro ? <p className="mt-1 text-sm text-muted-foreground">{block.intro}</p> : null}
                      {q ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Pass mark {q.passingScore}%{q.timeLimitMinutes ? ` · ${formatDuration(q.timeLimitMinutes)} time limit` : ""}
                          {q.maxAttempts ? ` · ${q.attemptsUsed}/${q.maxAttempts} attempts used` : ""}
                          {q.bestPercent != null ? ` · best score ${Math.round(q.bestPercent)}%` : ""}
                        </p>
                      ) : null}
                    </div>
                    {q?.passed ? <StatusBadge status="passed" /> : q?.pendingReview ? <StatusBadge status="needs_review" label="Awaiting review" /> : null}
                  </div>
                  {q ? (
                    <Button asChild className="mt-4">
                      <Link href={`/learn/courses/${courseSlug}/quizzes/${q.id}`}>
                        {q.inProgress ? "Resume quiz" : q.passed ? "Review quiz" : q.attemptsUsed > 0 ? "Try again" : "Start quiz"}
                      </Link>
                    </Button>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">This quiz isn&apos;t available yet.</p>
                  )}
                </div>
              </BlockFrame>
            );
          }
          case "assignment": {
            const a = block.assignment;
            return (
              <BlockFrame key={block.id}>
                <div className="rounded-2xl border bg-card p-5">
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-primary">
                      <ClipboardList className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-heading text-lg font-semibold">{a?.title ?? block.title ?? "Assignment"}</p>
                      {block.intro ? <p className="mt-1 text-sm text-muted-foreground">{block.intro}</p> : null}
                      {a?.dueAt ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Due <LocalTime value={a.dueAt} format="datetime" />
                        </p>
                      ) : null}
                      {a?.gradePoints != null ? (
                        <p className="mt-1 text-sm font-medium">
                          Grade: {a.gradePoints} / {a.maxPoints}
                        </p>
                      ) : null}
                    </div>
                    {a ? <StatusBadge status={a.status} /> : null}
                  </div>
                  {a ? (
                    <Button asChild className="mt-4">
                      <Link href={`/learn/courses/${courseSlug}/assignments/${a.id}`}>
                        {a.status === "not_started" || a.status === "overdue" ? "Open assignment" : a.status === "resubmission_requested" ? "Resubmit" : "View submission"}
                      </Link>
                    </Button>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">This assignment isn&apos;t available yet.</p>
                  )}
                </div>
              </BlockFrame>
            );
          }
          case "live_session": {
            const s = block.session;
            const state = s ? liveJoinState(s.startsAt, s.durationMinutes, s.status, now) : null;
            return (
              <BlockFrame key={block.id}>
                <div className="rounded-2xl border bg-card p-5">
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-primary">
                      <Radio className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-heading text-lg font-semibold">{s?.title ?? block.title ?? "Live class"}</p>
                      {block.intro ? <p className="mt-1 text-sm text-muted-foreground">{block.intro}</p> : null}
                      {s ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          <LocalTime value={s.startsAt} format="weekday" /> · {formatDuration(s.durationMinutes)} · {PROVIDER_NAME[s.provider] ?? "Online"}
                        </p>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">This live class isn&apos;t available.</p>
                      )}
                    </div>
                    {state === "canceled" ? <StatusBadge status="canceled" /> : state === "joinable" ? <StatusBadge status="live" label="Join now" /> : null}
                  </div>
                  {s && state !== "canceled" && state !== "ended" ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {state === "joinable" ? (
                        <Button asChild>
                          <a href={`/api/live/${s.id}/join`} target="_blank" rel="noopener">
                            <Video /> Join class
                          </a>
                        </Button>
                      ) : (
                        <Button disabled variant="outline">
                          Opens 15 minutes before start
                        </Button>
                      )}
                      <Button asChild variant="outline">
                        <a href={`/api/live/${s.id}/ics`}>
                          <CalendarPlus /> Add to calendar
                        </a>
                      </Button>
                    </div>
                  ) : s && state === "ended" ? (
                    <Button asChild variant="link" className="mt-2 px-0">
                      <Link href="/learn/live">See recordings and resources</Link>
                    </Button>
                  ) : null}
                </div>
              </BlockFrame>
            );
          }
          case "recording":
            return (
              <BlockFrame key={block.id} title={block.title}>
                {block.video?.playback ? (
                  <VideoPlayer source={block.video.playback} lessonId={lessonId} title={block.video.title ?? block.title ?? "Recording"} track={false} />
                ) : block.external ? (
                  <a
                    href={block.external.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="flex items-center gap-3 rounded-xl border bg-card p-4 hover:border-primary/40"
                  >
                    <span className="grid size-10 place-items-center rounded-lg bg-brand-soft text-primary">
                      <Video className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{block.external.title ?? "Watch the recording"}</span>
                      {block.external.passcode ? (
                        <span className="block text-sm text-muted-foreground">
                          Passcode: <span className="font-mono">{block.external.passcode}</span>
                        </span>
                      ) : null}
                    </span>
                    <ArrowUpRight className="size-4 text-muted-foreground" />
                  </a>
                ) : (
                  <VideoUnavailable status={block.video?.status ?? "missing"} />
                )}
                <Caption text={block.caption} />
              </BlockFrame>
            );
          case "resource_collection":
            return (
              <BlockFrame key={block.id} title={block.heading ?? block.title ?? "Resources"}>
                {block.description ? <p className="text-sm text-muted-foreground">{block.description}</p> : null}
                <ResourceList resources={block.resources} />
              </BlockFrame>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

export function blocksHaveVideo(blocks: LessonBlockView[]): boolean {
  return blocks.some(
    (b) =>
      (b.kind === "video" && b.video.playback) ||
      (b.kind === "video_playlist" && b.items.some((i) => i.playback)) ||
      (b.kind === "recording" && b.video?.playback),
  );
}
