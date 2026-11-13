"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/common/file-upload";
import { useAction } from "@/hooks/use-action";
import { updateInstructorProfileAction } from "@/app/teach/settings/actions";
import { initials } from "@/lib/format";

const SOCIALS = [
  { key: "linkedin", label: "LinkedIn" },
  { key: "x", label: "X (Twitter)" },
  { key: "youtube", label: "YouTube" },
  { key: "instagram", label: "Instagram" },
  { key: "github", label: "GitHub" },
  { key: "tiktok", label: "TikTok" },
] as const;

export interface InstructorProfileValues {
  public_name: string;
  slug: string;
  headline: string;
  bio: string;
  avatar_url: string;
  expertise: string[];
  website_url: string;
  social_links: Record<string, string>;
  is_public: boolean;
}

export function InstructorProfileForm({ initial, status, siteUrl }: { initial: InstructorProfileValues; status: string; siteUrl: string }) {
  const [values, setValues] = useState(initial);
  const [skill, setSkill] = useState("");
  const { run, pending, fieldErrors } = useAction(updateInstructorProfileAction);
  const set = <K extends keyof InstructorProfileValues>(k: K, v: InstructorProfileValues[K]) => setValues((s) => ({ ...s, [k]: v }));
  const err = (k: string) => (fieldErrors[k]?.length ? [{ message: fieldErrors[k][0] }] : undefined);
  const addSkill = () => {
    const s = skill.trim();
    if (s && !values.expertise.includes(s) && values.expertise.length < 12) set("expertise", [...values.expertise, s.slice(0, 40)]);
    setSkill("");
  };

  return (
    <form
      className="grid gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        void run(values);
      }}
    >
      <div className="flex items-center gap-4">
        <Avatar className="size-16 ring-1 ring-border">
          {values.avatar_url ? <AvatarImage src={values.avatar_url} alt="" /> : null}
          <AvatarFallback className="bg-brand-soft text-primary">{initials(values.public_name)}</AvatarFallback>
        </Avatar>
        <div className="grid flex-1 gap-2">
          <FileUpload
            purpose="avatar"
            accept="image/png,image/jpeg,image/webp"
            label="Upload a photo"
            hint="Square images work best. PNG, JPG or WebP."
            onUploaded={(f) => f.publicUrl && set("avatar_url", f.publicUrl)}
          />
          {values.avatar_url ? (
            <Button type="button" variant="ghost" size="xs" className="w-fit" onClick={() => set("avatar_url", "")}>
              Remove photo
            </Button>
          ) : null}
        </div>
      </div>

      <FieldGroup className="gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="ip-name">Public name</FieldLabel>
            <Input id="ip-name" value={values.public_name} maxLength={120} onChange={(e) => set("public_name", e.target.value)} aria-invalid={Boolean(err("public_name"))} />
            <FieldError errors={err("public_name")} />
          </Field>
          <Field>
            <FieldLabel htmlFor="ip-slug">Profile address</FieldLabel>
            <Input id="ip-slug" value={values.slug} maxLength={120} onChange={(e) => set("slug", e.target.value.toLowerCase())} aria-invalid={Boolean(err("slug"))} />
            <FieldDescription className="truncate">
              {siteUrl}/instructors/{values.slug || "your-name"}
            </FieldDescription>
            <FieldError errors={err("slug")} />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="ip-headline">Headline</FieldLabel>
          <Input id="ip-headline" value={values.headline} maxLength={160} placeholder="E-commerce operator and Shopify consultant" onChange={(e) => set("headline", e.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="ip-bio">Bio</FieldLabel>
          <Textarea id="ip-bio" rows={6} maxLength={8000} value={values.bio} placeholder="Your experience, what you teach and who you help" onChange={(e) => set("bio", e.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="ip-skill">Areas of expertise</FieldLabel>
          <div className="flex gap-2">
            <Input
              id="ip-skill"
              value={skill}
              maxLength={40}
              placeholder="e.g. Amazon PPC"
              onChange={(e) => setSkill(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSkill();
                }
              }}
            />
            <Button type="button" variant="outline" onClick={addSkill} disabled={!skill.trim() || values.expertise.length >= 12}>
              Add
            </Button>
          </div>
          {values.expertise.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {values.expertise.map((s) => (
                <li key={s} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-primary">
                  {s}
                  <button type="button" aria-label={`Remove ${s}`} onClick={() => set("expertise", values.expertise.filter((x) => x !== s))}>
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </Field>
        <Field>
          <FieldLabel htmlFor="ip-web">Website</FieldLabel>
          <Input id="ip-web" type="url" value={values.website_url} placeholder="https://" onChange={(e) => set("website_url", e.target.value)} aria-invalid={Boolean(err("website_url"))} />
          <FieldError errors={err("website_url")} />
        </Field>
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-medium">Social profiles</legend>
          {SOCIALS.map((s) => (
            <Field key={s.key}>
              <FieldLabel htmlFor={`ip-${s.key}`} className="text-xs text-muted-foreground">
                {s.label}
              </FieldLabel>
              <Input
                id={`ip-${s.key}`}
                type="url"
                placeholder="https://"
                value={values.social_links[s.key] ?? ""}
                onChange={(e) => set("social_links", { ...values.social_links, [s.key]: e.target.value })}
              />
            </Field>
          ))}
        </fieldset>
        <Field orientation="horizontal" className="rounded-xl border p-4">
          <Switch id="ip-public" checked={values.is_public} onCheckedChange={(v) => set("is_public", v)} />
          <div>
            <FieldLabel htmlFor="ip-public">Show my profile on the website</FieldLabel>
            <FieldDescription>
              {status === "approved"
                ? "Your profile appears on the instructors page and your course pages."
                : "Your profile goes live once an administrator approves your instructor account."}
            </FieldDescription>
          </div>
        </Field>
      </FieldGroup>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save instructor profile"}
        </Button>
      </div>
    </form>
  );
}
