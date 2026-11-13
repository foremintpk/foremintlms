"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, Circle, Library, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmAction } from "@/components/common/confirm-action";
import { EmptyState } from "@/components/common/empty-state";
import { useAction } from "@/hooks/use-action";
import { copyQuestionsFromBank, deleteQuestion, reorderQuestions } from "@/lib/services/courses/actions/quizzes";
import type { QuestionWithOptions } from "@/lib/services/courses/authoring";
import { QuestionDialog, QUESTION_TYPE_LABELS } from "./question-dialog";
import { useSyncedState } from "./form-bits";

export interface BankPickerData {
  id: string;
  title: string;
  questions: { id: string; prompt: string; question_type: string }[];
}

function FromBankDialog({ courseId, quizId, banks, onClose }: { courseId: string; quizId: string; banks: BankPickerData[]; onClose: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const copy = useAction(copyQuestionsFromBank, { onSuccess: onClose });
  const toggle = (id: string, on: boolean) => setSelected((s) => (on ? [...s, id] : s.filter((x) => x !== id)));
  return (
    <Dialog open onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add questions from a bank</DialogTitle>
          <DialogDescription>Copies are added to this quiz; editing them won’t change the bank.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          {banks.filter((b) => b.questions.length).length === 0 ? (
            <p className="text-sm text-muted-foreground">Your question banks are empty.</p>
          ) : (
            banks
              .filter((b) => b.questions.length)
              .map((bank) => (
                <fieldset key={bank.id} className="grid gap-2">
                  <legend className="mb-1 text-sm font-semibold">{bank.title}</legend>
                  {bank.questions.map((q) => (
                    <label key={q.id} className="flex items-start gap-3 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50">
                      <Checkbox className="mt-0.5" checked={selected.includes(q.id)} onCheckedChange={(v) => toggle(q.id, v === true)} />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2">{q.prompt}</span>
                        <span className="text-xs text-muted-foreground">{QUESTION_TYPE_LABELS[q.question_type as keyof typeof QUESTION_TYPE_LABELS]}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              ))
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!selected.length || copy.pending} onClick={() => void copy.run({ courseId, quizId, questionIds: selected })}>
            {copy.pending ? <Loader2 className="animate-spin" /> : null}
            Add {selected.length || ""} question{selected.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Questions of a quiz or a bank, with add/edit/delete/reorder. */
export function QuestionList({
  courseId,
  quizId,
  bankId,
  questions: initial,
  banks = [],
  canEdit,
}: {
  courseId: string;
  quizId?: string;
  bankId?: string;
  questions: QuestionWithOptions[];
  banks?: BankPickerData[];
  canEdit: boolean;
}) {
  const [questions, setQuestions] = useSyncedState(initial);
  const [dialog, setDialog] = useState<{ open: boolean; question: QuestionWithOptions | null }>({ open: false, question: null });
  const [fromBank, setFromBank] = useState(false);
  const reorder = useAction(reorderQuestions, { silent: true });
  const total = questions.reduce((s, q) => s + q.points, 0);

  const move = (i: number, dir: -1 | 1) => {
    if (!quizId) return;
    const j = i + dir;
    if (j < 0 || j >= questions.length) return;
    const next = [...questions];
    [next[i], next[j]] = [next[j], next[i]];
    setQuestions(next);
    void reorder.run({ courseId, quizId, questionIds: next.map((q) => q.id) }).then((r) => {
      if (!r.ok) setQuestions(initial);
    });
  };

  return (
    <section className="grid gap-4" aria-labelledby="questions-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="questions-heading" className="text-base font-semibold">
            Questions
          </h2>
          <p className="text-sm text-muted-foreground">
            {questions.length} question{questions.length === 1 ? "" : "s"} · {total} point{total === 1 ? "" : "s"}
          </p>
        </div>
        {canEdit ? (
          <div className="flex gap-2">
            {quizId && banks.some((b) => b.questions.length) ? (
              <Button variant="outline" onClick={() => setFromBank(true)}>
                <Library /> From a bank
              </Button>
            ) : null}
            <Button onClick={() => setDialog({ open: true, question: null })}>
              <Plus /> Add question
            </Button>
          </div>
        ) : null}
      </div>

      {questions.length === 0 ? (
        <EmptyState
          title="No questions yet"
          description="Add single-choice, multiple-choice, true/false or short-answer questions."
          action={
            canEdit ? (
              <Button onClick={() => setDialog({ open: true, question: null })}>
                <Plus /> Add question
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ol className="grid gap-3">
          {questions.map((q, i) => (
            <li key={q.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold tabular-nums">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium whitespace-pre-line">{q.prompt}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {QUESTION_TYPE_LABELS[q.question_type]} · {q.points} point{q.points === 1 ? "" : "s"}
                    {q.question_type === "short_answer" ? (q.requires_manual_review ? " · reviewed by an instructor" : ` · ${q.accepted_answers.length} accepted answer${q.accepted_answers.length === 1 ? "" : "s"}`) : ""}
                  </p>
                  {q.options.length ? (
                    <ul className="mt-2 grid gap-1">
                      {q.options.map((o) => (
                        <li key={o.id} className="flex items-center gap-2 text-sm">
                          {o.is_correct ? <CheckCircle2 className="size-4 text-success" aria-label="Correct" /> : <Circle className="size-4 text-muted-foreground/50" aria-hidden />}
                          <span className={o.is_correct ? "font-medium" : "text-muted-foreground"}>{o.label}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                {canEdit ? (
                  <div className="flex shrink-0 items-center">
                    {quizId ? (
                      <>
                        <Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0 || reorder.pending} onClick={() => move(i, -1)}>
                          <ArrowUp />
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label="Move down" disabled={i === questions.length - 1 || reorder.pending} onClick={() => move(i, 1)}>
                          <ArrowDown />
                        </Button>
                      </>
                    ) : null}
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit question ${i + 1}`} onClick={() => setDialog({ open: true, question: q })}>
                      <Pencil />
                    </Button>
                    <ConfirmAction
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={`Delete question ${i + 1}`} className="text-muted-foreground hover:text-destructive">
                          <Trash2 />
                        </Button>
                      }
                      title="Delete this question?"
                      confirmLabel="Delete question"
                      destructive
                      action={() => deleteQuestion({ courseId, questionId: q.id })}
                    />
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}

      {dialog.open ? (
        <QuestionDialog
          key={dialog.question?.id ?? "new"}
          courseId={courseId}
          quizId={quizId}
          bankId={bankId}
          question={dialog.question}
          onClose={() => setDialog({ open: false, question: null })}
        />
      ) : null}
      {fromBank && quizId ? <FromBankDialog courseId={courseId} quizId={quizId} banks={banks} onClose={() => setFromBank(false)} /> : null}
    </section>
  );
}
