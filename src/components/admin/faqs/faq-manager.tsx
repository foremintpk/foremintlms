"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Home, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
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
  keywords: string[];
  advisor_enabled: boolean;
  advisor_priority: number;
}

export function FaqFormDialog({ trigger, faq }: { trigger: React.ReactNode; faq?: FaqRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState(faq?.answer ?? "");
  const [category, setCategory] = useState<Category>(faq?.category ?? "general");
  const [published, setPublished] = useState(faq?.is_published ?? true);
  const [home, setHome] = useState(faq?.show_on_home ?? false);
  const [advisor, setAdvisor] = useState(faq?.advisor_enabled ?? true);
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
            const keywords = String(f.get("keywords") ?? "")
              .split(",")
              .map((k) => k.trim())
              .filter(Boolean);
            void run({
              id: faq?.id,
              question: String(f.get("question") ?? ""),
              answer,
              category,
              is_published: published,
              show_on_home: home,
              keywords,
              advisor_enabled: advisor,
              advisor_priority: Number(f.get("advisor_priority") ?? 0) || 0,
            });
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
            <div className="grid gap-4 rounded-xl border p-4">
              <Field orientation="horizontal">
                <Switch id="faq-advisor" checked={advisor} onCheckedChange={setAdvisor} />
                <FieldLabel htmlFor="faq-advisor">Use in the course advisor</FieldLabel>
              </Field>
              {advisor ? (
                <>
                  <Field>
                    <FieldLabel htmlFor="faq-keywords">Advisor keywords</FieldLabel>
                    <Input id="faq-keywords" name="keywords" defaultValue={faq?.keywords.join(", ")} placeholder="payment link, parent, employer, pay for me" />
                    <FieldDescription>Comma-separated words or phrases that should find this answer (up to 20). The question&apos;s own words already count.</FieldDescription>
                    <FieldError>{fieldErrors.keywords?.[0]}</FieldError>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="faq-priority">Advisor priority</FieldLabel>
                    <Input id="faq-priority" name="advisor_priority" type="number" min={0} max={10} defaultValue={faq?.advisor_priority ?? 0} className="w-28" />
                    <FieldDescription>0–10. Higher wins when two FAQs match equally well.</FieldDescription>
                    <FieldError>{fieldErrors.advisor_priority?.[0]}</FieldError>
                  </Field>
                </>
              ) : (
                <>
                  <input type="hidden" name="keywords" value={faq?.keywords.join(", ") ?? ""} />
                  <input type="hidden" name="advisor_priority" value={faq?.advisor_priority ?? 0} />
                </>
              )}
            </div>
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
          {!f.advisor_enabled ? <span className="text-xs text-muted-foreground max-sm:hidden">Not in advisor</span> : null}
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
