"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { addSubmissionCommentAction, gradeSubmissionAction, startReviewAction } from "@/app/teach/reviews/actions";
import type { RubricCriterion } from "@/lib/services/grading-rules";

export function GradingForm({
  submissionId,
  status,
  maxPoints,
  passingPoints,
  rubric,
  initialPoints,
  initialRubric,
  isLate,
  latePenaltyPercent,
}: {
  submissionId: string;
  status: string;
  maxPoints: number;
  passingPoints: number | null;
  rubric: RubricCriterion[];
  initialPoints: number | null;
  initialRubric: Record<string, number>;
  isLate: boolean;
  latePenaltyPercent: number;
}) {
  const [scores, setScores] = useState<Record<string, string>>(
    Object.fromEntries(rubric.map((c) => [c.id, initialRubric[c.id] !== undefined ? String(initialRubric[c.id]) : ""])),
  );
  // Rubric total only once every criterion has a score.
  const rubricTotal = useMemo(() => {
    if (!rubric.length) return null;
    let total = 0;
    for (const c of rubric) {
      const raw = scores[c.id];
      if (raw === undefined || raw === "") return null;
      const n = Number(raw);
      if (!Number.isFinite(n)) return null;
      total += n;
    }
    return Math.round(total * 100) / 100;
  }, [rubric, scores]);
  const [points, setPoints] = useState(initialPoints !== null ? String(initialPoints) : "");
  const [feedback, setFeedback] = useState("");
  const [comment, setComment] = useState("");
  const grade = useAction(gradeSubmissionAction, { onSuccess: () => setFeedback("") });
  const commentAction = useAction(addSubmissionCommentAction, { onSuccess: () => setComment("") });
  const start = useAction(startReviewAction);

  const effectivePoints = points !== "" ? Number(points) : rubricTotal;
  const penalty = isLate && latePenaltyPercent > 0 ? latePenaltyPercent : 0;
  const finalPreview = effectivePoints !== null && Number.isFinite(effectivePoints) ? Math.round(effectivePoints * (1 - penalty / 100) * 100) / 100 : null;

  const submit = (decision: "approve" | "grade" | "request_resubmission") =>
    void grade.run({
      submissionId,
      decision,
      points: points !== "" ? Number(points) : null,
      rubricScores: Object.fromEntries(
        Object.entries(scores)
          .filter(([, v]) => v !== "")
          .map(([k, v]) => [k, Number(v)]),
      ),
      feedback: feedback.trim() || null,
    });

  return (
    <div className="grid gap-5">
      {status === "submitted" ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/40 px-4 py-3 text-sm">
          <span>Let the student know you&apos;ve started reviewing.</span>
          <Button size="sm" variant="outline" disabled={start.pending} onClick={() => void start.run({ submissionId })}>
            {start.pending ? "Updating…" : "Mark as in review"}
          </Button>
        </div>
      ) : null}

      {rubric.length ? (
        <fieldset className="grid gap-3">
          <legend className="mb-1 text-sm font-medium">Rubric</legend>
          {rubric.map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-4 rounded-xl border bg-card p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{c.criterion}</p>
                {c.description ? <p className="text-xs text-muted-foreground">{c.description}</p> : null}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={c.points}
                  step="0.5"
                  className="w-20"
                  aria-label={`Score for ${c.criterion}`}
                  value={scores[c.id] ?? ""}
                  onChange={(e) => setScores((s) => ({ ...s, [c.id]: e.target.value }))}
                />
                <span className="text-sm text-muted-foreground tabular-nums">/ {c.points}</span>
              </div>
            </div>
          ))}
        </fieldset>
      ) : null}

      <Field>
        <FieldLabel htmlFor="grade-points">Points</FieldLabel>
        <div className="flex items-center gap-2">
          <Input
            id="grade-points"
            type="number"
            inputMode="decimal"
            min={0}
            max={maxPoints}
            step="0.5"
            className="w-28"
            placeholder={rubricTotal !== null ? String(rubricTotal) : ""}
            value={points}
            onChange={(e) => setPoints(e.target.value)}
          />
          <span className="text-sm text-muted-foreground tabular-nums">/ {maxPoints}</span>
        </div>
        <FieldDescription>
          {rubric.length ? "Leave empty to use the rubric total. " : ""}
          {passingPoints !== null ? `Pass mark: ${passingPoints}. ` : ""}
          {penalty ? `Submitted late — a ${penalty}% penalty applies${finalPreview !== null ? ` (final ${finalPreview})` : ""}.` : ""}
        </FieldDescription>
      </Field>

      <Field>
        <FieldLabel htmlFor="grade-feedback">Feedback for the student</FieldLabel>
        <Textarea
          id="grade-feedback"
          rows={5}
          maxLength={20000}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="What worked, what to improve, and any next steps"
        />
        <FieldDescription>Required when you request a resubmission. The student is notified by email.</FieldDescription>
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button disabled={grade.pending} onClick={() => submit("approve")}>
          {grade.pending ? "Saving…" : "Approve"}
        </Button>
        <Button variant="secondary" disabled={grade.pending || effectivePoints === null} onClick={() => submit("grade")}>
          Save grade
        </Button>
        <Button variant="outline" disabled={grade.pending || !feedback.trim()} onClick={() => submit("request_resubmission")}>
          Request resubmission
        </Button>
      </div>

      <div className="grid gap-2 border-t pt-5">
        <FieldLabel htmlFor="grade-comment">Comment without changing the grade</FieldLabel>
        <Textarea id="grade-comment" rows={3} maxLength={20000} value={comment} onChange={(e) => setComment(e.target.value)} />
        <div>
          <Button size="sm" variant="outline" disabled={commentAction.pending || !comment.trim()} onClick={() => void commentAction.run({ submissionId, body: comment })}>
            {commentAction.pending ? "Sending…" : "Send comment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
