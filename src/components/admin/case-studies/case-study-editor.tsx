"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/common/rich-text-editor";
import { ConfirmAction } from "@/components/common/confirm-action";
import { FileUpload } from "@/components/common/file-upload";
import { ImageField } from "@/components/admin/image-field";
import { CourseChecklist } from "@/components/admin/course-checklist";
import { useAction } from "@/hooks/use-action";
import { createCaseStudy, deleteCaseStudy, saveCaseStudy } from "@/app/admin/case-studies/actions";

export interface CaseStudyDetail {
  id: string;
  kind: "case_study" | "success_story";
  title: string;
  slug: string;
  summary: string | null;
  cover_image_url: string | null;
  customer_name: string | null;
  business_name: string | null;
  challenge: string | null;
  approach: string | null;
  implementation: string | null;
  outcome: string | null;
  media: { url: string; caption?: string }[] | null;
  course_ids: string[];
  consent_confirmed: boolean;
  is_featured: boolean;
  status: "draft" | "published" | "archived";
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
}

export function NewCaseStudyDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"case_study" | "success_story">("case_study");
  const { run, pending, fieldErrors } = useAction(createCaseStudy);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New story
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New story</DialogTitle>
          <DialogDescription>Starts as a draft. You’ll write it on the next screen.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run({ title, kind });
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="cs-new-title">Title</FieldLabel>
              <Input id="cs-new-title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} autoFocus />
              <FieldError>{fieldErrors.title?.[0]}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="cs-new-kind">Type</FieldLabel>
              <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
                <SelectTrigger id="cs-new-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="case_study">Case study — a business outcome</SelectItem>
                  <SelectItem value="success_story">Success story — a personal learning journey</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={pending || !title.trim()}>
              {pending ? "Creating…" : "Create story"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const SECTIONS = [
  { key: "challenge", label: "Challenge", hint: "Where they started and what they wanted to change." },
  { key: "approach", label: "Approach", hint: "What they learned and decided to do." },
  { key: "implementation", label: "Implementation", hint: "How they put it into practice." },
  { key: "outcome", label: "Outcome", hint: "What changed. Only include results the person has confirmed." },
] as const;

export function CaseStudyEditor({ story, courses }: { story: CaseStudyDetail; courses: { id: string; title: string; status: string }[] }) {
  const router = useRouter();
  const [kind, setKind] = useState(story.kind);
  const [cover, setCover] = useState(story.cover_image_url ?? "");
  const [rich, setRich] = useState({
    challenge: story.challenge ?? "",
    approach: story.approach ?? "",
    implementation: story.implementation ?? "",
    outcome: story.outcome ?? "",
  });
  const [media, setMedia] = useState<{ url: string; caption: string }[]>((story.media ?? []).map((m) => ({ url: m.url, caption: m.caption ?? "" })));
  const [courseIds, setCourseIds] = useState(story.course_ids ?? []);
  const [consent, setConsent] = useState(story.consent_confirmed);
  const [featured, setFeatured] = useState(story.is_featured);
  const [status, setStatus] = useState(story.status);
  const { run, pending, fieldErrors } = useAction(saveCaseStudy, { onSuccess: () => router.refresh() });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        void run({
          id: story.id,
          kind,
          title: String(f.get("title") ?? ""),
          slug: String(f.get("slug") ?? ""),
          summary: String(f.get("summary") ?? ""),
          cover_image_url: cover,
          customer_name: String(f.get("customer_name") ?? ""),
          business_name: String(f.get("business_name") ?? ""),
          ...rich,
          media: media.filter((m) => m.url.trim()),
          course_ids: courseIds,
          consent_confirmed: consent,
          is_featured: featured,
          status,
          seo_title: String(f.get("seo_title") ?? ""),
          seo_description: String(f.get("seo_description") ?? ""),
        });
      }}
      className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"
    >
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>The story</CardTitle>
            <CardDescription>Write in the person’s voice where you can. Avoid claims you can’t back up.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="cs-title">Title</FieldLabel>
                  <Input id="cs-title" name="title" defaultValue={story.title} required maxLength={200} />
                  <FieldError>{fieldErrors.title?.[0]}</FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor="cs-slug">URL slug</FieldLabel>
                  <Input id="cs-slug" name="slug" defaultValue={story.slug} />
                  <FieldError>{fieldErrors.slug?.[0]}</FieldError>
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="cs-customer">Person</FieldLabel>
                  <Input id="cs-customer" name="customer_name" defaultValue={story.customer_name ?? ""} maxLength={160} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="cs-business">Business</FieldLabel>
                  <Input id="cs-business" name="business_name" defaultValue={story.business_name ?? ""} maxLength={160} />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="cs-summary">Summary</FieldLabel>
                <Textarea id="cs-summary" name="summary" rows={3} maxLength={600} defaultValue={story.summary ?? ""} />
              </Field>
              {SECTIONS.map((s) => (
                <Field key={s.key}>
                  <FieldLabel>{s.label}</FieldLabel>
                  <FieldDescription>{s.hint}</FieldDescription>
                  <RichTextEditor
                    value={rich[s.key]}
                    onChange={(html) => setRich((r) => ({ ...r, [s.key]: html }))}
                    minHeight={140}
                    ariaLabel={s.label}
                  />
                </Field>
              ))}
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Media</CardTitle>
            <CardDescription>Screenshots or photos the person agreed to share.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {media.map((m, i) => (
              <div key={i} className="flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- admin preview */}
                <img src={m.url} alt="" className="size-16 shrink-0 rounded-lg border object-cover" />
                <div className="grid min-w-0 flex-1 gap-2">
                  <Input value={m.url} onChange={(e) => setMedia((list) => list.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} aria-label="Image URL" />
                  <Input
                    value={m.caption}
                    placeholder="Caption"
                    onChange={(e) => setMedia((list) => list.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))}
                    aria-label="Caption"
                    maxLength={200}
                  />
                </div>
                <Button type="button" size="icon-sm" variant="ghost" aria-label="Remove image" onClick={() => setMedia((list) => list.filter((_, j) => j !== i))}>
                  <X />
                </Button>
              </div>
            ))}
            <FileUpload
              purpose="marketing"
              accept="image/png,image/jpeg,image/webp,image/avif"
              label="Add an image"
              multiple
              onUploaded={(f) => f.publicUrl && setMedia((list) => [...list, { url: f.publicUrl!, caption: "" }])}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid h-fit gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Publishing</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="cs-kind">Type</FieldLabel>
                <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
                  <SelectTrigger id="cs-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="case_study">Case study</SelectItem>
                    <SelectItem value="success_story">Success story</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="cs-status">Status</FieldLabel>
                <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                  <SelectTrigger id="cs-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published" disabled={!consent}>
                      Published
                    </SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field orientation="horizontal" className="rounded-xl border bg-muted/40 p-3">
                <Checkbox
                  id="cs-consent"
                  checked={consent}
                  onCheckedChange={(v) => {
                    setConsent(v === true);
                    if (v !== true && status === "published") setStatus("draft");
                  }}
                />
                <FieldContent>
                  <FieldLabel htmlFor="cs-consent">I have the person’s permission to publish this</FieldLabel>
                  <FieldDescription>Covers their name, business, story, results and images.</FieldDescription>
                  <FieldError>{fieldErrors.consent_confirmed?.[0]}</FieldError>
                </FieldContent>
              </Field>
              <Field orientation="horizontal">
                <Switch id="cs-featured" checked={featured} onCheckedChange={setFeatured} />
                <FieldLabel htmlFor="cs-featured">Feature on the home page</FieldLabel>
              </Field>
            </FieldGroup>
            <div className="mt-6 flex flex-col gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save story"}
              </Button>
              <ConfirmAction
                trigger={
                  <Button type="button" variant="ghost" className="text-destructive">
                    <Trash2 /> Delete story
                  </Button>
                }
                title="Delete this story?"
                description="It will be removed from the website and deleted permanently."
                confirmLabel="Delete story"
                destructive
                action={() => deleteCaseStudy({ id: story.id })}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cover image</CardTitle>
          </CardHeader>
          <CardContent>
            <ImageField value={cover} onChange={setCover} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Related courses</CardTitle>
          </CardHeader>
          <CardContent>
            <CourseChecklist courses={courses} value={courseIds} onChange={setCourseIds} maxHeight={240} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Search engines</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="cs-seo-title">SEO title</FieldLabel>
                <Input id="cs-seo-title" name="seo_title" maxLength={70} defaultValue={story.seo_title ?? ""} />
              </Field>
              <Field>
                <FieldLabel htmlFor="cs-seo-desc">SEO description</FieldLabel>
                <Textarea id="cs-seo-desc" name="seo_description" rows={3} maxLength={170} defaultValue={story.seo_description ?? ""} />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
