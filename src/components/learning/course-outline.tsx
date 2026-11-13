import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  CircleDot,
  ClipboardList,
  Clock,
  FileText,
  Layers,
  ListChecks,
  Lock,
  Paperclip,
  PlayCircle,
  Radio,
} from "lucide-react";
import { LocalTime } from "@/components/common/local-time";
import { formatDuration } from "@/lib/format";
import type { OutlineLesson, OutlineModule } from "@/lib/services/learner";
import { cn } from "@/lib/utils";

const TYPE_ICON = {
  video: PlayCircle,
  article: FileText,
  quiz: ListChecks,
  assignment: ClipboardList,
  live: Radio,
  resource: Paperclip,
  mixed: Layers,
} as const;

const TYPE_LABEL: Record<string, string> = {
  video: "Video",
  article: "Reading",
  quiz: "Quiz",
  assignment: "Assignment",
  live: "Live class",
  resource: "Resources",
  mixed: "Lesson",
};

export function lessonBlockedReason(lesson: OutlineLesson): string | null {
  if (!lesson.released) return "Not released yet";
  if (lesson.lock === "sequential") return "Complete the previous lessons first";
  if (lesson.lock === "prerequisite") return "Complete the prerequisite lesson first";
  return null;
}

function StatusIcon({ lesson }: { lesson: OutlineLesson }) {
  if (lesson.status === "completed") return <CheckCircle2 className="size-4.5 text-mint-strong" aria-label="Completed" />;
  if (!lesson.released) return <Clock className="size-4.5 text-muted-foreground" aria-label="Not released yet" />;
  if (lesson.lock) return <Lock className="size-4 text-muted-foreground" aria-label="Locked" />;
  if (lesson.status === "in_progress") return <CircleDot className="size-4.5 text-mint-strong" aria-label="In progress" />;
  return <Circle className="size-4.5 text-muted-foreground/60" aria-label="Not started" />;
}

export function CourseOutline({
  courseSlug,
  modules,
  activeLessonId,
  canOpen,
  compact = false,
  previewOnly = false,
}: {
  courseSlug: string;
  modules: OutlineModule[];
  activeLessonId?: string;
  /** False when the learner has no access (outline is informational only). */
  canOpen: boolean;
  compact?: boolean;
  /** Only preview lessons are openable (signed-in visitors without access). */
  previewOnly?: boolean;
}) {
  if (modules.length === 0) {
    return <p className="px-1 py-6 text-sm text-muted-foreground">Lessons will appear here once the instructor publishes them.</p>;
  }
  return (
    <nav aria-label="Course outline" className="space-y-3">
      {modules.map((module, mi) => {
        const done = module.lessons.filter((l) => l.status === "completed").length;
        const containsActive = module.lessons.some((l) => l.id === activeLessonId);
        return (
          <details
            key={module.id}
            open={compact ? containsActive || (!activeLessonId && mi === 0) : true}
            className={cn("group rounded-xl", compact ? "" : "border bg-card")}
          >
            <summary
              className={cn(
                "flex cursor-pointer list-none items-start justify-between gap-3 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/40 [&::-webkit-details-marker]:hidden",
                compact ? "px-2 py-2" : "px-4 py-3",
              )}
            >
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">Module {mi + 1}</span>
                <span className={cn("block font-semibold", compact ? "text-sm" : "text-base")}>{module.title}</span>
              </span>
              <span className="mt-1 shrink-0 text-xs text-muted-foreground tabular-nums">
                {done}/{module.lessons.length}
              </span>
            </summary>
            <ol className={cn("space-y-0.5", compact ? "pb-2" : "px-2 pb-3")}>
              {module.lessons.map((lesson) => {
                const Icon = TYPE_ICON[lesson.lessonType as keyof typeof TYPE_ICON] ?? Layers;
                const blocked = lessonBlockedReason(lesson);
                const openable = canOpen ? !blocked : previewOnly && lesson.isPreview;
                const active = lesson.id === activeLessonId;
                const inner = (
                  <>
                    <StatusIcon lesson={lesson} />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm leading-snug", active ? "font-semibold text-primary" : "text-foreground")}>
                        {lesson.title}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Icon className="size-3" aria-hidden /> {TYPE_LABEL[lesson.lessonType] ?? "Lesson"}
                        </span>
                        {lesson.durationMinutes ? <span>{formatDuration(lesson.durationMinutes)}</span> : null}
                        {lesson.isPreview && !canOpen ? <span className="font-medium text-primary">Free preview</span> : null}
                        {!lesson.released && lesson.releaseAt ? (
                          <span>
                            Opens <LocalTime value={lesson.releaseAt} format="date" />
                          </span>
                        ) : blocked && canOpen ? (
                          <span>{blocked}</span>
                        ) : null}
                        {!lesson.isPublished ? <span className="font-medium text-warning">Unpublished</span> : null}
                      </span>
                    </span>
                  </>
                );
                return (
                  <li key={lesson.id}>
                    {openable ? (
                      <Link
                        href={`/learn/courses/${courseSlug}/lessons/${lesson.id}`}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-start gap-3 rounded-lg px-2 py-2 transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40",
                          active && "bg-brand-soft hover:bg-brand-soft",
                        )}
                      >
                        {inner}
                      </Link>
                    ) : (
                      <div className="flex items-start gap-3 rounded-lg px-2 py-2 opacity-75" aria-disabled="true">
                        {inner}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </details>
        );
      })}
    </nav>
  );
}
