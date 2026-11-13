"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlarmClock, ChevronLeft, ChevronRight, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAction } from "@/hooks/use-action";
import { saveQuizAnswersAction, startQuizAction, submitQuizAction } from "@/app/learn/courses/actions";
import { cn } from "@/lib/utils";

interface Question {
  id: string;
  type: "single_choice" | "multiple_choice" | "true_false" | "short_answer";
  prompt: string;
  points: number;
  options: { id: string; label: string }[];
}

type Answers = Record<string, { selected: string[]; text: string }>;

const TYPE_HINT: Record<Question["type"], string> = {
  single_choice: "Choose one answer",
  multiple_choice: "Choose all that apply",
  true_false: "True or false",
  short_answer: "Type your answer",
};

function toPayload(answers: Answers) {
  return Object.entries(answers).map(([questionId, a]) => ({
    questionId,
    selectedOptionIds: a.selected,
    textAnswer: a.text || null,
  }));
}

function remaining(expiresAt: string | null) {
  if (!expiresAt) return null;
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

/** Takes one attempt. Answers autosave; the server enforces the time limit. */
export function QuizRunner({
  attemptId,
  questions,
  initialAnswers,
  expiresAt,
  resultHref,
}: {
  attemptId: string;
  questions: Question[];
  initialAnswers: Answers;
  expiresAt: string | null;
  resultHref: string;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [index, setIndex] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(() => remaining(expiresAt));
  const dirty = useRef(false);
  const submitted = useRef(false);

  const save = useAction(saveQuizAnswersAction, { silent: true });
  const submit = useAction(submitQuizAction, {
    onSuccess: () => {
      submitted.current = true;
      router.replace(resultHref);
    },
  });

  const doSubmit = useCallback(() => {
    if (submitted.current) return;
    submitted.current = true;
    void submit.run({ attemptId, answers: toPayload(answers) }).then((r) => {
      if (!r.ok) submitted.current = false;
    });
  }, [answers, attemptId, submit]);

  // Autosave every 15 seconds when something changed.
  useEffect(() => {
    const t = setInterval(() => {
      if (dirty.current && !submitted.current) {
        dirty.current = false;
        void save.run({ attemptId, answers: toPayload(answers) });
      }
    }, 15_000);
    return () => clearInterval(t);
  }, [answers, attemptId, save]);

  // Countdown; auto-submit when time is up.
  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => {
      const left = remaining(expiresAt);
      setSecondsLeft(left);
      if (left === 0) {
        clearInterval(t);
        toast.info("Time's up — submitting your answers.");
        doSubmit();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [expiresAt, doSubmit]);

  const answeredCount = useMemo(
    () => questions.filter((q) => (answers[q.id]?.selected.length ?? 0) > 0 || (answers[q.id]?.text ?? "").trim().length > 0).length,
    [answers, questions],
  );

  const update = (qid: string, next: Partial<{ selected: string[]; text: string }>) => {
    dirty.current = true;
    setAnswers((prev) => ({ ...prev, [qid]: { selected: prev[qid]?.selected ?? [], text: prev[qid]?.text ?? "", ...next } }));
  };

  const q = questions[index];
  const a = answers[q.id] ?? { selected: [], text: "" };
  const lowTime = secondsLeft !== null && secondsLeft <= 60;

  return (
    <div className="space-y-6">
      <div className="sticky top-14 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <p className="text-sm text-muted-foreground">
          Question <span className="font-medium text-foreground tabular-nums">{index + 1}</span> of {questions.length} ·{" "}
          <span className="tabular-nums">{answeredCount}</span> answered
        </p>
        {secondsLeft !== null ? (
          <p
            className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium tabular-nums", lowTime ? "bg-destructive/10 text-destructive" : "bg-muted")}
            role="timer"
            aria-live={lowTime ? "assertive" : "off"}
          >
            <AlarmClock className="size-4" aria-hidden />
            {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
          </p>
        ) : null}
      </div>

      <fieldset className="rounded-2xl border bg-card p-5 sm:p-6">
        <legend className="sr-only">Question {index + 1}</legend>
        <p className="text-xs font-medium text-muted-foreground">
          {TYPE_HINT[q.type]} · {q.points} point{q.points === 1 ? "" : "s"}
        </p>
        <p className="mt-2 font-heading text-lg leading-snug font-semibold whitespace-pre-wrap sm:text-xl">{q.prompt}</p>

        <div className="mt-5">
          {q.type === "short_answer" ? (
            <Textarea
              value={a.text}
              onChange={(e) => update(q.id, { text: e.target.value })}
              rows={4}
              maxLength={4000}
              aria-label="Your answer"
              placeholder="Type your answer"
            />
          ) : q.type === "multiple_choice" ? (
            <div className="space-y-2">
              {q.options.map((o) => {
                const checked = a.selected.includes(o.id);
                return (
                  <label
                    key={o.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/60",
                      checked && "border-primary bg-brand-soft/60",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => update(q.id, { selected: v ? [...a.selected, o.id] : a.selected.filter((x) => x !== o.id) })}
                      className="mt-0.5"
                    />
                    <span className="text-sm">{o.label}</span>
                  </label>
                );
              })}
            </div>
          ) : (
            <RadioGroup value={a.selected[0] ?? ""} onValueChange={(v) => update(q.id, { selected: [v] })} className="space-y-2">
              {q.options.map((o) => (
                <label
                  key={o.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/60",
                    a.selected[0] === o.id && "border-primary bg-brand-soft/60",
                  )}
                >
                  <RadioGroupItem value={o.id} className="mt-0.5" />
                  <span className="text-sm">{o.label}</span>
                </label>
              ))}
            </RadioGroup>
          )}
        </div>
      </fieldset>

      <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Quiz navigation">
        <Button variant="outline" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
          <ChevronLeft /> Previous
        </Button>
        <div className="flex flex-wrap gap-1.5" aria-label="Jump to question">
          {questions.map((qq, i) => {
            const done = (answers[qq.id]?.selected.length ?? 0) > 0 || (answers[qq.id]?.text ?? "").trim().length > 0;
            return (
              <button
                key={qq.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Question ${i + 1}${done ? ", answered" : ""}`}
                aria-current={i === index ? "step" : undefined}
                className={cn(
                  "size-8 rounded-lg border text-xs font-medium tabular-nums transition-colors",
                  i === index ? "border-primary bg-primary text-primary-foreground" : done ? "bg-brand-soft text-primary" : "hover:bg-muted",
                )}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        {index < questions.length - 1 ? (
          <Button onClick={() => setIndex((i) => i + 1)}>
            Next <ChevronRight />
          </Button>
        ) : (
          <Button onClick={() => setConfirm(true)} disabled={submit.pending}>
            <Send /> {submit.pending ? "Submitting…" : "Submit quiz"}
          </Button>
        )}
      </nav>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit your answers?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ve answered {answeredCount} of {questions.length} questions. You can&apos;t change your answers after submitting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep working</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                setConfirm(false);
                doSubmit();
              }}
            >
              Submit quiz
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** `quizHref` is the quiz page; the attempt opens at `?attempt=<id>`. */
export function StartQuizButton({ quizId, courseId, label, quizHref }: { quizId: string; courseId: string; label: string; quizHref: string }) {
  const router = useRouter();
  const { run, pending } = useAction(startQuizAction, { onSuccess: (d) => router.push(`${quizHref}?attempt=${d.attemptId}`) });
  return (
    <Button size="lg" disabled={pending} onClick={() => run({ quizId, courseId })}>
      {pending ? "Preparing…" : label}
    </Button>
  );
}
