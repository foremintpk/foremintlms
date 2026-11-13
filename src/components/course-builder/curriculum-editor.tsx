"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertCircle,
  CalendarClock,
  ClipboardList,
  Eye,
  EyeOff,
  FileText,
  FolderPlus,
  GripVertical,
  Layers,
  Lock,
  MoreHorizontal,
  PenLine,
  PlayCircle,
  Plus,
  Radio,
  Settings2,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/common/empty-state";
import { ConfirmAction } from "@/components/common/confirm-action";
import { StatusBadge } from "@/components/common/status-badge";
import { useAction } from "@/hooks/use-action";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { deleteLesson, deleteModule, reorderCurriculum, setLessonFlag } from "@/lib/services/courses/actions/curriculum";
import type { BuilderLesson, BuilderModule } from "@/lib/services/courses/builder";
import { findModuleOfLesson, moveLesson, moveModule, sameOrder, type ModuleOrder } from "@/lib/services/courses/reorder";
import { LessonDialog } from "./lesson-dialog";
import { ModuleDialog } from "./module-dialog";
import { useSyncedState } from "./form-bits";

const TYPE_ICON: Record<BuilderLesson["lesson_type"], LucideIcon> = {
  video: PlayCircle,
  article: FileText,
  quiz: ClipboardList,
  assignment: PenLine,
  live: Radio,
  resource: Layers,
  mixed: Layers,
};

const M = (id: string) => `module:${id}`;
const L = (id: string) => `lesson:${id}`;
const D = (id: string) => `drop:${id}`;
const strip = (key: string) => key.split(":")[1] ?? "";

function toOrder(modules: BuilderModule[]): ModuleOrder[] {
  return modules.map((m) => ({ id: m.id, lessonIds: m.lessons.map((l) => l.id) }));
}

function releaseLabel(item: { release_at: string | null; release_after_days: number | null }): string | null {
  if (item.release_after_days !== null) return `Unlocks ${item.release_after_days} day${item.release_after_days === 1 ? "" : "s"} after enrolling`;
  if (item.release_at) {
    return `Unlocks ${new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(new Date(item.release_at))}`;
  }
  return null;
}

interface RowProps {
  lesson: BuilderLesson;
  lessonHref: string;
  canEdit: boolean;
  onSettings: () => void;
  courseId: string;
  prerequisiteTitle?: string;
}

function LessonRowBody({ lesson, lessonHref, canEdit, onSettings, courseId, prerequisiteTitle, handle }: RowProps & { handle?: React.ReactNode }) {
  const Icon = TYPE_ICON[lesson.lesson_type];
  const flag = useAction(setLessonFlag);
  const release = releaseLabel(lesson);
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card px-2 py-2 sm:px-3">
      {handle}
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <Link href={lessonHref} className="block truncate text-sm font-medium hover:text-primary">
          {lesson.title}
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {lesson.duration_minutes ? <span>{formatDuration(lesson.duration_minutes)}</span> : null}
          {lesson.block_count === 0 ? (
            <span className="inline-flex items-center gap-1 text-warning">
              <AlertCircle className="size-3" /> No content yet
            </span>
          ) : (
            <span>
              {lesson.block_count} block{lesson.block_count === 1 ? "" : "s"}
            </span>
          )}
          {release ? (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-3" /> {release}
            </span>
          ) : null}
          {prerequisiteTitle ? (
            <span className="inline-flex items-center gap-1">
              <Lock className="size-3" /> After “{prerequisiteTitle}”
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {lesson.is_preview ? <StatusBadge status="preview" label="Free preview" tone="info" className="max-sm:hidden" /> : null}
        {!lesson.is_published ? <StatusBadge status="hidden" /> : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${lesson.title}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={lessonHref}>
                <PenLine /> {canEdit ? "Edit content" : "View content"}
              </Link>
            </DropdownMenuItem>
            {canEdit ? (
              <>
                <DropdownMenuItem onSelect={onSettings}>
                  <Settings2 /> Lesson settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={flag.pending}
                  onSelect={() => void flag.run({ courseId, lessonId: lesson.id, flag: "is_preview", value: !lesson.is_preview })}
                >
                  <Eye /> {lesson.is_preview ? "Turn off free preview" : "Make free preview"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={flag.pending}
                  onSelect={() => void flag.run({ courseId, lessonId: lesson.id, flag: "is_published", value: !lesson.is_published })}
                >
                  {lesson.is_published ? <EyeOff /> : <Eye />} {lesson.is_published ? "Hide from students" : "Show to students"}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
        {canEdit ? (
          <ConfirmAction
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={`Delete ${lesson.title}`} className="text-muted-foreground hover:text-destructive">
                <Trash2 />
              </Button>
            }
            title={`Delete “${lesson.title}”?`}
            description="Its content blocks, resources and every student's progress for this lesson are removed. This can't be undone."
            confirmLabel="Delete lesson"
            destructive
            action={() => deleteLesson({ courseId, lessonId: lesson.id })}
          />
        ) : null}
      </div>
    </div>
  );
}

function SortableLesson(props: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: L(props.lesson.id), disabled: !props.canEdit });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn(isDragging && "opacity-40")}>
      <LessonRowBody
        {...props}
        handle={
          props.canEdit ? (
            <button
              type="button"
              className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
              aria-label={`Reorder ${props.lesson.title}`}
              {...attributes}
              {...listeners}
            >
              <GripVertical className="size-4" />
            </button>
          ) : null
        }
      />
    </li>
  );
}

