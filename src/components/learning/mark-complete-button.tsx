"use client";

import { CheckCircle2, Circle, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { markLessonCompleteAction, markLessonIncompleteAction } from "@/app/learn/courses/actions";

export function MarkCompleteButton({ lessonId, completed, rule }: { lessonId: string; completed: boolean; rule: string }) {
  const complete = useAction(markLessonCompleteAction);
  const undo = useAction(markLessonIncompleteAction);

  if (completed) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-9 items-center gap-2 rounded-lg bg-mint-soft px-3 text-sm font-medium text-mint-strong">
          <CheckCircle2 className="size-4" /> Completed
        </span>
        {rule === "manual" ? (
          <Button variant="ghost" size="sm" disabled={undo.pending} onClick={() => undo.run({ lessonId })}>
            <Undo2 /> {undo.pending ? "Updating…" : "Mark as not complete"}
          </Button>
        ) : null}
      </div>
    );
  }

  if (rule !== "manual") {
    const hint =
      rule === "video_watched"
        ? "Completes automatically when you've watched the video."
        : rule === "quiz_passed"
          ? "Completes when you pass this lesson's quiz."
          : "Completes when your assignment is approved.";
    return (
      <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Circle className="size-4" /> {hint}
      </p>
    );
  }

  return (
    <Button size="lg" disabled={complete.pending} onClick={() => complete.run({ lessonId })}>
      <CheckCircle2 /> {complete.pending ? "Saving…" : "Mark as complete"}
    </Button>
  );
}
