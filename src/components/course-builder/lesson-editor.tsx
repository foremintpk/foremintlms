"use client";

import { useState } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertCircle,
  ChevronDown,
  ClipboardList,
  Code2,
  FileSpreadsheet,
  FileText,
  GripVertical,
  ImageIcon,
  Library,
  Link2,
  ListVideo,
  Paperclip,
  PenLine,
  PlayCircle,
  Plus,
  Presentation,
  Radio,
  Settings2,
  Trash2,
  Type,
  Video,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ConfirmAction } from "@/components/common/confirm-action";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/utils";
import { addBlock, deleteBlock, reorderBlocks } from "@/lib/services/courses/actions/blocks";
import type { BuilderBlock, BuilderModule, LessonEditorData } from "@/lib/services/courses/builder";
import { BLOCK_DESCRIPTIONS, BLOCK_LABELS, BLOCK_TYPES, isBlockComplete, type BlockType } from "@/lib/validation/course-blocks";
import { BlockEditor, type BlockEditorContext } from "./blocks/block-editors";
import { LessonDialog, COMPLETION_LABELS } from "./lesson-dialog";
import { ResourceManager } from "./resource-manager";
import { useSyncedState } from "./form-bits";
import type { ProviderStatuses } from "./video-picker";

export const BLOCK_ICONS: Record<BlockType, LucideIcon> = {
  video: PlayCircle,
  video_playlist: ListVideo,
  embed: Code2,
  rich_text: Type,
  pdf: FileText,
  document: FileText,
  presentation: Presentation,
  spreadsheet: FileSpreadsheet,
  image: ImageIcon,
  file: Paperclip,
  link: Link2,
  quiz: ClipboardList,
  assignment: PenLine,
  live_session: Radio,
  recording: Video,
  resource_collection: Library,
};

function BlockSummary({ block, ctx }: { block: BuilderBlock; ctx: BlockEditorContext }) {
  switch (block.block_type) {
    case "video":
      return <>{ctx.videos.find((v) => v.id === block.video_asset_id)?.title ?? "No video chosen"}</>;
    case "video_playlist": {
      const n = Array.isArray(block.data.video_asset_ids) ? block.data.video_asset_ids.length : 0;
      return <>{n ? `${n} video${n === 1 ? "" : "s"}` : "No videos yet"}</>;
    }
    case "rich_text": {
      const text = String(block.data.html ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      return <>{text ? text.slice(0, 120) : "Empty text"}</>;
    }
    case "embed":
    case "link":
      return <>{String(block.data.url || "No link yet")}</>;
    case "quiz":
      return <>{ctx.quizzes.find((q) => q.id === block.quiz_id)?.title ?? "No quiz chosen"}</>;
    case "assignment":
      return <>{ctx.assignments.find((a) => a.id === block.assignment_id)?.title ?? "No assignment chosen"}</>;
    case "live_session":
      return <>{ctx.liveSessions.find((s) => s.id === block.live_session_id)?.title ?? "No session chosen"}</>;
    case "recording":
      return <>{block.data.meeting_recording_id || block.video_asset_id ? "Recording selected" : "No recording chosen"}</>;
    case "resource_collection":
      return <>{String(block.data.heading || "Lesson resources")}</>;
    default:
      return <>{block.media_file_id ? (ctx.mediaFiles[block.media_file_id]?.file_name ?? "File attached") : "No file uploaded"}</>;
  }
}

function SortableBlock({
  block,
  ctx,
  expanded,
  onToggle,
}: {
  block: BuilderBlock;
  ctx: BlockEditorContext;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id, disabled: !ctx.canEdit });
  const Icon = BLOCK_ICONS[block.block_type];
  const complete = isBlockComplete(block);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("rounded-2xl border bg-card shadow-card", isDragging && "z-10 opacity-60", expanded && "ring-1 ring-primary/20")}
    >
      <div className="flex items-center gap-2 px-2 py-2 sm:px-3">
        {ctx.canEdit ? (
          <button
            type="button"
            className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
            aria-label={`Reorder ${BLOCK_LABELS[block.block_type]} block`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
        ) : null}
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={expanded}>
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-primary">
            <Icon className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {block.title || BLOCK_LABELS[block.block_type]}
              {block.title ? <span className="font-normal text-muted-foreground"> · {BLOCK_LABELS[block.block_type]}</span> : null}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              <BlockSummary block={block} ctx={ctx} />
            </span>
          </span>
          {!complete ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs text-warning max-sm:hidden">
              <AlertCircle className="size-3.5" /> Incomplete
            </span>
          ) : null}
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
        </button>
        {ctx.canEdit ? (
          <ConfirmAction
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={`Remove ${BLOCK_LABELS[block.block_type]} block`} className="text-muted-foreground hover:text-destructive">
                <Trash2 />
              </Button>
            }
            title="Remove this block?"
            description="Uploaded files used only by this block are deleted. Videos stay in the course library."
            confirmLabel="Remove block"
            destructive
            action={() => deleteBlock({ courseId: ctx.courseId, blockId: block.id })}
          />
        ) : null}
      </div>
      {expanded ? (
        <div className="border-t px-3 py-4 sm:px-5">
          <BlockEditor block={block} ctx={ctx} />
        </div>
      ) : null}
    </li>
  );
}

