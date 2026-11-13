"use client";

import { useState } from "react";
import { Download, Loader2, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/common/rich-text-editor";
import { FileUpload } from "@/components/common/file-upload";
import { useAction } from "@/hooks/use-action";
import { formatBytes } from "@/lib/format";
import { saveAssignment } from "@/lib/services/courses/actions/assignments";
import type { AssignmentDetail } from "@/lib/services/courses/authoring";
import { ASSIGNMENT_FILE_TYPES, SUBMISSION_TYPES, type RubricCriterion } from "@/lib/validation/course";
import { DateTimeField, FormRow, NumberField, SwitchRow, fieldError } from "./form-bits";

type FileRow = { id: string; file_name: string; size_bytes: number };

const SUBMISSION_LABELS: Record<(typeof SUBMISSION_TYPES)[number], string> = {
  text: "Written answer",
  file: "File upload",
  link: "Link",
};

let rid = 0;
const newId = () => `c${Date.now().toString(36)}${(rid++).toString(36)}`;

export function AssignmentEditor({
  courseId,
  assignment,
  lessons,
  files: initialFiles,
  canEdit,
  submissionCount,
}: {
  courseId: string;
  assignment: AssignmentDetail;
  lessons: { id: string; title: string }[];
  files: FileRow[];
  canEdit: boolean;
  submissionCount: number;
}) {
  const [f, setF] = useState(assignment);
  const [dueMode, setDueMode] = useState<"none" | "fixed" | "relative">(assignment.due_at ? "fixed" : assignment.due_days_after_enrollment ? "relative" : "none");
  const [files, setFiles] = useState<FileRow[]>(initialFiles);
  const set = <K extends keyof AssignmentDetail>(k: K, v: AssignmentDetail[K]) => setF((s) => ({ ...s, [k]: v }));
  const save = useAction(saveAssignment);
  const disabled = !canEdit || save.pending;
  const errs = save.fieldErrors;
  const rubricTotal = f.rubric.reduce((s, r) => s + (Number(r.points) || 0), 0);

  const setRubric = (index: number, patch: Partial<RubricCriterion>) => set("rubric", f.rubric.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  const toggleIn = <T extends string>(list: T[], v: T, on: boolean) => (on ? [...new Set([...list, v])] : list.filter((x) => x !== v));

  const submit = (status: AssignmentDetail["status"]) =>
    void save.run({
      courseId,
      assignmentId: assignment.id,
      title: f.title,
      instructions: f.instructions ?? "",
      lesson_id: f.lesson_id,
      max_points: f.max_points,
      passing_points: f.passing_points,
      due_mode: dueMode,
      due_at: f.due_at,
      due_days_after_enrollment: f.due_days_after_enrollment,
      allow_late_submissions: f.allow_late_submissions,
      late_penalty_percent: f.late_penalty_percent,
      submission_types: f.submission_types,
      allowed_file_types: f.allowed_file_types as (typeof ASSIGNMENT_FILE_TYPES)[number][],
      max_file_size_mb: f.max_file_size_mb,
      max_files: f.max_files,
      rubric: f.rubric.map((r) => ({ ...r, points: Number(r.points) || 0 })),
      grading_criteria: f.grading_criteria,
      counts_toward_completion: f.counts_toward_completion,
      status,
      supporting_media_ids: files.map((x) => x.id),
    });

  return (
    <form
      className="grid gap-6 pb-10 lg:grid-cols-[minmax(0,1fr)_340px]"
      onSubmit={(e) => {
        e.preventDefault();
        submit(f.status);
      }}
    >
      <div className="grid min-w-0 content-start gap-5">
        {submissionCount > 0 ? (
          <p className="rounded-lg bg-info-soft px-3 py-2 text-xs text-info">
            {submissionCount} submission{submissionCount === 1 ? " has" : "s have"} been received. Grading changes don’t alter grades already given.
          </p>
        ) : null}
        <FormRow label="Title" error={fieldError(errs, "title")}>
          <Input value={f.title} maxLength={200} disabled={disabled} onChange={(e) => set("title", e.target.value)} />
        </FormRow>
        <FormRow label="Instructions" error={fieldError(errs, "instructions")}>
          <RichTextEditor
            value={f.instructions ?? ""}
            onChange={(html) => set("instructions", html)}
            minHeight={240}
            ariaLabel="Assignment instructions"
            placeholder="Explain the task, what to submit and how it will be assessed…"
          />
        </FormRow>
        <FormRow label="Supporting files" optional hint="Templates or examples students can download.">
          {files.length ? (
            <ul className="grid gap-2">
              {files.map((file) => (
                <li key={file.id} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{file.file_name}</span>
                  <span className="text-xs text-muted-foreground">{formatBytes(file.size_bytes)}</span>
                  <Button asChild variant="ghost" size="icon-sm" aria-label={`Download ${file.file_name}`}>
                    <a href={`/api/files/${file.id}?download=1`}>
                      <Download />
                    </a>
                  </Button>
                  {canEdit ? (
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${file.file_name}`} onClick={() => setFiles((l) => l.filter((x) => x.id !== file.id))}>
                      <X />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {canEdit && files.length < 20 ? (
            <FileUpload
              purpose="course_content"
              context={{ courseId }}
              multiple
              maxFiles={20 - files.length}
              label="Upload files"
              onUploaded={(u) => setFiles((l) => [...l, { id: u.id, file_name: u.fileName, size_bytes: u.size }])}
            />
          ) : null}
        </FormRow>

        <section className="grid gap-3 rounded-2xl border bg-card p-4" aria-labelledby="rubric-heading">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="rubric-heading" className="text-base font-semibold">
                Rubric
              </h2>
              <p className="text-xs text-muted-foreground">
                {f.rubric.length ? `${rubricTotal} of ${f.max_points} points allocated` : "Optional criteria instructors score when grading."}
              </p>
            </div>
            {canEdit && f.rubric.length < 20 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => set("rubric", [...f.rubric, { id: newId(), criterion: "", description: "", points: 0 }])}
              >
                <Plus /> Add criterion
              </Button>
            ) : null}
          </div>
          {fieldError(errs, "rubric") ? <p className="text-xs text-destructive">{fieldError(errs, "rubric")}</p> : null}
          {f.rubric.map((r, i) => (
            <div key={r.id} className="grid gap-2 rounded-xl border bg-muted/30 p-3 sm:grid-cols-[1fr_110px_auto]">
              <div className="grid gap-2">
                <Input
                  value={r.criterion}
                  maxLength={200}
                  placeholder="Criterion, e.g. Clear product positioning"
                  aria-label={`Criterion ${i + 1}`}
                  disabled={disabled}
                  onChange={(e) => setRubric(i, { criterion: e.target.value })}
                />
                <Textarea
                  rows={2}
                  maxLength={1000}
                  value={r.description}
                  placeholder="What a strong answer includes"
                  aria-label={`Criterion ${i + 1} description`}
                  disabled={disabled}
                  onChange={(e) => setRubric(i, { description: e.target.value })}
                />
              </div>
              <NumberField value={r.points} onChange={(v) => setRubric(i, { points: v ?? 0 })} min={0} max={1000} suffix="pts" disabled={disabled} />
              {canEdit ? (
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove criterion ${i + 1}`} onClick={() => set("rubric", f.rubric.filter((_, j) => j !== i))}>
                  <Trash2 />
                </Button>
              ) : null}
            </div>
          ))}
          <FormRow label="Grading notes" optional hint="Visible to students alongside the rubric.">
            <Textarea rows={2} maxLength={4000} value={f.grading_criteria ?? ""} disabled={disabled} onChange={(e) => set("grading_criteria", e.target.value)} />
          </FormRow>
        </section>
      </div>

      <aside className="grid content-start gap-5 lg:sticky lg:top-20">
        <div className="grid gap-4 rounded-2xl border bg-card p-4">
          <h2 className="text-base font-semibold">Grading</h2>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Maximum points" error={fieldError(errs, "max_points")}>
              <NumberField value={f.max_points} onChange={(v) => set("max_points", v ?? 100)} min={1} max={1000} disabled={disabled} />
            </FormRow>
            <FormRow label="Pass mark" optional error={fieldError(errs, "passing_points")}>
              <NumberField value={f.passing_points} onChange={(v) => set("passing_points", v)} min={0} max={1000} disabled={disabled} />
            </FormRow>
          </div>
          <SwitchRow
            label="Counts toward completion"
            description="Must be graded or approved for the certificate when the course requires it."
            checked={f.counts_toward_completion}
            onCheckedChange={(v) => set("counts_toward_completion", v)}
            disabled={disabled}
          />
          <FormRow label="Lesson" optional>
            <Select value={f.lesson_id ?? "none"} onValueChange={(v) => set("lesson_id", v === "none" ? null : v)} disabled={disabled}>
              <SelectTrigger className="w-full" aria-label="Lesson">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not linked to a lesson</SelectItem>
                {lessons.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormRow>
        </div>

        <div className="grid gap-4 rounded-2xl border bg-card p-4">
          <h2 className="text-base font-semibold">Deadline</h2>
          <RadioGroup value={dueMode} onValueChange={(v) => setDueMode(v as typeof dueMode)} className="grid gap-2" disabled={disabled}>
            {[
              { v: "none", l: "No deadline" },
              { v: "fixed", l: "A fixed date" },
              { v: "relative", l: "Days after enrolling" },
            ].map((o) => (
              <Label key={o.v} className="flex items-center gap-2 text-sm font-normal">
                <RadioGroupItem value={o.v} /> {o.l}
              </Label>
            ))}
          </RadioGroup>
          {dueMode === "fixed" ? (
            <FormRow label="Due" error={fieldError(errs, "due_at")}>
              <DateTimeField value={f.due_at} onChange={(v) => set("due_at", v)} disabled={disabled} />
            </FormRow>
          ) : null}
          {dueMode === "relative" ? (
            <FormRow label="Due after" error={fieldError(errs, "due_days_after_enrollment")}>
              <NumberField value={f.due_days_after_enrollment} onChange={(v) => set("due_days_after_enrollment", v)} min={1} max={3650} suffix="days" disabled={disabled} />
            </FormRow>
          ) : null}
          {dueMode !== "none" ? (
            <>
              <SwitchRow label="Accept late submissions" checked={f.allow_late_submissions} onCheckedChange={(v) => set("allow_late_submissions", v)} disabled={disabled} />
              {f.allow_late_submissions ? (
                <FormRow label="Late penalty">
                  <NumberField value={f.late_penalty_percent} onChange={(v) => set("late_penalty_percent", v ?? 0)} min={0} max={100} suffix="%" disabled={disabled} />
                </FormRow>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="grid gap-4 rounded-2xl border bg-card p-4">
          <h2 className="text-base font-semibold">Submissions</h2>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Students can submit</legend>
            {SUBMISSION_TYPES.map((t) => (
              <Label key={t} className="flex items-center gap-2 text-sm font-normal">
                <Checkbox
                  checked={f.submission_types.includes(t)}
                  disabled={disabled}
                  onCheckedChange={(v) => set("submission_types", toggleIn(f.submission_types, t, v === true))}
                />
                {SUBMISSION_LABELS[t]}
              </Label>
            ))}
            {fieldError(errs, "submission_types") ? <p className="text-xs text-destructive">{fieldError(errs, "submission_types")}</p> : null}
          </fieldset>
          {f.submission_types.includes("file") ? (
            <>
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium">Allowed file types</legend>
                <div className="grid grid-cols-3 gap-2">
                  {ASSIGNMENT_FILE_TYPES.map((ext) => (
                    <Label key={ext} className="flex items-center gap-1.5 text-sm font-normal">
                      <Checkbox
                        checked={f.allowed_file_types.includes(ext)}
                        disabled={disabled}
                        onCheckedChange={(v) => set("allowed_file_types", toggleIn(f.allowed_file_types, ext, v === true))}
                      />
                      .{ext}
                    </Label>
                  ))}
                </div>
                {fieldError(errs, "allowed_file_types") ? <p className="text-xs text-destructive">{fieldError(errs, "allowed_file_types")}</p> : null}
              </fieldset>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="Files per submission">
                  <NumberField value={f.max_files} onChange={(v) => set("max_files", v ?? 1)} min={1} max={20} disabled={disabled} />
                </FormRow>
                <FormRow label="Size per file">
                  <NumberField value={f.max_file_size_mb} onChange={(v) => set("max_file_size_mb", v ?? 25)} min={1} max={500} suffix="MB" disabled={disabled} />
                </FormRow>
              </div>
            </>
          ) : null}
        </div>

        {canEdit ? (
          <div className="flex flex-wrap justify-end gap-2">
            {save.error && !Object.keys(errs).length ? <p className="w-full text-sm text-destructive">{save.error}</p> : null}
            {f.status === "published" ? (
              <>
                <Button type="button" variant="ghost" disabled={save.pending} onClick={() => submit("draft")}>
                  Unpublish
                </Button>
                <Button type="submit" disabled={save.pending}>
                  {save.pending ? <Loader2 className="animate-spin" /> : null}
                  Save assignment
                </Button>
              </>
            ) : (
              <>
                <Button type="submit" variant="outline" disabled={save.pending}>
                  Save draft
                </Button>
                <Button type="button" disabled={save.pending} onClick={() => submit("published")}>
                  {save.pending ? <Loader2 className="animate-spin" /> : null}
                  Publish assignment
                </Button>
              </>
            )}
          </div>
        ) : null}
      </aside>
    </form>
  );
}
