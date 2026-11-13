"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAction } from "@/hooks/use-action";
import { saveLesson } from "@/lib/services/courses/actions/curriculum";
import type { BuilderLesson, BuilderModule } from "@/lib/services/courses/builder";
import { DateTimeField, FormRow, NumberField, SwitchRow, fieldError } from "./form-bits";

export const LESSON_TYPE_LABELS: Record<BuilderLesson["lesson_type"], string> = {
  video: "Video",
  article: "Article",
  quiz: "Quiz",
  assignment: "Assignment",
  live: "Live session",
  resource: "Resources",
  mixed: "Mixed content",
};

export const COMPLETION_LABELS: Record<BuilderLesson["completion_rule"], string> = {
  manual: "Student marks it complete",
  video_watched: "Student watches the video",
  quiz_passed: "Student passes the quiz",
  assignment_approved: "Assignment is approved",
};

export function LessonDialog({
  courseId,
  modules,
  lesson,
  defaultModuleId,
  open,
  onOpenChange,
  onCreated,
}: {
  courseId: string;
  modules: BuilderModule[];
  lesson: BuilderLesson | null;
  defaultModuleId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}) {
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [summary, setSummary] = useState(lesson?.summary ?? "");
  const [moduleId, setModuleId] = useState(lesson?.module_id ?? defaultModuleId ?? modules[0]?.id ?? "");
  const [type, setType] = useState<BuilderLesson["lesson_type"]>(lesson?.lesson_type ?? "video");
  const [duration, setDuration] = useState<number | null>(lesson?.duration_minutes ?? null);
  const [preview, setPreview] = useState(lesson?.is_preview ?? false);
  const [published, setPublished] = useState(lesson?.is_published ?? true);
  const [releaseAt, setReleaseAt] = useState<string | null>(lesson?.release_at ?? null);
  const [releaseDays, setReleaseDays] = useState<number | null>(lesson?.release_after_days ?? null);
  const [prerequisite, setPrerequisite] = useState<string | null>(lesson?.prerequisite_lesson_id ?? null);
  const [rule, setRule] = useState<BuilderLesson["completion_rule"]>(lesson?.completion_rule ?? "manual");

  const action = useAction(saveLesson, {
    onSuccess: (d) => {
      onOpenChange(false);
      if (!lesson) onCreated?.(d.id);
    },
  });
  const allLessons = modules.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleTitle: m.title }))).filter((l) => l.id !== lesson?.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <form
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void action.run({
              courseId,
              lessonId: lesson?.id,
              moduleId,
              title,
              summary: summary || null,
              lesson_type: type,
              duration_minutes: duration,
              is_preview: preview,
              is_published: published,
              release_at: releaseAt,
              release_after_days: releaseDays,
              prerequisite_lesson_id: prerequisite,
              completion_rule: rule,
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{lesson ? "Lesson settings" : "Add a lesson"}</DialogTitle>
            <DialogDescription>
              {lesson ? "Change how this lesson is released and completed." : "You'll add videos, text and files in the lesson editor next."}
            </DialogDescription>
          </DialogHeader>
          <FormRow label="Lesson title" htmlFor="lesson-title" error={fieldError(action.fieldErrors, "title")}>
            <Input id="lesson-title" value={title} maxLength={200} autoFocus onChange={(e) => setTitle(e.target.value)} />
          </FormRow>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormRow label="Module">
              <Select value={moduleId} onValueChange={setModuleId}>
                <SelectTrigger className="w-full" aria-label="Module">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {modules.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormRow>
            <FormRow label="Main content">
              <Select value={type} onValueChange={(v) => setType(v as BuilderLesson["lesson_type"])}>
                <SelectTrigger className="w-full" aria-label="Main content">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LESSON_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormRow>
          </div>
          <FormRow label="Summary" htmlFor="lesson-summary" optional hint="Shown under the lesson title in the player.">
            <Textarea id="lesson-summary" rows={2} maxLength={2000} value={summary} onChange={(e) => setSummary(e.target.value)} />
          </FormRow>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormRow label="Duration" optional>
              <NumberField value={duration} onChange={setDuration} min={0} max={10000} suffix="minutes" />
            </FormRow>
            <FormRow label="Completed when">
              <Select value={rule} onValueChange={(v) => setRule(v as BuilderLesson["completion_rule"])}>
                <SelectTrigger className="w-full" aria-label="Completion rule">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(COMPLETION_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormRow>
          </div>
          <SwitchRow label="Visible to students" checked={published} onCheckedChange={setPublished} />
          <SwitchRow
            label="Free preview"
            description="Anyone with an account can watch this lesson before enrolling."
            checked={preview}
            onCheckedChange={setPreview}
          />
          <FormRow label="Prerequisite lesson" optional hint="Students must complete it before opening this lesson.">
            <Select value={prerequisite ?? "none"} onValueChange={(v) => setPrerequisite(v === "none" ? null : v)}>
              <SelectTrigger className="w-full" aria-label="Prerequisite lesson">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {allLessons.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.moduleTitle} · {l.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormRow>
          <div className="grid gap-4 rounded-xl border bg-muted/30 p-4">
            <p className="text-sm font-medium">Scheduled release (drip)</p>
            <FormRow label="Unlock on a date" optional>
              <DateTimeField value={releaseAt} onChange={setReleaseAt} />
            </FormRow>
            <FormRow label="Or unlock after enrolling" optional>
              <div className="max-w-44">
                <NumberField value={releaseDays} onChange={setReleaseDays} min={0} max={3650} suffix="days" />
              </div>
            </FormRow>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={action.pending || !title.trim() || !moduleId}>
              {action.pending ? <Loader2 className="animate-spin" /> : null}
              {lesson ? "Save lesson" : "Add lesson"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
