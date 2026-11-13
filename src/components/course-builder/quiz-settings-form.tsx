"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAction } from "@/hooks/use-action";
import { saveQuizSettings } from "@/lib/services/courses/actions/quizzes";
import type { BankListItem, QuizDetail } from "@/lib/services/courses/authoring";
import { FormRow, NumberField, SwitchRow, fieldError } from "./form-bits";

export function QuizSettingsForm({
  courseId,
  quiz,
  banks,
  lessons,
  canEdit,
  attemptCount,
}: {
  courseId: string;
  quiz: QuizDetail;
  banks: BankListItem[];
  lessons: { id: string; title: string }[];
  canEdit: boolean;
  attemptCount: number;
}) {
  const [f, setF] = useState(quiz);
  const [useBank, setUseBank] = useState(Boolean(quiz.question_bank_id && quiz.draw_count));
  const set = <K extends keyof QuizDetail>(k: K, v: QuizDetail[K]) => setF((s) => ({ ...s, [k]: v }));
  const save = useAction(saveQuizSettings);
  const disabled = !canEdit || save.pending;
  const errs = save.fieldErrors;

  const submit = (status: QuizDetail["status"]) =>
    void save.run({
      courseId,
      quizId: quiz.id,
      title: f.title,
      description: f.description,
      lesson_id: f.lesson_id,
      time_limit_minutes: f.time_limit_minutes,
      max_attempts: f.max_attempts,
      passing_score: f.passing_score,
      shuffle_questions: f.shuffle_questions,
      shuffle_options: f.shuffle_options,
      question_bank_id: useBank ? f.question_bank_id : null,
      draw_count: useBank ? f.draw_count : null,
      show_correct_answers: f.show_correct_answers,
      retry_cooldown_minutes: f.retry_cooldown_minutes,
      counts_toward_completion: f.counts_toward_completion,
      status,
    });

  return (
    <form
      className="grid gap-5 rounded-2xl border bg-card p-4 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit(f.status);
      }}
    >
      <h2 className="text-base font-semibold">Quiz settings</h2>
      {attemptCount > 0 ? (
        <p className="rounded-lg bg-info-soft px-3 py-2 text-xs text-info">
          {attemptCount} attempt{attemptCount === 1 ? " has" : "s have"} been made. Changes apply to new attempts only.
        </p>
      ) : null}
      <FormRow label="Title" error={fieldError(errs, "title")}>
        <Input value={f.title} maxLength={200} disabled={disabled} onChange={(e) => set("title", e.target.value)} />
      </FormRow>
      <FormRow label="Instructions" optional>
        <Textarea rows={3} maxLength={4000} value={f.description ?? ""} disabled={disabled} onChange={(e) => set("description", e.target.value)} />
      </FormRow>
      <FormRow label="Lesson" optional hint="Lessons with “Student passes the quiz” complete when this quiz is passed.">
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
      <div className="grid gap-4 sm:grid-cols-2">
        <FormRow label="Passing score" error={fieldError(errs, "passing_score")}>
          <NumberField value={f.passing_score} onChange={(v) => set("passing_score", v ?? 0)} min={0} max={100} suffix="%" disabled={disabled} />
        </FormRow>
        <FormRow label="Time limit" optional error={fieldError(errs, "time_limit_minutes")}>
          <NumberField value={f.time_limit_minutes} onChange={(v) => set("time_limit_minutes", v)} min={1} max={600} suffix="minutes" placeholder="None" disabled={disabled} />
        </FormRow>
        <FormRow label="Attempts allowed" optional error={fieldError(errs, "max_attempts")}>
          <NumberField value={f.max_attempts} onChange={(v) => set("max_attempts", v)} min={1} max={100} placeholder="Unlimited" disabled={disabled} />
        </FormRow>
        <FormRow label="Wait before retrying" error={fieldError(errs, "retry_cooldown_minutes")}>
          <NumberField value={f.retry_cooldown_minutes} onChange={(v) => set("retry_cooldown_minutes", v ?? 0)} min={0} max={43200} suffix="minutes" disabled={disabled} />
        </FormRow>
      </div>
      <FormRow label="Show correct answers">
        <Select value={f.show_correct_answers} onValueChange={(v) => set("show_correct_answers", v as QuizDetail["show_correct_answers"])} disabled={disabled}>
          <SelectTrigger className="w-full" aria-label="Show correct answers">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="after_submit">After each attempt</SelectItem>
            <SelectItem value="after_pass">Only after passing</SelectItem>
            <SelectItem value="never">Never</SelectItem>
          </SelectContent>
        </Select>
      </FormRow>
      <SwitchRow label="Shuffle question order" checked={f.shuffle_questions} onCheckedChange={(v) => set("shuffle_questions", v)} disabled={disabled} />
      <SwitchRow label="Shuffle answer options" checked={f.shuffle_options} onCheckedChange={(v) => set("shuffle_options", v)} disabled={disabled} />
      <SwitchRow
        label="Counts toward course completion"
        description="Required for the certificate when the course asks for passed quizzes."
        checked={f.counts_toward_completion}
        onCheckedChange={(v) => set("counts_toward_completion", v)}
        disabled={disabled}
      />
      <SwitchRow
        label="Draw random questions from a bank"
        description="Each attempt gets a different random set instead of the questions below."
        checked={useBank}
        onCheckedChange={setUseBank}
        disabled={disabled || banks.length === 0}
      />
      {useBank ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormRow label="Question bank">
            <Select value={f.question_bank_id ?? "none"} onValueChange={(v) => set("question_bank_id", v === "none" ? null : v)} disabled={disabled}>
              <SelectTrigger className="w-full" aria-label="Question bank">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Choose a bank…</SelectItem>
                {banks.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.title} ({b.question_count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormRow>
          <FormRow label="Questions per attempt" error={fieldError(errs, "draw_count")}>
            <NumberField value={f.draw_count} onChange={(v) => set("draw_count", v)} min={1} max={200} disabled={disabled} />
          </FormRow>
        </div>
      ) : null}
      {canEdit ? (
        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
          {f.status !== "published" ? (
            <>
              <Button type="submit" variant="outline" disabled={save.pending}>
                Save draft
              </Button>
              <Button type="button" disabled={save.pending} onClick={() => submit("published")}>
                {save.pending ? <Loader2 className="animate-spin" /> : null}
                Publish quiz
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="ghost" disabled={save.pending} onClick={() => submit("draft")}>
                Unpublish
              </Button>
              <Button type="submit" disabled={save.pending}>
                {save.pending ? <Loader2 className="animate-spin" /> : null}
                Save quiz
              </Button>
            </>
          )}
        </div>
      ) : null}
    </form>
  );
}
