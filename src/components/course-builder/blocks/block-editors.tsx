"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download, ExternalLink, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichTextEditor } from "@/components/common/rich-text-editor";
import { FileUpload } from "@/components/common/file-upload";
import { useAction } from "@/hooks/use-action";
import { formatBytes } from "@/lib/format";
import { saveBlock } from "@/lib/services/courses/actions/blocks";
import { createAssignment } from "@/lib/services/courses/actions/assignments";
import { createQuiz } from "@/lib/services/courses/actions/quizzes";
import { EMBED_PROVIDER_LABELS, normalizeEmbedUrl } from "@/lib/services/courses/embeds";
import type { BuilderBlock, LessonEditorData, MediaFileSummary, VideoAssetSummary } from "@/lib/services/courses/builder";
import { FILE_BLOCK_EXTENSIONS, isFileBlockType, type FileBlockType } from "@/lib/validation/course-blocks";
import { FormRow, SwitchRow } from "../form-bits";
import { VideoCard, VideoPicker, type ProviderStatuses } from "../video-picker";

export interface BlockEditorContext {
  courseId: string;
  courseBase: string;
  lessonId: string;
  liveHref: string;
  canEdit: boolean;
  providers: ProviderStatuses;
  videos: VideoAssetSummary[];
  mediaFiles: Record<string, MediaFileSummary>;
  quizzes: LessonEditorData["quizzes"];
  assignments: LessonEditorData["assignments"];
  liveSessions: LessonEditorData["liveSessions"];
  recordings: LessonEditorData["recordings"];
}

interface Refs {
  video_asset_id?: string | null;
  media_file_id?: string | null;
  quiz_id?: string | null;
  assignment_id?: string | null;
  live_session_id?: string | null;
}

function useBlockSaver(block: BuilderBlock, ctx: BlockEditorContext) {
  const action = useAction(saveBlock);
  const save = (title: string | null, data: Record<string, unknown>, refs: Refs = {}) =>
    action.run({
      courseId: ctx.courseId,
      blockId: block.id,
      title,
      data,
      video_asset_id: refs.video_asset_id ?? null,
      media_file_id: refs.media_file_id ?? null,
      quiz_id: refs.quiz_id ?? null,
      assignment_id: refs.assignment_id ?? null,
      live_session_id: refs.live_session_id ?? null,
    });
  return { save, pending: action.pending, error: action.error };
}

function TitleField({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <FormRow label="Heading" optional hint="Shown above this block in the lesson.">
      <Input value={value} maxLength={200} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </FormRow>
  );
}

