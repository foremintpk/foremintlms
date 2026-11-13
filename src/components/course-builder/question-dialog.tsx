"use client";

import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { saveQuestion } from "@/lib/services/courses/actions/quizzes";
import type { QuestionWithOptions } from "@/lib/services/courses/authoring";
import { FormRow, ListEditor, NumberField, SwitchRow, fieldError } from "./form-bits";

type QType = QuestionWithOptions["question_type"];
interface DraftOption {
  key: string;
  id?: string;
  label: string;
  is_correct: boolean;
}

export const QUESTION_TYPE_LABELS: Record<QType, string> = {
  single_choice: "Single choice",
  multiple_choice: "Multiple choice",
  true_false: "True or false",
  short_answer: "Short answer",
};

let keySeq = 0;
const newKey = () => `opt-${++keySeq}`;

function initialOptions(question: QuestionWithOptions | null, type: QType): DraftOption[] {
  if (question?.options.length) return question.options.map((o) => ({ key: o.id, id: o.id, label: o.label, is_correct: o.is_correct }));
  if (type === "true_false")
    return [
      { key: newKey(), label: "True", is_correct: true },
      { key: newKey(), label: "False", is_correct: false },
    ];
  return [
    { key: newKey(), label: "", is_correct: true },
    { key: newKey(), label: "", is_correct: false },
  ];
}

