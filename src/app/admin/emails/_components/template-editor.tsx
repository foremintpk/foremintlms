"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/auth/form-bits";
import { useAction } from "@/hooks/use-action";
import { previewEmailTemplateAction, saveEmailTemplateAction, sendTestEmailAction } from "../actions";

export interface EditableTemplate {
  key: string;
  subject: string;
  preheader: string;
  heading: string;
  body: string;
  ctaLabel: string;
  isEnabled: boolean;
  isRequired: boolean;
}

export function TemplateEditor({
  initial,
  variables,
}: {
  initial: EditableTemplate;
  variables: { name: string; description: string }[];
}) {
  const [draft, setDraft] = useState(initial);
  const [preview, setPreview] = useState<{ subject: string; html: string; text: string } | null>(null);
  const [view, setView] = useState<"html" | "text">("html");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const set = <K extends keyof EditableTemplate>(key: K, value: EditableTemplate[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const save = useAction(saveEmailTemplateAction);
  const previewAction = useAction(previewEmailTemplateAction, { silent: true, onSuccess: setPreview });
  const test = useAction(sendTestEmailAction);
  // `run` changes identity every render; keep the latest in a ref so the
  // debounced preview effect only re-runs when the draft changes.
  const runPreviewRef = useRef(previewAction.run);
  useEffect(() => {
    runPreviewRef.current = previewAction.run;
  });

  const payload = useCallback(
    (d: EditableTemplate) => ({
      key: d.key,
      subject: d.subject,
      preheader: d.preheader,
      heading: d.heading,
      body: d.body,
      ctaLabel: d.ctaLabel,
      isEnabled: d.isEnabled,
    }),
    [],
  );

  // Debounced live preview rendered by the same server code that sends email.
  useEffect(() => {
    const t = setTimeout(() => {
      if (draft.subject && draft.heading && draft.body) void runPreviewRef.current(payload(draft));
    }, 450);
    return () => clearTimeout(t);
  }, [draft, payload]);

  const insertVariable = (name: string) => {
    const el = bodyRef.current;
    const token = `{{${name}}}`;
    if (!el) {
      set("body", `${draft.body}${token}`);
      return;
    }
    const start = el.selectionStart ?? draft.body.length;
    const end = el.selectionEnd ?? draft.body.length;
    const next = draft.body.slice(0, start) + token + draft.body.slice(end);
    set("body", next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const dirty = JSON.stringify(payload(draft)) !== JSON.stringify(payload(initial));
  const errors = save.fieldErrors;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <form
        className="grid content-start gap-5 rounded-2xl border bg-card p-5 shadow-card sm:p-6"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save.run(payload(draft));
        }}
      >
        <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Send this email</p>
            <p className="text-xs text-muted-foreground">
              {draft.isRequired ? "Security and account emails are always sent." : "When off, this email is skipped for everyone."}
            </p>
          </div>
          <Switch checked={draft.isEnabled} disabled={draft.isRequired} onCheckedChange={(v) => set("isEnabled", v)} aria-label="Send this email" />
        </div>

        <FormField label="Subject" htmlFor="subject" error={errors.subject}>
          <Input id="subject" value={draft.subject} onChange={(e) => set("subject", e.target.value)} maxLength={200} />
        </FormField>
        <FormField label="Preview text" htmlFor="preheader" description="Shown after the subject in most inboxes." error={errors.preheader}>
          <Input id="preheader" value={draft.preheader} onChange={(e) => set("preheader", e.target.value)} maxLength={200} />
        </FormField>
        <FormField label="Heading" htmlFor="heading" error={errors.heading}>
          <Input id="heading" value={draft.heading} onChange={(e) => set("heading", e.target.value)} maxLength={200} />
        </FormField>
        <FormField label="Email text" htmlFor="body" description="Plain text. Leave a blank line between paragraphs. Wrap a line in quotes to show it as a quote." error={errors.body}>
          <Textarea id="body" ref={bodyRef} value={draft.body} onChange={(e) => set("body", e.target.value)} rows={10} maxLength={6000} className="font-mono text-sm" />
        </FormField>
        <div className="grid gap-2">
          <p className="text-sm font-medium">Insert a variable</p>
          <div className="flex flex-wrap gap-1.5">
            {variables.map((v) => (
              <button
                key={v.name}
                type="button"
                title={v.description}
                onClick={() => insertVariable(v.name)}
                className="rounded-md border bg-background px-2 py-1 font-mono text-xs transition-colors hover:border-primary/40 hover:bg-brand-soft"
              >
                {`{{${v.name}}}`}
              </button>
            ))}
          </div>
        </div>
        <FormField label="Button label" htmlFor="ctaLabel" description="Shown when the email includes a link. Leave empty for no button." error={errors.ctaLabel}>
          <Input id="ctaLabel" value={draft.ctaLabel} onChange={(e) => set("ctaLabel", e.target.value)} maxLength={60} />
        </FormField>

        <div className="flex flex-wrap items-center gap-2 border-t pt-5">
          <Button type="submit" disabled={save.pending || !dirty} className="h-10">
            {save.pending ? (
              <>
                <Spinner className="size-4" /> Saving…
              </>
            ) : (
              "Save template"
            )}
          </Button>
          <Button type="button" variant="outline" className="h-10" disabled={test.pending || dirty} onClick={() => test.run({ key: draft.key })} title={dirty ? "Save first — tests use the saved version" : undefined}>
            {test.pending ? <Spinner className="size-4" /> : <Send className="size-4" />} Send test to me
          </Button>
          {dirty ? <span className="text-xs text-muted-foreground">Unsaved changes</span> : null}
        </div>
      </form>

      <section className="grid content-start gap-3" aria-label="Preview">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Subject</p>
            <p className="truncate text-sm font-medium">{preview?.subject ?? "—"}</p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border p-0.5">
            {(["html", "text"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${view === v ? "bg-muted text-foreground" : "text-muted-foreground"}`}
              >
                {v === "html" ? "Email" : "Plain text"}
              </button>
            ))}
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl border bg-[#f4f3fa]">
          {previewAction.pending ? <Spinner className="absolute top-3 right-3 size-4 text-muted-foreground" /> : null}
          {preview ? (
            view === "html" ? (
              <iframe title="Email preview" srcDoc={preview.html} sandbox="" className="h-[640px] w-full bg-white" />
            ) : (
              <div className="relative">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-2 right-2"
                  aria-label="Copy plain text"
                  onClick={() => void navigator.clipboard.writeText(preview.text).then(() => toast.success("Copied"))}
                >
                  <Copy className="size-4" />
                </Button>
                <pre className="h-[640px] overflow-auto bg-white p-5 font-mono text-xs leading-relaxed whitespace-pre-wrap">{preview.text}</pre>
              </div>
            )
          ) : (
            <p className="p-6 text-sm text-muted-foreground">{previewAction.error ?? "Preparing preview…"}</p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Preview uses sample data. Variables without a value show in [brackets].</p>
      </section>
    </div>
  );
}