function SaveRow({ pending, error, disabled, onSave, label = "Save block" }: { pending: boolean; error: string | null; disabled?: boolean; onSave: () => void; label?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
      {error ? <p className="mr-auto text-sm text-destructive">{error}</p> : null}
      <Button type="button" onClick={onSave} disabled={pending || disabled}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        {label}
      </Button>
    </div>
  );
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

// ── Video ───────────────────────────────────────────────────────────────────

function VideoEditor({ block, ctx }: { block: BuilderBlock; ctx: BlockEditorContext }) {
  const [title, setTitle] = useState(block.title ?? "");
  const [caption, setCaption] = useState(str(block.data.caption));
  const [videoId, setVideoId] = useState<string | null>(block.video_asset_id);
  const s = useBlockSaver(block, ctx);
  const disabled = !ctx.canEdit;
  return (
    <div className="grid gap-4">
      <TitleField value={title} onChange={setTitle} disabled={disabled} />
      <FormRow label="Video">
        <VideoPicker
          courseId={ctx.courseId}
          videos={ctx.videos}
          value={videoId}
          providers={ctx.providers}
          disabled={disabled}
          onChange={(id) => {
            setVideoId(id);
            if (id) void s.save(title || null, { caption }, { video_asset_id: id });
          }}
        />
      </FormRow>
      <FormRow label="Caption" optional>
        <Textarea rows={2} maxLength={500} value={caption} disabled={disabled} onChange={(e) => setCaption(e.target.value)} />
      </FormRow>
      {ctx.canEdit ? <SaveRow {...s} onSave={() => void s.save(title || null, { caption }, { video_asset_id: videoId })} /> : null}
    </div>
  );
}

function PlaylistEditor({ block, ctx }: { block: BuilderBlock; ctx: BlockEditorContext }) {
  const [title, setTitle] = useState(block.title ?? "");
  const [caption, setCaption] = useState(str(block.data.caption));
  const [ids, setIds] = useState<string[]>(Array.isArray(block.data.video_asset_ids) ? (block.data.video_asset_ids as string[]) : []);
  const [adding, setAdding] = useState<string | null>(null);
  const s = useBlockSaver(block, ctx);
  const byId = useMemo(() => new Map(ctx.videos.map((v) => [v.id, v])), [ctx.videos]);
  const disabled = !ctx.canEdit;
  const move = (i: number, d: -1 | 1) =>
    setIds((list) => {
      const next = [...list];
      const j = i + d;
      if (j < 0 || j >= next.length) return list;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  return (
    <div className="grid gap-4">
      <TitleField value={title} onChange={setTitle} disabled={disabled} />
      <FormRow label="Videos in order" hint="Students watch them one after another.">
        <ol className="grid gap-2">
          {ids.map((id, i) => {
            const v = byId.get(id);
            return (
              <li key={id} className="flex items-center gap-2">
                <span className="w-5 text-right text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  {v ? <VideoCard video={v} courseId={ctx.courseId} compact /> : <p className="text-sm text-muted-foreground">Video unavailable</p>}
                </div>
                {!disabled ? (
                  <div className="flex shrink-0 items-center">
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>
                      <ArrowUp />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Move down" onClick={() => move(i, 1)} disabled={i === ids.length - 1}>
                      <ArrowDown />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove from playlist" onClick={() => setIds((l) => l.filter((x) => x !== id))}>
                      <X />
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
        {!disabled ? (
          <div className="mt-2">
            <VideoPicker
              courseId={ctx.courseId}
              videos={ctx.videos}
              value={adding}
              providers={ctx.providers}
              onChange={(id) => {
                if (id && !ids.includes(id)) setIds((l) => [...l, id]);
                setAdding(null);
              }}
            />
          </div>
        ) : null}
      </FormRow>
      <FormRow label="Caption" optional>
        <Textarea rows={2} maxLength={500} value={caption} disabled={disabled} onChange={(e) => setCaption(e.target.value)} />
      </FormRow>
      {ctx.canEdit ? <SaveRow {...s} onSave={() => void s.save(title || null, { video_asset_ids: ids, caption })} /> : null}
    </div>
  );
}

// ── Embed / text / link ─────────────────────────────────────────────────────

function EmbedEditor({ block, ctx }: { block: BuilderBlock; ctx: BlockEditorContext }) {
  const [title, setTitle] = useState(block.title ?? "");
  const [url, setUrl] = useState(str(block.data.url));
  const [aspect, setAspect] = useState(str(block.data.aspect) || "16:9");
  const [caption, setCaption] = useState(str(block.data.caption));
  const s = useBlockSaver(block, ctx);
  const normalized = url ? normalizeEmbedUrl(url) : null;
  const disabled = !ctx.canEdit;
  return (
    <div className="grid gap-4">
      <TitleField value={title} onChange={setTitle} disabled={disabled} />
      <FormRow
        label="Link to embed"
        hint={
          url && !normalized
            ? "This site can't be embedded. Supported: YouTube, Vimeo, Loom, Google Docs/Slides/Sheets/Forms/Drive, Figma, CodePen, Miro."
            : normalized
              ? `Recognised: ${EMBED_PROVIDER_LABELS[normalized.provider]}`
              : "Paste a normal share link — we convert it to a safe embed."
        }
      >
        <Input value={url} placeholder="https://" disabled={disabled} onChange={(e) => setUrl(e.target.value)} aria-invalid={Boolean(url && !normalized)} />
      </FormRow>
      <FormRow label="Shape">
        <Select value={aspect} onValueChange={setAspect} disabled={disabled}>
          <SelectTrigger className="w-full sm:max-w-xs" aria-label="Shape">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="16:9">Widescreen (16:9)</SelectItem>
            <SelectItem value="4:3">Standard (4:3)</SelectItem>
            <SelectItem value="1:1">Square</SelectItem>
            <SelectItem value="9:16">Portrait (9:16)</SelectItem>
          </SelectContent>
        </Select>
      </FormRow>
      {normalized ? (
        <div className="overflow-hidden rounded-xl border bg-muted" style={{ aspectRatio: aspect.replace(":", " / ") }}>
          <iframe
            src={normalized.embedUrl}
            title={title || "Embedded content preview"}
            className="size-full"
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
            allow="fullscreen; picture-in-picture; encrypted-media"
          />
        </div>
      ) : null}
      <FormRow label="Caption" optional>
        <Textarea rows={2} maxLength={500} value={caption} disabled={disabled} onChange={(e) => setCaption(e.target.value)} />
      </FormRow>
      {ctx.canEdit ? <SaveRow {...s} disabled={!normalized} onSave={() => void s.save(title || null, { url, aspect, caption })} /> : null}
    </div>
  );
}

function RichTextBlockEditor({ block, ctx }: { block: BuilderBlock; ctx: BlockEditorContext }) {
  const [title, setTitle] = useState(block.title ?? "");
  const [html, setHtml] = useState(str(block.data.html));
  const s = useBlockSaver(block, ctx);
  return (
    <div className="grid gap-4">
      <TitleField value={title} onChange={setTitle} disabled={!ctx.canEdit} />
      <RichTextEditor value={html} onChange={setHtml} minHeight={260} ariaLabel="Lesson text" placeholder="Write the lesson…" />
      {ctx.canEdit ? <SaveRow {...s} label="Save text" onSave={() => void s.save(title || null, { html })} /> : null}
    </div>
  );
}

function LinkEditor({ block, ctx }: { block: BuilderBlock; ctx: BlockEditorContext }) {
  const [title, setTitle] = useState(block.title ?? "");
  const [url, setUrl] = useState(str(block.data.url));
  const [label, setLabel] = useState(str(block.data.label));
  const [description, setDescription] = useState(str(block.data.description));
  const s = useBlockSaver(block, ctx);
  const disabled = !ctx.canEdit;
  return (
    <div className="grid gap-4">
      <TitleField value={title} onChange={setTitle} disabled={disabled} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormRow label="Link text">
          <Input value={label} maxLength={160} disabled={disabled} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Amazon Seller Central help" />
        </FormRow>
        <FormRow label="Address">
          <Input value={url} disabled={disabled} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
        </FormRow>
      </div>
      <FormRow label="Why it's useful" optional>
        <Textarea rows={2} maxLength={500} value={description} disabled={disabled} onChange={(e) => setDescription(e.target.value)} />
      </FormRow>
      {ctx.canEdit ? <SaveRow {...s} onSave={() => void s.save(title || null, { url, label, description })} /> : null}
    </div>
  );
}

// ── Files ───────────────────────────────────────────────────────────────────

function FileCard({ file }: { file: MediaFileSummary }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{file.file_name}</p>
        <p className="text-xs text-muted-foreground">{formatBytes(file.size_bytes)}</p>
      </div>
      <Button asChild variant="ghost" size="sm">
        <a href={`/api/files/${file.id}?download=1`}>
          <Download /> Download
        </a>
      </Button>
    </div>
  );
}

function FileBlockEditor({ block, ctx }: { block: BuilderBlock & { block_type: FileBlockType }; ctx: BlockEditorContext }) {
  const type = block.block_type;
  const [title, setTitle] = useState(block.title ?? "");
  const [fileId, setFileId] = useState<string | null>(block.media_file_id);
  const [uploaded, setUploaded] = useState<MediaFileSummary | null>(null);
  const [description, setDescription] = useState(str(block.data.description));
  const [alt, setAlt] = useState(str(block.data.alt));
  const [caption, setCaption] = useState(str(block.data.caption));
  const [allowDownload, setAllowDownload] = useState(block.data.allow_download !== false && !(type === "image" && block.data.allow_download === undefined));
  const s = useBlockSaver(block, ctx);
  const file = (fileId && (uploaded?.id === fileId ? uploaded : ctx.mediaFiles[fileId])) || null;
  const exts = FILE_BLOCK_EXTENSIONS[type];
  const disabled = !ctx.canEdit;
  const data = () =>
    type === "image" ? { alt, caption, allow_download: allowDownload } : { description, allow_download: allowDownload };

  return (
    <div className="grid gap-4">
      <TitleField value={title} onChange={setTitle} disabled={disabled} />
      <FormRow label="File" hint={`Accepted: ${exts.map((e) => `.${e}`).join(", ")}`}>
        {file ? <FileCard file={file} /> : <p className="text-sm text-muted-foreground">No file uploaded yet.</p>}
        {!disabled ? (
          <FileUpload
            purpose="course_content"
            context={{ courseId: ctx.courseId }}
            accept={exts.map((e) => `.${e}`).join(",")}
            label={file ? "Replace file" : "Upload a file"}
            onUploaded={(f) => {
              const summary = { id: f.id, file_name: f.fileName, mime_type: f.mimeType, size_bytes: f.size, status: "ready" };
              setUploaded(summary);
              setFileId(f.id);
              void s.save(title || null, data(), { media_file_id: f.id });
            }}
          />
        ) : null}
      </FormRow>
      {type === "image" ? (
        <>
          <FormRow label="Alternative text" hint="Describe the image for people using screen readers.">
            <Input value={alt} maxLength={300} disabled={disabled} onChange={(e) => setAlt(e.target.value)} />
          </FormRow>
          <FormRow label="Caption" optional>
            <Input value={caption} maxLength={500} disabled={disabled} onChange={(e) => setCaption(e.target.value)} />
          </FormRow>
        </>
      ) : (
        <FormRow label="Description" optional>
          <Textarea rows={2} maxLength={1000} value={description} disabled={disabled} onChange={(e) => setDescription(e.target.value)} />
        </FormRow>
      )}
      <SwitchRow
        label="Students can download it"
        description={type === "pdf" ? "PDFs are always viewable in the lesson; this controls the download button." : undefined}
        checked={allowDownload}
        onCheckedChange={setAllowDownload}
        disabled={disabled}
      />
      {ctx.canEdit ? <SaveRow {...s} onSave={() => void s.save(title || null, data(), { media_file_id: fileId })} /> : null}
    </div>
  );
}

// ── Linked items ────────────────────────────────────────────────────────────

function QuizOrAssignmentEditor({ block, ctx, kind }: { block: BuilderBlock; ctx: BlockEditorContext; kind: "quiz" | "assignment" }) {
  const items = kind === "quiz" ? ctx.quizzes : ctx.assignments;
  const [title, setTitle] = useState(block.title ?? "");
  const [intro, setIntro] = useState(str(block.data.intro));
  const [selected, setSelected] = useState<string | null>(kind === "quiz" ? block.quiz_id : block.assignment_id);
  const [newTitle, setNewTitle] = useState("");
  const [created, setCreated] = useState<{ id: string; title: string; status: string }[]>([]);
  const s = useBlockSaver(block, ctx);
  const create = useAction(kind === "quiz" ? createQuiz : createAssignment, {
    onSuccess: (d) => {
      setCreated((c) => [...c, { id: d.id, title: newTitle, status: "draft" }]);
      setSelected(d.id);
      void s.save(title || null, { intro }, kind === "quiz" ? { quiz_id: d.id } : { assignment_id: d.id });
      setNewTitle("");
    },
  });
  const all = [...items, ...created];
  const current = all.find((i) => i.id === selected);
  const editHref = selected ? `${ctx.courseBase}/${kind === "quiz" ? "quizzes" : "assignments"}/${selected}` : null;
  const disabled = !ctx.canEdit;
  const noun = kind === "quiz" ? "quiz" : "assignment";
  const refs = (id: string | null): Refs => (kind === "quiz" ? { quiz_id: id } : { assignment_id: id });

  return (
    <div className="grid gap-4">
      <TitleField value={title} onChange={setTitle} disabled={disabled} />
      <FormRow label={kind === "quiz" ? "Quiz" : "Assignment"}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={selected ?? "none"} onValueChange={(v) => setSelected(v === "none" ? null : v)} disabled={disabled}>
            <SelectTrigger className="w-full" aria-label={`Choose ${noun}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Choose a {noun}…</SelectItem>
              {all.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.title}
                  {i.status !== "published" ? ` (${i.status})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {editHref ? (
            <Button asChild variant="outline">
              <Link href={editHref}>
                <ExternalLink /> Edit {noun}
              </Link>
            </Button>
          ) : null}
        </div>
        {current && current.status !== "published" ? (
          <p className="text-xs text-warning">This {noun} is a {current.status}. Students only see published {noun === "quiz" ? "quizzes" : "assignments"}.</p>
        ) : null}
      </FormRow>
      {!disabled ? (
        <div className="flex flex-col gap-2 rounded-xl border border-dashed p-3 sm:flex-row">
          <Input value={newTitle} maxLength={200} placeholder={`New ${noun} title`} onChange={(e) => setNewTitle(e.target.value)} aria-label={`New ${noun} title`} />
          <Button
            type="button"
            variant="outline"
            disabled={!newTitle.trim() || create.pending}
            onClick={() => void create.run({ courseId: ctx.courseId, title: newTitle, lessonId: ctx.lessonId })}
          >
            {create.pending ? <Loader2 className="animate-spin" /> : <Plus />} Create {noun}
          </Button>
        </div>
      ) : null}
      <FormRow label="Introduction" optional>
        <Textarea rows={2} maxLength={500} value={intro} disabled={disabled} onChange={(e) => setIntro(e.target.value)} />
      </FormRow>
      {ctx.canEdit ? <SaveRow {...s} disabled={!selected} onSave={() => void s.save(title || null, { intro }, refs(selected))} /> : null}
    </div>
  );
}

function LiveSessionEditor({ block, ctx }: { block: BuilderBlock; ctx: BlockEditorContext }) {
  const [title, setTitle] = useState(block.title ?? "");
  const [intro, setIntro] = useState(str(block.data.intro));
  const [selected, setSelected] = useState<string | null>(block.live_session_id);
  const s = useBlockSaver(block, ctx);
  const disabled = !ctx.canEdit;
  const fmt = (iso: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  return (
    <div className="grid gap-4">
      <TitleField value={title} onChange={setTitle} disabled={disabled} />
      <FormRow label="Live session" hint={ctx.liveSessions.length ? "Students see the time in their own time zone and a join button." : undefined}>
        {ctx.liveSessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No live classes are scheduled for this course yet.{" "}
            <Link href={ctx.liveHref} className="font-medium text-primary hover:underline">
              Schedule one
            </Link>
          </p>
        ) : (
          <Select value={selected ?? "none"} onValueChange={(v) => setSelected(v === "none" ? null : v)} disabled={disabled}>
            <SelectTrigger className="w-full" aria-label="Live session">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Choose a session…</SelectItem>
              {ctx.liveSessions.map((sess) => (
                <SelectItem key={sess.id} value={sess.id}>
                  {sess.title} · {fmt(sess.starts_at)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormRow>
      <FormRow label="Introduction" optional>
        <Textarea rows={2} maxLength={500} value={intro} disabled={disabled} onChange={(e) => setIntro(e.target.value)} />
      </FormRow>
      {ctx.canEdit ? <SaveRow {...s} disabled={!selected} onSave={() => void s.save(title || null, { intro }, { live_session_id: selected })} /> : null}
    </div>
  );
}

function RecordingEditor({ block, ctx }: { block: BuilderBlock; ctx: BlockEditorContext }) {
  const [title, setTitle] = useState(block.title ?? "");
  const [caption, setCaption] = useState(str(block.data.caption));
  const [source, setSource] = useState<"meeting_recording" | "video_asset">(block.data.source === "video_asset" ? "video_asset" : "meeting_recording");
  const [recordingId, setRecordingId] = useState<string | null>(str(block.data.meeting_recording_id) || null);
  const [videoId, setVideoId] = useState<string | null>(block.video_asset_id ?? (str(block.data.video_asset_id) || null));
  const s = useBlockSaver(block, ctx);
  const disabled = !ctx.canEdit;
  const ready = source === "meeting_recording" ? Boolean(recordingId) : Boolean(videoId);
  return (
    <div className="grid gap-4">
      <TitleField value={title} onChange={setTitle} disabled={disabled} />
      <RadioGroup value={source} onValueChange={(v) => setSource(v as typeof source)} className="grid gap-2 sm:grid-cols-2" disabled={disabled}>
        <Label className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-sm font-normal">
          <RadioGroupItem value="meeting_recording" /> Recording from a live class
        </Label>
        <Label className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-sm font-normal">
          <RadioGroupItem value="video_asset" /> Uploaded video
        </Label>
      </RadioGroup>
      {source === "meeting_recording" ? (
        <FormRow label="Recording">
          {ctx.recordings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No recordings yet. Add recording links on the{" "}
              <Link href={ctx.liveHref} className="font-medium text-primary hover:underline">
                live classes page
              </Link>{" "}
              after a session.
            </p>
          ) : (
            <Select value={recordingId ?? "none"} onValueChange={(v) => setRecordingId(v === "none" ? null : v)} disabled={disabled}>
              <SelectTrigger className="w-full" aria-label="Recording">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Choose a recording…</SelectItem>
                {ctx.recordings.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.session_title}
                    {r.title ? ` · ${r.title}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormRow>
      ) : (
        <FormRow label="Video">
          <VideoPicker courseId={ctx.courseId} videos={ctx.videos} value={videoId} providers={ctx.providers} onChange={setVideoId} disabled={disabled} />
        </FormRow>
      )}
      <FormRow label="Caption" optional>
        <Textarea rows={2} maxLength={500} value={caption} disabled={disabled} onChange={(e) => setCaption(e.target.value)} />
      </FormRow>
      {ctx.canEdit ? (
        <SaveRow
          {...s}
          disabled={!ready}
          onSave={() =>
            void s.save(
              title || null,
              source === "meeting_recording"
                ? { source, meeting_recording_id: recordingId, caption }
                : { source, video_asset_id: videoId, caption },
            )
          }
        />
      ) : null}
    </div>
  );
}

function ResourceCollectionEditor({ block, ctx }: { block: BuilderBlock; ctx: BlockEditorContext }) {
  const [heading, setHeading] = useState(str(block.data.heading));
  const [description, setDescription] = useState(str(block.data.description));
  const s = useBlockSaver(block, ctx);
  const disabled = !ctx.canEdit;
  return (
    <div className="grid gap-4">
      <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
        This block shows the files and links in <span className="font-medium text-foreground">Lesson resources</span> below, at this position in the lesson.
      </p>
      <FormRow label="Heading" optional>
        <Input value={heading} maxLength={160} disabled={disabled} onChange={(e) => setHeading(e.target.value)} placeholder="e.g. Templates and checklists" />
      </FormRow>
      <FormRow label="Description" optional>
        <Textarea rows={2} maxLength={1000} value={description} disabled={disabled} onChange={(e) => setDescription(e.target.value)} />
      </FormRow>
      {ctx.canEdit ? <SaveRow {...s} onSave={() => void s.save(block.title, { heading, description })} /> : null}
    </div>
  );
}

/** Pick the editor for a block type. */
export function BlockEditor({ block, ctx }: { block: BuilderBlock; ctx: BlockEditorContext }) {
  switch (block.block_type) {
    case "video":
      return <VideoEditor block={block} ctx={ctx} />;
    case "video_playlist":
      return <PlaylistEditor block={block} ctx={ctx} />;
    case "embed":
      return <EmbedEditor block={block} ctx={ctx} />;
    case "rich_text":
      return <RichTextBlockEditor block={block} ctx={ctx} />;
    case "link":
      return <LinkEditor block={block} ctx={ctx} />;
    case "quiz":
      return <QuizOrAssignmentEditor block={block} ctx={ctx} kind="quiz" />;
    case "assignment":
      return <QuizOrAssignmentEditor block={block} ctx={ctx} kind="assignment" />;
    case "live_session":
      return <LiveSessionEditor block={block} ctx={ctx} />;
    case "recording":
      return <RecordingEditor block={block} ctx={ctx} />;
    case "resource_collection":
      return <ResourceCollectionEditor block={block} ctx={ctx} />;
    default:
      if (isFileBlockType(block.block_type)) {
        return <FileBlockEditor block={block as BuilderBlock & { block_type: FileBlockType }} ctx={ctx} />;
      }
      return null;
  }
}
