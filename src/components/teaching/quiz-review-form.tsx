"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { reviewQuizAttemptAction } from "@/app/teach/reviews/actions";
import { cn } from "@/lib/utils";

export interface ReviewItem {
  questionId: string;
  index: number;
  type: "single_choice" | "multiple_choice" | "true_false" | "short_answer";
  prompt: string;
  points: number;
  acceptedAnswers: string[];
  options: { id: string; label: string; isCorrect: boolean; selected: boolean }[];
  textAnswer: string | null;
  pointsAwarded: number | null;
  feedback: string | null;
  /** Written answer the instructor must (or may) score. */
  reviewable: boolean;
}

export function QuizReviewForm({ attemptId, items, alreadyGraded }: { attemptId: string; items: ReviewItem[]; alreadyGraded: boolean }) {
  const [awards, setAwards] = useState<Record<string, { points: string; feedback: string }>>(
    Object.fromEntries(
      items
        .filter((i) => i.reviewable)
        .map((i) => [i.questionId, { points: i.pointsAwarded !== null ? String(i.pointsAwarded) : "", feedback: i.feedback ?? "" }]),
    ),
  );
  const { run, pending } = useAction(reviewQuizAttemptAction);
  const missing = Object.values(awards).some((a) => a.points === "");

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run({
          attemptId,
          awards: Object.entries(awards).map(([questionId, a]) => ({
            questionId,
            points: Number(a.points),
            feedback: a.feedback.trim() || null,
          })),
        });
      }}
    >
      {items.map((item) => (
        <section key={item.questionId} className="rounded-2xl border bg-card p-5 shadow-card">
          <div className="mb-3 flex items-start justify-between gap-3">
            <p className="text-sm font-medium">
              <span className="mr-2 text-muted-foreground tabular-nums">{item.index}.</span>
              <span className="whitespace-pre-wrap">{item.prompt}</span>
            </p>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {item.reviewable ? `${item.points} pt${item.points === 1 ? "" : "s"}` : `${item.pointsAwarded ?? 0} / ${item.points}`}
            </span>
          </div>

          {item.type === "short_answer" ? (
            <div className="grid gap-3">
              <div className="rounded-xl bg-muted/40 p-3 text-sm whitespace-pre-wrap">{item.textAnswer?.trim() || <span className="text-muted-foreground">No answer</span>}</div>
              {item.acceptedAnswers.length ? (
                <p className="text-xs text-muted-foreground">Reference answers: {item.acceptedAnswers.join(" · ")}</p>
              ) : null}
              {item.reviewable ? (
                <div className="grid gap-2 sm:grid-cols-[auto_1fr] sm:items-start">
                  <label className="flex items-center gap-2 text-sm">
                    Points
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={item.points}
                      step="0.5"
                      className="w-20"
                      required
                      value={awards[item.questionId]?.points ?? ""}
                      onChange={(e) => setAwards((s) => ({ ...s, [item.questionId]: { ...s[item.questionId], points: e.target.value } }))}
                    />
                    <span className="text-muted-foreground">/ {item.points}</span>
                  </label>
                  <Textarea
                    rows={2}
                    maxLength={4000}
                    placeholder="Feedback on this answer (optional)"
                    aria-label="Feedback on this answer"
                    value={awards[item.questionId]?.feedback ?? ""}
                    onChange={(e) => setAwards((s) => ({ ...s, [item.questionId]: { ...s[item.questionId], feedback: e.target.value } }))}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <ul className="grid gap-1.5">
              {item.options.map((o) => (
                <li
                  key={o.id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                    o.selected && o.isCorrect && "border-success/40 bg-success-soft",
                    o.selected && !o.isCorrect && "border-destructive/30 bg-destructive/5",
                  )}
                >
                  {o.isCorrect ? <Check className="size-4 text-success" aria-label="Correct option" /> : <X className="size-4 text-muted-foreground/50" aria-hidden />}
                  <span className="flex-1">{o.label}</span>
                  {o.selected ? <span className="text-xs text-muted-foreground">Student&apos;s choice</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <div className="sticky bottom-20 z-10 flex items-center justify-between gap-3 rounded-2xl border bg-background/95 p-4 shadow-raised backdrop-blur md:bottom-4">
        <p className="text-sm text-muted-foreground">
          {missing ? "Score every written answer to finish the review." : alreadyGraded ? "Saving updates the student's result." : "Ready to finish."}
        </p>
        <Button type="submit" disabled={pending || missing}>
          {pending ? "Saving…" : alreadyGraded ? "Update review" : "Finish review"}
        </Button>
      </div>
    </form>
  );
}
