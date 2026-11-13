"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/common/status-badge";
import { SortableList } from "@/components/admin/sortable-list";
import { ImageField } from "@/components/admin/image-field";
import { useAction } from "@/hooks/use-action";
import { sectionSchemas, type SectionKey } from "@/lib/cms/sections";
import { reorderSections, saveSection, savePageSeo, setSectionVisibility } from "@/app/admin/content/actions";

export interface SectionRow {
  id: string;
  section_key: string;
  sort_order: number;
  is_visible: boolean;
  content: unknown;
  updated_at: string | null;
  label: string;
}

type FieldKind = "text" | "textarea" | "number" | "image" | "cta" | "cta_optional" | "list";

interface FieldDef {
  name: string;
  label: string;
  kind: FieldKind;
  hint?: string;
  maxLength?: number;
  min?: number;
  max?: number;
  maxItems?: number;
  itemFields?: FieldDef[];
}

const titleField: FieldDef = { name: "title", label: "Heading", kind: "text", maxLength: 160 };
const subtitleField: FieldDef = { name: "subtitle", label: "Supporting text", kind: "textarea", maxLength: 400 };
const iconItem: FieldDef[] = [
  { name: "icon", label: "Icon", kind: "text", maxLength: 40, hint: "Lucide icon name, e.g. trending-up" },
  { name: "title", label: "Title", kind: "text", maxLength: 80 },
  { name: "body", label: "Text", kind: "textarea", maxLength: 300 },
];

/** Form layout for every editable section (mirrors src/lib/cms/sections.ts). */
const SECTION_FIELDS: Record<SectionKey, FieldDef[]> = {
  hero: [
    { name: "headline", label: "Headline", kind: "text", maxLength: 160 },
    { name: "subheadline", label: "Supporting copy", kind: "textarea", maxLength: 400 },
    { name: "primaryCta", label: "Primary button", kind: "cta" },
    { name: "secondaryCta", label: "Secondary button", kind: "cta" },
    { name: "image", label: "Hero image", kind: "image" },
  ],
  featured_courses: [titleField, subtitleField, { name: "limit", label: "Courses to show", kind: "number", min: 3, max: 12 }],
  categories: [titleField, subtitleField],
  why: [titleField, { name: "items", label: "Reasons", kind: "list", maxItems: 8, itemFields: iconItem }],
  how_it_works: [
    titleField,
    {
      name: "steps",
      label: "Steps",
      kind: "list",
      maxItems: 8,
      itemFields: [
        { name: "title", label: "Step", kind: "text", maxLength: 60 },
        { name: "body", label: "Description", kind: "textarea", maxLength: 240 },
      ],
    },
  ],
  formats: [titleField, { name: "items", label: "Formats", kind: "list", maxItems: 6, itemFields: iconItem }],
  instructors: [titleField, subtitleField],
  testimonials: [titleField, subtitleField],
  case_studies: [titleField, subtitleField],
  pricing: [titleField, subtitleField],
  faq: [titleField],
  final_cta: [
    titleField,
    { name: "body", label: "Text", kind: "textarea", maxLength: 400 },
    { name: "primaryCta", label: "Primary button", kind: "cta" },
    { name: "secondaryCta", label: "Secondary button (optional)", kind: "cta_optional" },
  ],
  intro: [titleField, { name: "body", label: "Text", kind: "textarea", maxLength: 1200 }, { name: "image", label: "Image", kind: "image" }],
  mission: [
    titleField,
    {
      name: "items",
      label: "Beliefs",
      kind: "list",
      maxItems: 6,
      itemFields: [
        { name: "title", label: "Title", kind: "text", maxLength: 80 },
        { name: "body", label: "Text", kind: "textarea", maxLength: 400 },
      ],
    },
  ],
  approach: [titleField, { name: "body", label: "Text", kind: "textarea", maxLength: 1600 }, { name: "image", label: "Image", kind: "image" }],
};

const SECTION_HINTS: Partial<Record<SectionKey, string>> = {
  instructors: "Shows approved, public instructors. Hidden automatically when there are none.",
  testimonials: "Shows published testimonials. Hidden automatically when there are none.",
  case_studies: "Shows featured, published case studies. Hidden automatically when there are none.",
  featured_courses: "Shows featured published courses, then the newest ones.",
  categories: "Shows published categories in their admin order.",
  pricing: "Shows public plans for bundles and memberships.",
  faq: "Shows FAQs marked “show on home”.",
};

type Json = Record<string, unknown>;

function emptyItem(fields: FieldDef[]): Json {
  return Object.fromEntries(fields.map((f) => [f.name, ""]));
}

