"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmAction } from "@/components/common/confirm-action";
import { ImageField } from "@/components/admin/image-field";
import { useAction } from "@/hooks/use-action";
import { deleteTestimonial, saveTestimonial } from "@/app/admin/testimonials/actions";

export interface TestimonialRow {
  id: string;
  person_name: string;
  person_role: string | null;
  company: string | null;
  avatar_url: string | null;
  quote: string;
  rating: number | null;
  category_id: string | null;
  course_id: string | null;
  consent_confirmed: boolean;
  is_featured: boolean;
  status: "draft" | "published" | "archived";
  sort_order: number;
}

export interface TestimonialOptions {
  categories: { id: string; name: string }[];
  courses: { id: string; title: string }[];
}

const NONE = "__none__";

export function TestimonialFormDialog({ trigger, testimonial, options }: {
  trigger: React.ReactNode;
  testimonial?: TestimonialRow;
  options: TestimonialOptions;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [avatar, setAvatar] = useState(testimonial?.avatar_url ?? "");
  const [consent, setConsent] = useState(testimonial?.consent_confirmed ?? false);
  const [featured, setFeatured] = useState(testimonial?.is_featured ?? false);
  const [status, setStatus] = useState<TestimonialRow["status"]>(testimonial?.status ?? "draft");
  const [category, setCategory] = useState(testimonial?.category_id ?? NONE);
  const [course, setCourse] = useState(testimonial?.course_id ?? NONE);
  const [rating, setRating] = useState(testimonial?.rating ? String(testimonial.rating) : NONE);
  const { run, pending, fieldErrors } = useAction(saveTestimonial, {
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
          <DialogTitle>{testimonial ? "Edit testimonial" : "New testimonial"}</DialogTitle>
          <DialogDescription>Use the person’s own words. Never edit the meaning of a quote.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run({
              id: testimonial?.id,
              person_name: String(f.get("person_name") ?? ""),
              person_role: String(f.get("person_role") ?? ""),
              company: String(f.get("company") ?? ""),
              avatar_url: avatar,
              quote: String(f.get("quote") ?? ""),
              rating: rating === NONE ? "" : Number(rating),
              category_id: category === NONE ? "" : category,
              course_id: course === NONE ? "" : course,
              consent_confirmed: consent,
              is_featured: featured,
              status,
              sort_order: Number(f.get("sort_order") ?? 0),
            });
          }}
        >
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="t-name">Name</FieldLabel>
                <Input id="t-name" name="person_name" defaultValue={testimonial?.person_name} required maxLength={120} />
                <FieldError>{fieldErrors.person_name?.[0]}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="t-role">Role</FieldLabel>
                <Input id="t-role" name="person_role" defaultValue={testimonial?.person_role ?? ""} maxLength={160} />
              </Field>
              <Field>
                <FieldLabel htmlFor="t-company">Company</FieldLabel>
                <Input id="t-company" name="company" defaultValue={testimonial?.company ?? ""} maxLength={160} />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="t-quote">Testimonial</FieldLabel>
              <Textarea id="t-quote" name="quote" rows={4} defaultValue={testimonial?.quote} required maxLength={2000} />
              <FieldError>{fieldErrors.quote?.[0]}</FieldError>
            </Field>
            <Field>
              <FieldLabel>Photo</FieldLabel>
              <FieldDescription>Only upload a photo the person agreed to share.</FieldDescription>
              <ImageField value={avatar} onChange={setAvatar} aspect="aspect-square" label="Upload a photo" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="t-rating">Rating</FieldLabel>
                <Select value={rating} onValueChange={setRating}>
                  <SelectTrigger id="t-rating">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>No rating</SelectItem>
                    {[5, 4, 3, 2, 1].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} out of 5
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="t-cat">Category</FieldLabel>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="t-cat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {options.categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="t-course">Course</FieldLabel>
                <Select value={course} onValueChange={setCourse}>
                  <SelectTrigger id="t-course">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {options.courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="t-status">Status</FieldLabel>
                <Select value={status} onValueChange={(v) => setStatus(v as TestimonialRow["status"])}>
                  <SelectTrigger id="t-status">
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
              <Field>
                <FieldLabel htmlFor="t-sort">Sort order</FieldLabel>
                <Input id="t-sort" name="sort_order" type="number" min={0} defaultValue={testimonial?.sort_order ?? 0} />
              </Field>
            </div>
            <Field orientation="horizontal" className="rounded-xl border bg-muted/40 p-3">
              <Checkbox
                id="t-consent"
                checked={consent}
                onCheckedChange={(v) => {
                  setConsent(v === true);
                  if (v !== true && status === "published") setStatus("draft");
                }}
              />
              <FieldContent>
                <FieldLabel htmlFor="t-consent">I have the person’s permission to publish this</FieldLabel>
                <FieldDescription>Required before publishing. Keep a record of their consent (email or form).</FieldDescription>
                <FieldError>{fieldErrors.consent_confirmed?.[0]}</FieldError>
              </FieldContent>
            </Field>
            <Field orientation="horizontal">
              <Switch id="t-featured" checked={featured} onCheckedChange={setFeatured} />
              <FieldLabel htmlFor="t-featured">Feature on the home page</FieldLabel>
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : testimonial ? "Save testimonial" : "Add testimonial"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TestimonialDeleteButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={
        <Button size="icon-sm" variant="ghost" aria-label={`Delete testimonial from ${name}`}>
          <Trash2 />
        </Button>
      }
      title="Delete this testimonial?"
      description={`The testimonial from ${name} will be removed from the website and deleted.`}
      confirmLabel="Delete testimonial"
      destructive
      action={() => deleteTestimonial({ id })}
      onDone={() => router.refresh()}
    />
  );
}
