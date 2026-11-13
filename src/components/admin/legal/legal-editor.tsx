"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, FilePlus2, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RichTextEditor } from "@/components/common/rich-text-editor";
import { StatusBadge } from "@/components/common/status-badge";
import { ConfirmAction } from "@/components/common/confirm-action";
import { EmptyState } from "@/components/common/empty-state";
import { useAction } from "@/hooks/use-action";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createLegalDraft, deleteLegalDraft, previewLegal, publishLegalVersion, saveLegalDraft } from "@/app/admin/legal/actions";

export interface LegalVersionRow {
  id: string;
  version: number;
  status: "draft" | "published" | "superseded";
  body: string;
  change_summary: string | null;
  effective_date: string;
  published_at: string | null;
  created_at: string;
}

const PLACEHOLDER_HELP = "{{entity_name}}, {{business_address}}, {{support_email}}, {{jurisdiction}}, {{site_url}}, {{registration_number}}";

function DraftEditor({ draft }: { draft: LegalVersionRow }) {
  const router = useRouter();
  const [body, setBody] = useState(draft.body);
  const [summary, setSummary] = useState(draft.change_summary ?? "");
  const [effective, setEffective] = useState(draft.effective_date);
  const [preview, setPreview] = useState<{ html: string; missing: string[] } | null>(null);
  const save = useAction(saveLegalDraft, { onSuccess: () => router.refresh() });
  const prev = useAction(previewLegal, { silent: true, onSuccess: (d) => setPreview(d) });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Draft version {draft.version} <StatusBadge status="draft" />
        </CardTitle>
        <CardDescription>Publishing replaces the live version; earlier versions stay available as history.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="edit" onValueChange={(v) => v === "preview" && void prev.run({ body })}>
          <TabsList>
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="preview">
              <Eye /> Preview
            </TabsTrigger>
          </TabsList>
          <TabsContent value="edit" className="mt-4">
            <FieldGroup>
              <Field>
                <FieldLabel>Document</FieldLabel>
                <FieldDescription>Placeholders are filled from settings when the page is shown: {PLACEHOLDER_HELP}</FieldDescription>
                <RichTextEditor value={body} onChange={setBody} minHeight={480} ariaLabel="Legal document" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
                <Field>
                  <FieldLabel htmlFor="legal-summary">What changed</FieldLabel>
                  <Textarea id="legal-summary" rows={2} maxLength={1000} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Short summary shown in the version history" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="legal-effective">Effective date</FieldLabel>
                  <Input id="legal-effective" type="date" value={effective} onChange={(e) => setEffective(e.target.value)} required />
                  <FieldError>{save.fieldErrors.effective_date?.[0]}</FieldError>
                </Field>
              </div>
            </FieldGroup>
          </TabsContent>
          <TabsContent value="preview" className="mt-4">
            {prev.pending || !preview ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Preparing preview…</p>
            ) : (
              <>
                {preview.missing.length ? (
                  <p className="mb-4 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
                    Not filled yet: {preview.missing.map((m) => m.replace(/_/g, " ")).join(", ")}.{" "}
                    <Link href="/admin/settings#legal" className="font-semibold underline underline-offset-4">
                      Add them in settings
                    </Link>
                  </p>
                ) : null}
                <div className="prose-foremint max-w-none rounded-xl border bg-background p-6" dangerouslySetInnerHTML={{ __html: preview.html }} />
              </>
            )}
          </TabsContent>
        </Tabs>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <ConfirmAction
            trigger={
              <Button variant="ghost" className="text-destructive">
                <Trash2 /> Delete draft
              </Button>
            }
            title="Delete this draft?"
            description="The published version stays live."
            confirmLabel="Delete draft"
            destructive
            action={() => deleteLegalDraft({ versionId: draft.id })}
            onDone={() => router.refresh()}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={save.pending}
              onClick={() => void save.run({ versionId: draft.id, body, change_summary: summary, effective_date: effective })}
            >
              {save.pending ? "Saving…" : "Save draft"}
            </Button>
            <ConfirmAction
              trigger={
                <Button>
                  <Send /> Publish version {draft.version}
                </Button>
              }
              title={`Publish version ${draft.version}?`}
              description="Save the draft first — publishing uses the last saved text. The current live version will be marked as superseded. Make sure a lawyer has reviewed this text."
              confirmLabel="Publish"
              action={() => publishLegalVersion({ versionId: draft.id })}
              onDone={() => router.refresh()}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function LegalEditor({ documentId, documentSlug, versions, viewed }: {
  documentId: string;
  documentSlug: string;
  versions: LegalVersionRow[];
  viewed: { id: string; version: number; html: string; missing: string[] } | null;
}) {
  const router = useRouter();
  const draft = versions.find((v) => v.status === "draft");
  const create = useAction(createLegalDraft, { onSuccess: () => router.refresh() });

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid gap-6">
        {draft ? (
          <DraftEditor key={draft.id} draft={draft} />
        ) : (
          <Card>
            <CardContent className="flex flex-col items-start gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">To change this document, start a new draft from the live version.</p>
              <Button onClick={() => void create.run({ documentId })} disabled={create.pending}>
                <FilePlus2 /> {create.pending ? "Creating…" : "Start a new draft"}
              </Button>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>{viewed ? `Version ${viewed.version} as published` : "Published version"}</CardTitle>
            <CardDescription>
              Exactly how visitors see it at{" "}
              <Link href={`/legal/${documentSlug}`} target="_blank" className="text-primary hover:underline">
                /legal/{documentSlug}
              </Link>
              .
            </CardDescription>
          </CardHeader>
          <CardContent>
            {viewed ? (
              <>
                {viewed.missing.length ? (
                  <p className="mb-4 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
                    Placeholders without a value: {viewed.missing.map((m) => m.replace(/_/g, " ")).join(", ")}.
                  </p>
                ) : null}
                <div className="prose-foremint max-w-none" dangerouslySetInnerHTML={{ __html: viewed.html }} />
              </>
            ) : (
              <EmptyState title="Nothing published yet" description="Publish a draft to make this page live." className="py-8" />
            )}
          </CardContent>
        </Card>
      </div>
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Version history</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-2">
            {versions.map((v) => (
              <li key={v.id}>
                <Link
                  href={v.status === "draft" ? "#" : `/admin/legal/${documentSlug}?version=${v.id}`}
                  aria-disabled={v.status === "draft"}
                  className={cn(
                    "block rounded-xl border px-3 py-2 text-sm transition-colors hover:bg-muted",
                    viewed?.id === v.id && "border-primary/40 bg-brand-soft/40",
                    v.status === "draft" && "pointer-events-none",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">Version {v.version}</span>
                    <StatusBadge status={v.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Effective {formatDate(v.effective_date)}
                    {v.published_at ? ` · published ${formatDate(v.published_at)}` : ""}
                  </p>
                  {v.change_summary ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{v.change_summary}</p> : null}
                </Link>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