function AddBlockMenu({ onAdd, pending }: { onAdd: (t: BlockType) => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button disabled={pending}>
          <Plus /> Add block
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,640px)] p-2">
        <ul className="grid gap-1 sm:grid-cols-2" role="menu" aria-label="Block types">
          {BLOCK_TYPES.map((type) => {
            const Icon = BLOCK_ICONS[type];
            return (
              <li key={type} role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  onClick={() => {
                    setOpen(false);
                    onAdd(type);
                  }}
                >
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-primary">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{BLOCK_LABELS[type]}</span>
                    <span className="block text-xs text-muted-foreground">{BLOCK_DESCRIPTIONS[type]}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export function LessonEditor({
  data,
  modules,
  courseBase,
  liveHref,
  providers,
  canEdit,
}: {
  data: LessonEditorData;
  modules: BuilderModule[];
  courseBase: string;
  liveHref: string;
  providers: ProviderStatuses;
  canEdit: boolean;
}) {
  const { lesson } = data;
  const [blocks, setBlocks] = useSyncedState(data.blocks);
  const [expanded, setExpanded] = useState<string | null>(data.blocks.length === 1 ? data.blocks[0].id : null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const add = useAction(addBlock, { onSuccess: (d) => setExpanded(d.id) });
  const reorder = useAction(reorderBlocks, { silent: true });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ctx: BlockEditorContext = {
    courseId: lesson.course_id,
    courseBase,
    lessonId: lesson.id,
    liveHref,
    canEdit,
    providers,
    videos: data.videos,
    mediaFiles: data.mediaFiles,
    quizzes: data.quizzes,
    assignments: data.assignments,
    liveSessions: data.liveSessions,
    recordings: data.recordings,
  };

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = blocks.findIndex((b) => b.id === e.active.id);
    const to = blocks.findIndex((b) => b.id === e.over!.id);
    const next = [...blocks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setBlocks(next);
    void reorder.run({ courseId: lesson.course_id, lessonId: lesson.id, blockIds: next.map((b) => b.id) }).then((res) => {
      if (!res.ok) setBlocks(data.blocks);
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid min-w-0 content-start gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{data.module.title}</p>
            <h2 className="truncate font-heading text-xl font-semibold">{lesson.title}</h2>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {!lesson.is_published ? <StatusBadge status="hidden" /> : null}
              {lesson.is_preview ? <StatusBadge status="preview" label="Free preview" tone="info" /> : null}
              <StatusBadge status="rule" label={`Complete: ${COMPLETION_LABELS[lesson.completion_rule].toLowerCase()}`} tone="neutral" />
            </div>
          </div>
          <div className="flex gap-2">
            {canEdit ? (
              <Button variant="outline" onClick={() => setSettingsOpen(true)}>
                <Settings2 /> Lesson settings
              </Button>
            ) : null}
            {canEdit ? <AddBlockMenu pending={add.pending} onAdd={(type) => void add.run({ courseId: lesson.course_id, lessonId: lesson.id, type })} /> : null}
          </div>
        </div>

        {blocks.length === 0 ? (
          <EmptyState
            icon={Plus}
            title="This lesson is empty"
            description="Add blocks to build the lesson: a video, some text, a PDF, a quiz — in any order."
            action={canEdit ? <AddBlockMenu pending={add.pending} onAdd={(type) => void add.run({ courseId: lesson.course_id, lessonId: lesson.id, type })} /> : undefined}
          />
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              <ol className="grid gap-3" aria-label="Lesson content blocks">
                {blocks.map((block) => (
                  <SortableBlock
                    key={block.id}
                    block={block}
                    ctx={ctx}
                    expanded={expanded === block.id}
                    onToggle={() => setExpanded((cur) => (cur === block.id ? null : block.id))}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}
      </div>
      <aside className="grid content-start gap-4">
        <ResourceManager courseId={lesson.course_id} lessonId={lesson.id} resources={data.resources} canEdit={canEdit} />
      </aside>
      {settingsOpen ? (
        <LessonDialog courseId={lesson.course_id} modules={modules} lesson={lesson} open onOpenChange={setSettingsOpen} />
      ) : null}
    </div>
  );
}