function FieldInput({
  def,
  value,
  onChange,
  error,
  idPrefix,
}: {
  def: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: string;
  idPrefix: string;
}) {
  const id = `${idPrefix}-${def.name}`;
  if (def.kind === "image") {
    return (
      <Field>
        <FieldLabel>{def.label}</FieldLabel>
        <ImageField value={typeof value === "string" ? value : ""} onChange={onChange} />
        <FieldError>{error}</FieldError>
      </Field>
    );
  }
  if (def.kind === "cta" || def.kind === "cta_optional") {
    const v = (value as { label?: string; href?: string } | undefined) ?? {};
    return (
      <FieldSet>
        <FieldLegend variant="label">{def.label}</FieldLegend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            aria-label={`${def.label} label`}
            placeholder="Button label"
            value={v.label ?? ""}
            maxLength={40}
            onChange={(e) => onChange({ ...v, label: e.target.value })}
          />
          <Input
            aria-label={`${def.label} link`}
            placeholder="/courses or https://…"
            value={v.href ?? ""}
            maxLength={300}
            onChange={(e) => onChange({ ...v, href: e.target.value })}
          />
        </div>
        {def.kind === "cta_optional" ? <FieldDescription>Leave both empty to hide this button.</FieldDescription> : null}
        <FieldError>{error}</FieldError>
      </FieldSet>
    );
  }
  if (def.kind === "list") {
    const items = Array.isArray(value) ? (value as Json[]) : [];
    const fields = def.itemFields ?? [];
    const set = (next: Json[]) => onChange(next);
    return (
      <FieldSet>
        <FieldLegend variant="label">{def.label}</FieldLegend>
        <ol className="grid gap-3">
          {items.map((item, i) => (
            <li key={i} className="rounded-xl border bg-muted/30 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {def.label.replace(/s$/, "")} {i + 1}
                </span>
                <div className="flex gap-1">
                  <Button type="button" size="icon-xs" variant="ghost" disabled={i === 0} aria-label="Move up" onClick={() => {
                    const next = [...items];
                    [next[i - 1], next[i]] = [next[i], next[i - 1]];
                    set(next);
                  }}>
                    <ArrowUp />
                  </Button>
                  <Button type="button" size="icon-xs" variant="ghost" disabled={i === items.length - 1} aria-label="Move down" onClick={() => {
                    const next = [...items];
                    [next[i + 1], next[i]] = [next[i], next[i + 1]];
                    set(next);
                  }}>
                    <ArrowDown />
                  </Button>
                  <Button type="button" size="icon-xs" variant="ghost" aria-label="Remove" onClick={() => set(items.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
              <div className="grid gap-2">
                {fields.map((f) =>
                  f.kind === "textarea" ? (
                    <Textarea
                      key={f.name}
                      aria-label={f.label}
                      placeholder={f.label}
                      rows={2}
                      maxLength={f.maxLength}
                      value={String(item[f.name] ?? "")}
                      onChange={(e) => set(items.map((x, j) => (j === i ? { ...x, [f.name]: e.target.value } : x)))}
                    />
                  ) : (
                    <Input
                      key={f.name}
                      aria-label={f.label}
                      placeholder={f.hint ?? f.label}
                      maxLength={f.maxLength}
                      value={String(item[f.name] ?? "")}
                      onChange={(e) => set(items.map((x, j) => (j === i ? { ...x, [f.name]: e.target.value } : x)))}
                    />
                  ),
                )}
              </div>
            </li>
          ))}
        </ol>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-fit"
          disabled={items.length >= (def.maxItems ?? 10)}
          onClick={() => set([...items, emptyItem(fields)])}
        >
          <Plus /> Add {def.label.toLowerCase().replace(/s$/, "")}
        </Button>
        <FieldError>{error}</FieldError>
      </FieldSet>
    );
  }
  return (
    <Field>
      <FieldLabel htmlFor={id}>{def.label}</FieldLabel>
      {def.kind === "textarea" ? (
        <Textarea id={id} rows={3} maxLength={def.maxLength} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
      ) : def.kind === "number" ? (
        <Input
          id={id}
          type="number"
          min={def.min}
          max={def.max}
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          className="w-32"
        />
      ) : (
        <Input id={id} maxLength={def.maxLength} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
      )}
      {def.hint ? <FieldDescription>{def.hint}</FieldDescription> : null}
      <FieldError>{error}</FieldError>
    </Field>
  );
}

function initialContent(key: SectionKey, content: unknown): Json {
  const parsed = sectionSchemas[key].safeParse(content ?? {});
  if (parsed.success) return parsed.data as Json;
  return { ...((content as Json) ?? {}) };
}

function SectionDialog({ pageId, section, open, onOpenChange }: {
  pageId: string;
  section: SectionRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const key = section.section_key as SectionKey;
  const [content, setContent] = useState<Json>(() => initialContent(key, section.content));
  const { run, pending, fieldErrors, error } = useAction(saveSection, {
    onSuccess: () => {
      onOpenChange(false);
      router.refresh();
    },
  });
  const fields = SECTION_FIELDS[key] ?? [];

  const prepare = (): Json => {
    const out: Json = { ...content };
    for (const def of fields) {
      if (def.kind === "cta_optional") {
        const v = out[def.name] as { label?: string; href?: string } | undefined;
        if (!v || (!v.label?.trim() && !v.href?.trim())) delete out[def.name];
      }
      if ((def.kind === "text" || def.kind === "textarea" || def.kind === "image") && out[def.name] === "") {
        if (def.name === "subtitle" || def.name === "image" || def.name === "body") delete out[def.name];
      }
    }
    return out;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{section.label}</DialogTitle>
          <DialogDescription>{SECTION_HINTS[key] ?? "Edit what this section says."}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run({ pageId, sectionKey: key, content: prepare() });
          }}
        >
          <FieldGroup>
            {fields.map((def) => (
              <FieldInput
                key={def.name}
                def={def}
                idPrefix={`sec-${key}`}
                value={content[def.name]}
                onChange={(v) => setContent((c) => ({ ...c, [def.name]: v }))}
                error={Object.entries(fieldErrors).find(([path]) => path === def.name || path.startsWith(`${def.name}.`))?.[1]?.[0]}
              />
            ))}
          </FieldGroup>
          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save section"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SectionRowView({ pageId, section }: { pageId: string; section: SectionRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const missing = section.id.startsWith("missing:");
  const visibility = useAction(setSectionVisibility, { onSuccess: () => router.refresh() });
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{section.label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {missing ? "Not set up yet — save it once to add it to the page" : SECTION_HINTS[section.section_key as SectionKey] ?? "Text and images"}
        </p>
      </div>
      {missing ? (
        <StatusBadge status="draft" label="Not set up" />
      ) : (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch
            checked={section.is_visible}
            disabled={visibility.pending}
            onCheckedChange={(v) => void visibility.run({ sectionId: section.id, visible: v })}
            aria-label={`Show ${section.label}`}
          />
          <span className="max-sm:sr-only">{section.is_visible ? "Shown" : "Hidden"}</span>
        </label>
      )}
      <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
        <Pencil /> <span className="max-sm:hidden">Edit</span>
      </Button>
      {editing ? <SectionDialog pageId={pageId} section={section} open={editing} onOpenChange={setEditing} /> : null}
    </div>
  );
}

export function SectionList({ pageId, sections }: { pageId: string; sections: SectionRow[] }) {
  const router = useRouter();
  const reorder = useAction(reorderSections, { onSuccess: () => router.refresh() });
  const stored = sections.filter((s) => !s.id.startsWith("missing:"));
  const missing = sections.filter((s) => s.id.startsWith("missing:"));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sections</CardTitle>
        <CardDescription>Drag to reorder. Hidden sections stay saved but don’t appear on the page.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <SortableList
          items={stored}
          disabled={reorder.pending}
          onReorder={(ids) => void reorder.run({ pageId, ids })}
          renderItem={(s) => <SectionRowView pageId={pageId} section={s} />}
        />
        {missing.length > 0 ? (
          <ul className="overflow-hidden rounded-2xl border border-dashed bg-card">
            {missing.map((s) => (
              <li key={s.id} className="border-b px-3 py-2 last:border-0">
                <SectionRowView pageId={pageId} section={s} />
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function PageSeoForm({ page }: {
  page: { id: string; title: string; seo_title: string | null; seo_description: string | null; og_image_url: string | null };
}) {
  const router = useRouter();
  const [og, setOg] = useState(page.og_image_url ?? "");
  const { run, pending } = useAction(savePageSeo, { onSuccess: () => router.refresh() });
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>Search & sharing</CardTitle>
        <CardDescription>How this page appears in search results and when shared.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run({
              pageId: page.id,
              title: String(f.get("title") ?? ""),
              seo_title: String(f.get("seo_title") ?? ""),
              seo_description: String(f.get("seo_description") ?? ""),
              og_image_url: og,
            });
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="seo-page-title">Page name</FieldLabel>
              <Input id="seo-page-title" name="title" defaultValue={page.title} required maxLength={120} />
            </Field>
            <Field>
              <FieldLabel htmlFor="seo-title">SEO title</FieldLabel>
              <Input id="seo-title" name="seo_title" defaultValue={page.seo_title ?? ""} maxLength={70} />
              <FieldDescription>Up to 70 characters.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="seo-desc">SEO description</FieldLabel>
              <Textarea id="seo-desc" name="seo_description" rows={3} defaultValue={page.seo_description ?? ""} maxLength={170} />
              <FieldDescription>Up to 170 characters.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Social sharing image</FieldLabel>
              <ImageField value={og} onChange={setOg} label="Upload a sharing image" />
              <FieldDescription>1200 × 630 works best. Leave empty to use the generated image.</FieldDescription>
            </Field>
          </FieldGroup>
          <Button type="submit" className="mt-6 w-full" disabled={pending}>
            {pending ? "Saving…" : "Save page details"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
