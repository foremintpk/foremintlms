"use client";

import { useState } from "react";
import { ImageIcon, Loader2, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichTextEditor } from "@/components/common/rich-text-editor";
import { FileUpload } from "@/components/common/file-upload";
import { useAction } from "@/hooks/use-action";
import { checkCourseSlug, saveCourseDetails, suggestCourseSlug } from "@/lib/services/courses/actions/course";
import type { BuilderCourse, CategoryOption } from "@/lib/services/courses/builder";
import type { CourseDetailsInput } from "@/lib/validation/course";
import { FormRow, ListEditor, NumberField, SwitchRow, fieldError } from "./form-bits";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ar", label: "Arabic" },
  { value: "de", label: "German" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "hi", label: "Hindi" },
  { value: "pt", label: "Portuguese" },
  { value: "tr", label: "Turkish" },
  { value: "ur", label: "Urdu" },
  { value: "zh", label: "Chinese" },
];

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 border-b pb-8 last:border-0 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="grid gap-5">{children}</div>
    </section>
  );
}

function ImageField({
  label,
  hint,
  value,
  onChange,
  courseId,
  disabled,
  aspect,
}: {
  label: string;
  hint: string;
  value: string | null;
  onChange: (url: string | null) => void;
  courseId: string;
  disabled: boolean;
  aspect: string;
}) {
  return (
    <FormRow label={label} hint={hint}>
      {value ? (
        <div className="group relative overflow-hidden rounded-xl border bg-muted" style={{ aspectRatio: aspect }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded preview of arbitrary size */}
          <img src={value} alt="" className="size-full object-cover" />
          {!disabled ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="absolute top-2 right-2 shadow-card"
              onClick={() => onChange(null)}
            >
              <Trash2 /> Remove
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="grid place-items-center rounded-xl border border-dashed bg-muted/30 text-muted-foreground" style={{ aspectRatio: aspect }}>
          <ImageIcon className="size-6" aria-hidden />
        </div>
      )}
      {!disabled ? (
        <FileUpload
          purpose="course_image"
          context={{ courseId }}
          accept="image/png,image/jpeg,image/webp,image/avif"
          label={value ? "Replace image" : "Upload an image"}
          hint="PNG, JPG or WebP"
          onUploaded={(f) => onChange(f.publicUrl)}
        />
      ) : null}
    </FormRow>
  );
}

export function CourseDetailsForm({
  course,
  categories,
  videos,
  canEdit,
}: {
  course: BuilderCourse;
  categories: CategoryOption[];
  videos: { id: string; title: string | null; provider: string }[];
  canEdit: boolean;
}) {
  const [form, setForm] = useState<CourseDetailsInput>({
    courseId: course.id,
    title: course.title,
    slug: course.slug,
    short_description: course.short_description,
    description: course.description ?? "",
    thumbnail_url: course.thumbnail_url,
    banner_url: course.banner_url,
    promo_video_asset_id: course.promo_video?.video_asset_id ?? null,
    category_id: course.category_id,
    level: course.level,
    language: course.language,
    estimated_duration_minutes: course.estimated_duration_minutes,
    learning_outcomes: course.learning_outcomes ?? [],
    requirements: course.requirements ?? [],
    target_audience: course.target_audience ?? [],
    tags: course.tags ?? [],
    visibility: course.visibility,
    is_free: course.is_free,
    sequential_progression: course.sequential_progression,
    discussions_enabled: course.discussions_enabled,
    certificate_enabled: course.certificate_enabled,
    certificate_min_progress: course.certificate_min_progress,
    certificate_require_quizzes: course.certificate_require_quizzes,
    certificate_require_assignments: course.certificate_require_assignments,
    seo_title: course.seo_title,
    seo_description: course.seo_description,
  });
  const [slugState, setSlugState] = useState<"idle" | "checking" | "taken" | "ok">("idle");
  const set = <K extends keyof CourseDetailsInput>(key: K, value: CourseDetailsInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const save = useAction(saveCourseDetails);
  const suggest = useAction(suggestCourseSlug, { silent: true, onSuccess: (d) => set("slug", d.slug) });
  const errors = save.fieldErrors;
  const disabled = !canEdit || save.pending;
  const published = course.status === "published";

  const checkSlug = async () => {
    if (!form.slug || form.slug === course.slug) return setSlugState("idle");
    setSlugState("checking");
    const res = await checkCourseSlug({ courseId: course.id, slug: form.slug });
    setSlugState(res.ok ? (res.data.available ? "ok" : "taken") : "idle");
  };

  return (
    <form
      className="grid gap-8 pb-24"
      onSubmit={(e) => {
        e.preventDefault();
        if (canEdit) void save.run(form);
      }}
    >
      <Section title="Basics" description="How the course appears in the catalogue.">
        <FormRow label="Course title" htmlFor="title" error={fieldError(errors, "title")}>
          <Input id="title" value={form.title} maxLength={200} disabled={disabled} onChange={(e) => set("title", e.target.value)} />
        </FormRow>
        <FormRow
          label="Web address"
          htmlFor="slug"
          error={fieldError(errors, "slug") ?? (slugState === "taken" ? "Another course already uses this address" : undefined)}
          hint={
            published
              ? "Changing the address of a published course breaks existing links. Only administrators can do it."
              : slugState === "ok"
                ? "This address is available."
                : `Course page: /courses/${form.slug || "…"}`
          }
        >
          <div className="flex gap-2">
            <Input
              id="slug"
              value={form.slug}
              maxLength={100}
              disabled={disabled}
              onChange={(e) => {
                set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                setSlugState("idle");
              }}
              onBlur={checkSlug}
              aria-describedby="slug-status"
            />
            <Button
              type="button"
              variant="outline"
              disabled={disabled || suggest.pending || !form.title}
              onClick={() => void suggest.run({ courseId: course.id, title: form.title })}
            >
              {suggest.pending || slugState === "checking" ? <Loader2 className="animate-spin" /> : <Sparkles />} From title
            </Button>
          </div>
        </FormRow>
        <FormRow label="Short description" htmlFor="short" hint="One or two sentences shown on course cards." error={fieldError(errors, "short_description")}>
          <Textarea
            id="short"
            rows={2}
            maxLength={400}
            value={form.short_description ?? ""}
            disabled={disabled}
            onChange={(e) => set("short_description", e.target.value)}
          />
        </FormRow>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormRow label="Category" error={fieldError(errors, "category_id")}>
            <Select value={form.category_id ?? "none"} onValueChange={(v) => set("category_id", v === "none" ? null : v)} disabled={disabled}>
              <SelectTrigger className="w-full" aria-label="Category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No category</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.status !== "published" ? " (hidden)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormRow>
          <FormRow label="Skill level">
            <Select value={form.level} onValueChange={(v) => set("level", v as CourseDetailsInput["level"])} disabled={disabled}>
              <SelectTrigger className="w-full" aria-label="Skill level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
                <SelectItem value="all_levels">All levels</SelectItem>
              </SelectContent>
            </Select>
          </FormRow>
          <FormRow label="Language">
            <Select value={form.language ?? "en"} onValueChange={(v) => set("language", v)} disabled={disabled}>
              <SelectTrigger className="w-full" aria-label="Language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormRow>
          <FormRow label="Estimated duration" htmlFor="duration" optional error={fieldError(errors, "estimated_duration_minutes")}>
            <NumberField
              id="duration"
              value={form.estimated_duration_minutes ?? null}
              min={0}
              max={100000}
              suffix="minutes"
              disabled={disabled}
              onChange={(v) => set("estimated_duration_minutes", v)}
            />
          </FormRow>
        </div>
      </Section>

      <Section title="Course page" description="The full description and what students will gain.">
        <FormRow label="Full description" error={fieldError(errors, "description")}>
          <RichTextEditor
            value={form.description ?? ""}
            onChange={(html) => set("description", html)}
            placeholder="Describe what the course covers and how it's taught…"
            ariaLabel="Full description"
          />
        </FormRow>
        <FormRow label="What students will learn" hint="Aim for 4–8 concrete outcomes." error={fieldError(errors, "learning_outcomes")}>
          <ListEditor
            ariaLabel="Learning outcome"
            value={form.learning_outcomes ?? []}
            onChange={(v) => set("learning_outcomes", v)}
            placeholder="e.g. Choose a profitable product to sell on Amazon"
            addLabel="Add outcome"
            disabled={disabled}
          />
        </FormRow>
        <FormRow label="Requirements" optional>
          <ListEditor
            ariaLabel="Requirement"
            value={form.requirements ?? []}
            onChange={(v) => set("requirements", v)}
            placeholder="e.g. A laptop with a modern browser"
            addLabel="Add requirement"
            disabled={disabled}
          />
        </FormRow>
        <FormRow label="Who this course is for" optional>
          <ListEditor
            ariaLabel="Audience"
            value={form.target_audience ?? []}
            onChange={(v) => set("target_audience", v)}
            placeholder="e.g. New sellers starting an e-commerce business"
            addLabel="Add audience"
            disabled={disabled}
          />
        </FormRow>
        <FormRow label="Tags" optional hint="Help students find the course in search.">
          <ListEditor
            ariaLabel="Tag"
            value={form.tags ?? []}
            onChange={(v) => set("tags", v)}
            placeholder="e.g. private label"
            addLabel="Add tag"
            max={15}
            maxLength={40}
            disabled={disabled}
          />
        </FormRow>
      </Section>

      <Section title="Images and promo video" description="Use a 16:9 thumbnail; the banner appears at the top of the course page.">
        <div className="grid gap-5 md:grid-cols-2">
          <ImageField
            label="Thumbnail"
            hint="1280 × 720 recommended"
            aspect="16 / 9"
            value={form.thumbnail_url ?? null}
            onChange={(v) => set("thumbnail_url", v)}
            courseId={course.id}
            disabled={disabled}
          />
          <ImageField
            label="Banner"
            hint="1920 × 640 recommended"
            aspect="3 / 1"
            value={form.banner_url ?? null}
            onChange={(v) => set("banner_url", v)}
            courseId={course.id}
            disabled={disabled}
          />
        </div>
        <FormRow
          label="Promo video"
          optional
          hint={videos.length ? "Shown on the public course page." : "Add a video in any lesson's video block first, then choose it here."}
          error={fieldError(errors, "promo_video_asset_id")}
        >
          <Select
            value={form.promo_video_asset_id ?? "none"}
            onValueChange={(v) => set("promo_video_asset_id", v === "none" ? null : v)}
            disabled={disabled || videos.length === 0}
          >
            <SelectTrigger className="w-full" aria-label="Promo video">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No promo video</SelectItem>
              {videos.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.title || "Untitled video"} · {v.provider === "youtube" ? "YouTube" : v.provider === "mux" ? "Mux" : "Bunny"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormRow>
      </Section>

      <Section title="Access and progression" description="Who can find the course and how students move through it.">
        <FormRow label="Visibility">
          <Select value={form.visibility} onValueChange={(v) => set("visibility", v as CourseDetailsInput["visibility"])} disabled={disabled}>
            <SelectTrigger className="w-full sm:max-w-sm" aria-label="Visibility">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public — listed in the catalogue</SelectItem>
              <SelectItem value="unlisted">Unlisted — only people with the link</SelectItem>
              <SelectItem value="private">Private — enrolled students only</SelectItem>
            </SelectContent>
          </Select>
        </FormRow>
        <SwitchRow
          label="Free course"
          description="Anyone with an account can enroll without paying."
          checked={Boolean(form.is_free)}
          onCheckedChange={(v) => set("is_free", v)}
          disabled={disabled}
        />
        <SwitchRow
          label="Sequential lessons"
          description="Students must complete each lesson before the next one unlocks."
          checked={Boolean(form.sequential_progression)}
          onCheckedChange={(v) => set("sequential_progression", v)}
          disabled={disabled}
        />
        <SwitchRow
          label="Course discussions"
          description="Enrolled students can post questions and discussions."
          checked={Boolean(form.discussions_enabled)}
          onCheckedChange={(v) => set("discussions_enabled", v)}
          disabled={disabled}
        />
      </Section>

      <Section title="Certificate" description="When students earn a verifiable certificate.">
        <SwitchRow
          label="Issue a certificate"
          checked={Boolean(form.certificate_enabled)}
          onCheckedChange={(v) => set("certificate_enabled", v)}
          disabled={disabled}
        />
        {form.certificate_enabled ? (
          <>
            <FormRow label="Lessons completed" htmlFor="cert-progress" error={fieldError(errors, "certificate_min_progress")}>
              <div className="max-w-40">
                <NumberField
                  id="cert-progress"
                  value={form.certificate_min_progress ?? 100}
                  min={1}
                  max={100}
                  suffix="%"
                  disabled={disabled}
                  onChange={(v) => set("certificate_min_progress", v ?? 100)}
                />
              </div>
            </FormRow>
            <SwitchRow
              label="Pass every graded quiz"
              checked={Boolean(form.certificate_require_quizzes)}
              onCheckedChange={(v) => set("certificate_require_quizzes", v)}
              disabled={disabled}
            />
            <SwitchRow
              label="Have every assignment graded or approved"
              checked={Boolean(form.certificate_require_assignments)}
              onCheckedChange={(v) => set("certificate_require_assignments", v)}
              disabled={disabled}
            />
          </>
        ) : null}
      </Section>

      <Section title="Search engines" description="Optional overrides for the page title and description.">
        <FormRow label="SEO title" htmlFor="seo-title" optional hint={`${(form.seo_title ?? "").length}/70`}>
          <Input id="seo-title" maxLength={70} value={form.seo_title ?? ""} disabled={disabled} onChange={(e) => set("seo_title", e.target.value)} />
        </FormRow>
        <FormRow label="SEO description" htmlFor="seo-desc" optional hint={`${(form.seo_description ?? "").length}/170`}>
          <Textarea
            id="seo-desc"
            rows={2}
            maxLength={170}
            value={form.seo_description ?? ""}
            disabled={disabled}
            onChange={(e) => set("seo_description", e.target.value)}
          />
        </FormRow>
      </Section>

      {canEdit ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur md:sticky md:-mx-1 md:rounded-xl md:border">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 max-md:pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
            <p className="text-sm text-muted-foreground max-sm:hidden">
              {save.error ? <span className="text-destructive">{save.error}</span> : "Changes apply to the public page once the course is published."}
            </p>
            <Button type="submit" size="lg" disabled={save.pending || slugState === "taken"} className="max-sm:w-full">
              {save.pending ? <Loader2 className="animate-spin" /> : null}
              Save course
            </Button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