export function QuestionDialog({
  courseId,
  quizId,
  bankId,
  question,
  onClose,
}: {
  courseId: string;
  quizId?: string;
  bankId?: string;
  question: QuestionWithOptions | null;
  onClose: () => void;
}) {
  const [type, setType] = useState<QType>(question?.question_type ?? "single_choice");
  const [prompt, setPrompt] = useState(question?.prompt ?? "");
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [points, setPoints] = useState<number | null>(question?.points ?? 1);
  const [options, setOptions] = useState<DraftOption[]>(() => initialOptions(question, question?.question_type ?? "single_choice"));
  const [accepted, setAccepted] = useState<string[]>(question?.accepted_answers ?? []);
  const [caseSensitive, setCaseSensitive] = useState(question?.case_sensitive ?? false);
  const [manual, setManual] = useState(question?.requires_manual_review ?? false);
  const save = useAction(saveQuestion, { onSuccess: onClose });

  const changeType = (t: QType) => {
    setType(t);
    if (t === "true_false") {
      setOptions([
        { key: newKey(), id: options[0]?.id, label: "True", is_correct: true },
        { key: newKey(), id: options[1]?.id, label: "False", is_correct: false },
      ]);
    } else if (t === "single_choice") {
      const firstCorrect = options.findIndex((o) => o.is_correct);
      setOptions(options.map((o, i) => ({ ...o, is_correct: i === (firstCorrect < 0 ? 0 : firstCorrect) })));
    }
  };

  const singleCorrect = options.find((o) => o.is_correct)?.key ?? "";

  return (
    <Dialog open onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <form
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void save.run({
              courseId,
              questionId: question?.id,
              quizId: quizId ?? null,
              bankId: bankId ?? null,
              question_type: type,
              prompt,
              explanation: explanation || null,
              points: points ?? 1,
              accepted_answers: accepted,
              case_sensitive: caseSensitive,
              requires_manual_review: manual,
              options: type === "short_answer" ? [] : options.map((o) => ({ id: o.id, label: o.label, is_correct: o.is_correct })),
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{question ? "Edit question" : "Add a question"}</DialogTitle>
            <DialogDescription>Correct answers are never sent to students’ browsers before they submit.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
            <FormRow label="Question type">
              <Select value={type} onValueChange={(v) => changeType(v as QType)}>
                <SelectTrigger className="w-full" aria-label="Question type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormRow>
            <FormRow label="Points" error={fieldError(save.fieldErrors, "points")}>
              <NumberField value={points} onChange={setPoints} min={0.5} max={1000} step={0.5} />
            </FormRow>
          </div>
          <FormRow label="Question" error={fieldError(save.fieldErrors, "prompt")}>
            <Textarea rows={3} maxLength={4000} value={prompt} autoFocus onChange={(e) => setPrompt(e.target.value)} />
          </FormRow>

          {type === "short_answer" ? (
            <div className="grid gap-4">
              <SwitchRow
                label="Review answers manually"
                description="An instructor grades each answer. Otherwise answers are matched against the accepted list."
                checked={manual}
                onCheckedChange={setManual}
              />
              {!manual ? (
                <>
                  <FormRow label="Accepted answers" error={fieldError(save.fieldErrors, "accepted_answers")} hint="Extra spaces are ignored.">
                    <ListEditor ariaLabel="Accepted answer" value={accepted} onChange={setAccepted} max={30} maxLength={300} addLabel="Add answer" placeholder="e.g. Fulfilled by Amazon" />
                  </FormRow>
                  <SwitchRow label="Match capital letters exactly" checked={caseSensitive} onCheckedChange={setCaseSensitive} />
                </>
              ) : null}
            </div>
          ) : (
            <FormRow
              label={type === "multiple_choice" ? "Options — tick every correct one" : "Options — choose the correct one"}
              error={fieldError(save.fieldErrors, "options")}
            >
              {type === "multiple_choice" ? (
                <ul className="grid gap-2">
                  {options.map((o, i) => (
                    <li key={o.key} className="flex items-center gap-2">
                      <Checkbox
                        checked={o.is_correct}
                        aria-label={`Option ${i + 1} is correct`}
                        onCheckedChange={(v) => setOptions((list) => list.map((x) => (x.key === o.key ? { ...x, is_correct: v === true } : x)))}
                      />
                      <Input
                        value={o.label}
                        maxLength={1000}
                        placeholder={`Option ${i + 1}`}
                        aria-label={`Option ${i + 1}`}
                        onChange={(e) => setOptions((list) => list.map((x) => (x.key === o.key ? { ...x, label: e.target.value } : x)))}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove option ${i + 1}`}
                        disabled={options.length <= 2}
                        onClick={() => setOptions((list) => list.filter((x) => x.key !== o.key))}
                      >
                        <X />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <RadioGroup
                  value={singleCorrect}
                  onValueChange={(key) => setOptions((list) => list.map((x) => ({ ...x, is_correct: x.key === key })))}
                  className="grid gap-2"
                >
                  {options.map((o, i) => (
                    <div key={o.key} className="flex items-center gap-2">
                      <RadioGroupItem value={o.key} aria-label={`Option ${i + 1} is correct`} />
                      <Input
                        value={o.label}
                        maxLength={1000}
                        placeholder={`Option ${i + 1}`}
                        aria-label={`Option ${i + 1}`}
                        readOnly={type === "true_false"}
                        onChange={(e) => setOptions((list) => list.map((x) => (x.key === o.key ? { ...x, label: e.target.value } : x)))}
                      />
                      {type !== "true_false" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove option ${i + 1}`}
                          disabled={options.length <= 2}
                          onClick={() =>
                            setOptions((list) => {
                              const next = list.filter((x) => x.key !== o.key);
                              if (!next.some((x) => x.is_correct)) next[0] = { ...next[0], is_correct: true };
                              return next;
                            })
                          }
                        >
                          <X />
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </RadioGroup>
              )}
              {type !== "true_false" && options.length < 12 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 w-fit"
                  onClick={() => setOptions((list) => [...list, { key: newKey(), label: "", is_correct: false }])}
                >
                  <Plus /> Add option
                </Button>
              ) : null}
            </FormRow>
          )}

          <FormRow label="Explanation" optional hint="Shown after submitting, when answers are revealed.">
            <Textarea rows={2} maxLength={4000} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
          </FormRow>
          {save.error && !Object.keys(save.fieldErrors).length ? <p className="text-sm text-destructive">{save.error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.pending || !prompt.trim()}>
              {save.pending ? <Loader2 className="animate-spin" /> : null}
              {question ? "Save question" : "Add question"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