function LessonDropZone({ moduleId, empty, children }: { moduleId: string; empty: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: D(moduleId) });
  return (
    <ul
      ref={setNodeRef}
      className={cn("grid min-h-12 gap-2 rounded-xl p-1 transition-colors", isOver && "bg-brand-soft/60", empty && "border border-dashed")}
    >
      {children}
      {empty ? <li className="grid place-items-center py-3 text-xs text-muted-foreground">Drag lessons here or add one</li> : null}
    </ul>
  );
}

function SortableModule({
  module,
  index,
  canEdit,
  children,
  onEdit,
  onAddLesson,
  courseId,
}: {
  module: BuilderModule;
  index: number;
  canEdit: boolean;
  children: React.ReactNode;
  onEdit: () => void;
  onAddLesson: () => void;
  courseId: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: M(module.id), disabled: !canEdit });
  const release = releaseLabel(module);
  const minutes = module.lessons.reduce((s, l) => s + (l.duration_minutes ?? 0), 0);
  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("rounded-2xl border bg-muted/30 p-3 sm:p-4", isDragging && "opacity-50")}
      aria-label={`Module ${index + 1}: ${module.title}`}
    >
      <header className="mb-3 flex items-start gap-2">
        {canEdit ? (
          <button
            type="button"
            className="mt-0.5 cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
            aria-label={`Reorder module ${module.title}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">Module {index + 1}</p>
          <h3 className="truncate font-heading text-base font-semibold">{module.title}</h3>
          <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            <span>
              {module.lessons.length} lesson{module.lessons.length === 1 ? "" : "s"}
              {minutes ? ` · ${formatDuration(minutes)}` : ""}
            </span>
            {release ? (
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="size-3" /> {release}
              </span>
            ) : null}
          </p>
        </div>
        {!module.is_published ? <StatusBadge status="hidden" /> : null}
        {canEdit ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="outline" size="sm" onClick={onAddLesson}>
              <Plus /> Lesson
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Settings for module ${module.title}`} onClick={onEdit}>
              <Settings2 />
            </Button>
            <ConfirmAction
              trigger={
                <Button variant="ghost" size="icon-sm" aria-label={`Delete module ${module.title}`} className="text-muted-foreground hover:text-destructive">
                  <Trash2 />
                </Button>
              }
              title={`Delete “${module.title}”?`}
              description={
                module.lessons.length
                  ? `Its ${module.lessons.length} lesson${module.lessons.length === 1 ? "" : "s"}, their content and student progress are deleted too. This can't be undone.`
                  : "This empty module will be removed."
              }
              confirmLabel="Delete module"
              destructive
              action={() => deleteModule({ courseId, moduleId: module.id })}
            />
          </div>
        ) : null}
      </header>
      {children}
    </section>
  );
}

