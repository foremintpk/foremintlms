"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Home, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RichTextEditor } from "@/components/common/rich-text-editor";
import { StatusBadge, humanizeStatus } from "@/components/common/status-badge";
import { ConfirmAction } from "@/components/common/confirm-action";
import { SortableList } from "@/components/admin/sortable-list";
import { useAction } from "@/hooks/use-action";
import { deleteFaq, reorderFaqs, saveFaq } from "@/app/admin/faqs/actions";

const CATEGORIES = ["general", "courses", "billing", "certificates", "live", "technical", "instructors"] as const;
type Category = (typeof CATEGORIES)[number];

export interface FaqRow {
  id: string;
  question: string;
  answer: string;
  category: Category;
  sort_order: number;
  is_published: boolean;
  show_on_home: boolean;
}

export function FaqFormDialog({ trigger, faq }: { trigger: React.ReactNode; faq?: FaqRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState(faq?.answer ?? "");
  const [category, setCategory] = useState<Category>(faq?.category ?? "general");
  const [published, setPublished] = useState(faq?.is_published ?? true);
  const [home, setHome] = useState(faq?.show_on_home ?? false);
  const { run, pending, fieldErrors } = useAction(saveFaq, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{faq ? "Edit FAQ" : "New FAQ"}</DialogTitle>
          <DialogDescription>Keep answers short and specific; link to policies where relevant.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run({ id: faq?.id, question: String(f.get("question") ?? ""), answer, category, is_published: published, show_on_home: home });
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="faq-q">Question</FieldLabel>
              <Input id="faq-q" name="question" defaultValue={faq?.question} required maxLength={400} />
              <FieldError>{fieldErrors.question?.[0]}</FieldError>
            </Field>
            <Field>
              <FieldLabel>Answer</FieldLabel>
              <RichTextEditor value={answer} onChange={setAnswer} minHeight={160} ariaLabel="Answer" />
              <FieldError>{fieldErrors.answer?.[0]}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="faq-cat">Category</FieldLabel>
              <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                <SelectTrigger id="faq-cat" className="w-full sm:w-60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {humanizeStatus(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field orientation="horizontal">
              <Switch id="faq-pub" checked={published} onCheckedChange={setPublished} />
              <FieldLabel htmlFor="faq-pub">Published</FieldLabel>
            </Field>
            <Field orientation="horizontal">
              <Switch id="faq-home" checked={home} onCheckedChange={setHome} />
              <FieldLabel htmlFor="faq-home">Show on the home page</FieldLabel>
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : faq ? "Save FAQ" : "Add FAQ"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FaqGroup({ items }: { items: FaqRow[] }) {
  const router = useRouter();
  const reorder = useAction(reorderFaqs, { onSuccess: () => router.refresh(), silent: false });
  return (
    <SortableList
      items={items}
      disabled={reorder.pending}
      onReorder={(ids) => void reorder.run({ ids })}
      renderItem={(f) => (
        <div className="flex items-center gap-3">
          <p className="min-w-0 flex-1 truncate text-sm font-medium">{f.question}</p>
          {f.show_on_home ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground max-sm:hidden">
              <Home className="size-3.5" /> Home
            </span>
          ) : null}
          <StatusBadge status={f.is_published ? "published" : "draft"} />
          <FaqFormDialog
            faq={f}
            trigger={
              <Button size="icon-sm" variant="ghost" aria-label={`Edit: ${f.question}`}>
                <Pencil />
              </Button>
            }
          />
          <ConfirmAction
            trigger={
              <Button size="icon-sm" variant="ghost" aria-label={`Delete: ${f.question}`}>
                <Trash2 />
              </Button>
            }
            title="Delete this FAQ?"
            description={f.question}
            confirmLabel="Delete FAQ"
            destructive
            action={() => deleteFaq({ id: f.id })}
            onDone={() => router.refresh()}
          />
        </div>
      )}
    />
  );
}
