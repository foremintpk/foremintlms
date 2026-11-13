"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClipboardList, Library, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmAction } from "@/components/common/confirm-action";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { useAction } from "@/hooks/use-action";
import { createQuiz, deleteQuestionBank, deleteQuiz, saveQuestionBank } from "@/lib/services/courses/actions/quizzes";
import type { BankListItem, QuizListItem } from "@/lib/services/courses/authoring";
import { FormRow } from "./form-bits";

function CreateQuizDialog({ courseId, courseBase, onClose }: { courseId: string; courseBase: string; onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const create = useAction(createQuiz, { onSuccess: (d) => router.push(`${courseBase}/quizzes/${d.id}`) });
  return (
    <Dialog open onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void create.run({ courseId, title });
          }}
        >
          <DialogHeader>
            <DialogTitle>New quiz</DialogTitle>
            <DialogDescription>You’ll add questions and settings next.</DialogDescription>
          </DialogHeader>
          <FormRow label="Quiz title">
            <Input value={title} maxLength={200} autoFocus onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Product research check" />
          </FormRow>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || create.pending}>
              {create.pending ? <Loader2 className="animate-spin" /> : null}
              Create quiz
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BankDialog({ courseId, bank, onClose }: { courseId: string; bank: BankListItem | null; onClose: () => void }) {
  const [title, setTitle] = useState(bank?.title ?? "");
  const [description, setDescription] = useState(bank?.description ?? "");
  const save = useAction(saveQuestionBank, { onSuccess: onClose });
  return (
    <Dialog open onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void save.run({ courseId, bankId: bank?.id, title, description: description || null });
          }}
        >
          <DialogHeader>
            <DialogTitle>{bank ? "Rename question bank" : "New question bank"}</DialogTitle>
            <DialogDescription>Banks hold reusable questions. Quizzes can copy them or draw a random set per attempt.</DialogDescription>
          </DialogHeader>
          <FormRow label="Name">
            <Input value={title} maxLength={200} autoFocus onChange={(e) => setTitle(e.target.value)} />
          </FormRow>
          <FormRow label="Description" optional>
            <Textarea rows={2} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormRow>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || save.pending}>
              {save.pending ? <Loader2 className="animate-spin" /> : null}
              {bank ? "Save bank" : "Create bank"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function QuizOverview({
  courseId,
  courseBase,
  quizzes,
  banks,
  canEdit,
}: {
  courseId: string;
  courseBase: string;
  quizzes: QuizListItem[];
  banks: BankListItem[];
  canEdit: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [bankDialog, setBankDialog] = useState<{ open: boolean; bank: BankListItem | null }>({ open: false, bank: null });

  return (
    <div className="grid gap-8">
      <section className="grid gap-4" aria-labelledby="quizzes-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="quizzes-heading" className="text-base font-semibold">
              Quizzes
            </h2>
            <p className="text-sm text-muted-foreground">Add a quiz to a lesson with a Quiz block.</p>
          </div>
          {canEdit ? (
            <Button onClick={() => setCreating(true)}>
              <Plus /> New quiz
            </Button>
          ) : null}
        </div>
        {quizzes.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No quizzes yet" description="Quizzes check understanding and can gate lessons and certificates." />
        ) : (
          <ul className="grid gap-2">
            {quizzes.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`${courseBase}/quizzes/${q.id}`} className="font-medium hover:text-primary">
                    {q.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {q.uses_bank ? `${q.question_count} random questions per attempt` : `${q.question_count} question${q.question_count === 1 ? "" : "s"}`} · pass at{" "}
                    {q.passing_score}%{q.lesson_title ? ` · ${q.lesson_title}` : ""} · {q.attempt_count} attempt{q.attempt_count === 1 ? "" : "s"}
                  </p>
                </div>
                <StatusBadge status={q.status} />
                <Button asChild variant="ghost" size="sm">
                  <Link href={`${courseBase}/quizzes/${q.id}`}>
                    <Pencil /> {canEdit ? "Edit" : "View"}
                  </Link>
                </Button>
                {canEdit ? (
                  <ConfirmAction
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label={`Delete ${q.title}`} className="text-muted-foreground hover:text-destructive">
                        <Trash2 />
                      </Button>
                    }
                    title={`Delete “${q.title}”?`}
                    description={q.attempt_count ? "Students have taken this quiz, so it will be archived and their results kept." : "The quiz and its questions are deleted."}
                    confirmLabel={q.attempt_count ? "Archive quiz" : "Delete quiz"}
                    destructive
                    action={() => deleteQuiz({ courseId, quizId: q.id })}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4" aria-labelledby="banks-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="banks-heading" className="text-base font-semibold">
              Question banks
            </h2>
            <p className="text-sm text-muted-foreground">Reusable question pools for this course.</p>
          </div>
          {canEdit ? (
            <Button variant="outline" onClick={() => setBankDialog({ open: true, bank: null })}>
              <Library /> New bank
            </Button>
          ) : null}
        </div>
        {banks.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">No question banks yet.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {banks.map((b) => (
              <li key={b.id} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`${courseBase}/quizzes/banks/${b.id}`} className="font-medium hover:text-primary">
                    {b.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {b.question_count} question{b.question_count === 1 ? "" : "s"}
                  </p>
                </div>
                {canEdit ? (
                  <>
                    <Button variant="ghost" size="icon-sm" aria-label={`Rename ${b.title}`} onClick={() => setBankDialog({ open: true, bank: b })}>
                      <Pencil />
                    </Button>
                    <ConfirmAction
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${b.title}`} className="text-muted-foreground hover:text-destructive">
                          <Trash2 />
                        </Button>
                      }
                      title={`Delete “${b.title}”?`}
                      description="Its questions are deleted. Questions already copied into quizzes stay."
                      confirmLabel="Delete bank"
                      destructive
                      action={() => deleteQuestionBank({ courseId, bankId: b.id })}
                    />
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {creating ? <CreateQuizDialog courseId={courseId} courseBase={courseBase} onClose={() => setCreating(false)} /> : null}
      {bankDialog.open ? (
        <BankDialog key={bankDialog.bank?.id ?? "new"} courseId={courseId} bank={bankDialog.bank} onClose={() => setBankDialog({ open: false, bank: null })} />
      ) : null}
    </div>
  );
}