export function CurriculumEditor({
  courseId,
  courseBase,
  modules: initialModules,
  canEdit,
}: {
  courseId: string;
  courseBase: string;
  modules: BuilderModule[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [modules, setModules] = useSyncedState(initialModules);
  const initialOrder = useMemo(() => toOrder(initialModules), [initialModules]);
  const [savedOrder, setSavedOrder] = useSyncedState(initialOrder);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [moduleDialog, setModuleDialog] = useState<{ open: boolean; module: BuilderModule | null }>({ open: false, module: null });
  const [lessonDialog, setLessonDialog] = useState<{ open: boolean; lesson: BuilderLesson | null; moduleId?: string }>({ open: false, lesson: null });
  const reorder = useAction(reorderCurriculum, { silent: true });

  const lessonsById = useMemo(() => new Map(modules.flatMap((m) => m.lessons).map((l) => [l.id, l])), [modules]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const applyOrder = (order: ModuleOrder[]) => {
    setModules((current) => {
      const byId = new Map(current.map((m) => [m.id, m]));
      return order.map((o) => ({
        ...byId.get(o.id)!,
        lessons: o.lessonIds.map((id) => ({ ...lessonsById.get(id)!, module_id: o.id })),
      }));
    });
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragOver = (e: DragOverEvent) => {
    const active = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    if (!over || !active.startsWith("lesson:")) return;
    const lessonId = strip(active);
    const order = toOrder(modules);
    const from = findModuleOfLesson(order, lessonId);
    let toModule: string | null = null;
    let toIndex = 0;
    if (over.startsWith("lesson:")) {
      toModule = findModuleOfLesson(order, strip(over));
      toIndex = toModule ? order.find((m) => m.id === toModule)!.lessonIds.indexOf(strip(over)) : 0;
    } else if (over.startsWith("drop:") || over.startsWith("module:")) {
      toModule = strip(over);
      toIndex = order.find((m) => m.id === toModule)?.lessonIds.length ?? 0;
    }
    if (!toModule || toModule === from) return;
    applyOrder(moveLesson(order, lessonId, toModule, toIndex));
  };

  const persist = async (order: ModuleOrder[]) => {
    if (sameOrder(order, savedOrder)) return;
    const res = await reorder.run({ courseId, structure: order });
    if (res.ok) {
      setSavedOrder(order);
      toast.success("Order saved");
    } else {
      applyOrder(savedOrder);
    }
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const active = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    let order = toOrder(modules);
    if (over && active.startsWith("module:")) {
      const target = over.startsWith("module:") ? strip(over) : over.startsWith("drop:") ? strip(over) : findModuleOfLesson(order, strip(over));
      const toIndex = order.findIndex((m) => m.id === target);
      if (toIndex >= 0) order = moveModule(order, strip(active), toIndex);
    } else if (over && active.startsWith("lesson:") && over.startsWith("lesson:")) {
      const lessonId = strip(active);
      const target = findModuleOfLesson(order, strip(over));
      if (target) order = moveLesson(order, lessonId, target, order.find((m) => m.id === target)!.lessonIds.indexOf(strip(over)));
    }
    applyOrder(order);
    void persist(order);
  };

  const activeLesson = activeId?.startsWith("lesson:") ? lessonsById.get(strip(activeId)) : null;
  const activeModule = activeId?.startsWith("module:") ? modules.find((m) => m.id === strip(activeId)) : null;
  const lessonCount = modules.reduce((s, m) => s + m.lessons.length, 0);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {modules.length} module{modules.length === 1 ? "" : "s"} · {lessonCount} lesson{lessonCount === 1 ? "" : "s"}
          {canEdit && modules.length > 0 ? " · Drag the handles to reorder, or use Tab and Space with the arrow keys." : ""}
        </p>
        {canEdit ? (
          <div className="flex gap-2">
            {modules.length > 0 ? (
              <Button variant="outline" onClick={() => setLessonDialog({ open: true, lesson: null })}>
                <Plus /> Add lesson
              </Button>
            ) : null}
            <Button onClick={() => setModuleDialog({ open: true, module: null })}>
              <FolderPlus /> Add module
            </Button>
          </div>
        ) : null}
      </div>

      {modules.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Start with a module"
          description="Modules group lessons into sections. Add your first module, then add lessons to it."
          action={
            canEdit ? (
              <Button onClick={() => setModuleDialog({ open: true, module: null })}>
                <FolderPlus /> Add module
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={() => {
            setActiveId(null);
            applyOrder(savedOrder);
          }}
        >
          <SortableContext items={modules.map((m) => M(m.id))} strategy={verticalListSortingStrategy}>
            <div className="grid gap-4">
              {modules.map((module, index) => (
                <SortableModule
                  key={module.id}
                  module={module}
                  index={index}
                  canEdit={canEdit}
                  courseId={courseId}
                  onEdit={() => setModuleDialog({ open: true, module })}
                  onAddLesson={() => setLessonDialog({ open: true, lesson: null, moduleId: module.id })}
                >
                  <SortableContext items={module.lessons.map((l) => L(l.id))} strategy={verticalListSortingStrategy}>
                    <LessonDropZone moduleId={module.id} empty={module.lessons.length === 0}>
                      {module.lessons.map((lesson) => (
                        <SortableLesson
                          key={lesson.id}
                          lesson={lesson}
                          courseId={courseId}
                          canEdit={canEdit}
                          lessonHref={`${courseBase}/lessons/${lesson.id}`}
                          prerequisiteTitle={lesson.prerequisite_lesson_id ? lessonsById.get(lesson.prerequisite_lesson_id)?.title : undefined}
                          onSettings={() => setLessonDialog({ open: true, lesson })}
                        />
                      ))}
                    </LessonDropZone>
                  </SortableContext>
                </SortableModule>
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeLesson ? (
              <div className="rotate-1 shadow-raised">
                <LessonRowBody lesson={activeLesson} lessonHref="#" canEdit={false} courseId={courseId} onSettings={() => undefined} />
              </div>
            ) : activeModule ? (
              <div className="rounded-2xl border bg-card px-4 py-3 font-heading font-semibold shadow-raised">{activeModule.title}</div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {moduleDialog.open ? (
        <ModuleDialog
          key={moduleDialog.module?.id ?? "new"}
          courseId={courseId}
          module={moduleDialog.module}
          open
          onOpenChange={(open) => setModuleDialog((s) => ({ ...s, open }))}
        />
      ) : null}
      {lessonDialog.open ? (
        <LessonDialog
          key={lessonDialog.lesson?.id ?? `new-${lessonDialog.moduleId ?? ""}`}
          courseId={courseId}
          modules={modules}
          lesson={lessonDialog.lesson}
          defaultModuleId={lessonDialog.moduleId}
          open
          onOpenChange={(open) => setLessonDialog((s) => ({ ...s, open }))}
          onCreated={(id) => router.push(`${courseBase}/lessons/${id}`)}
        />
      ) : null}
    </div>
  );
}
