"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAction, type ClientActionResult } from "@/hooks/use-action";

export interface CourseOption {
  id: string;
  title: string;
  status: string;
}

function CourseChecklist({ courses, selected, onChange }: { courses: CourseOption[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => courses.filter((c) => c.title.toLowerCase().includes(q.toLowerCase())), [courses, q]);
  const toggle = (id: string, on: boolean) => onChange(on ? [...selected, id] : selected.filter((s) => s !== id));
  return (
    <div className="rounded-xl border">
      <div className="relative border-b">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter courses" className="border-0 pl-9 shadow-none focus-visible:ring-0" aria-label="Filter courses" />
      </div>
      <ul className="max-h-64 divide-y overflow-y-auto">
        {filtered.map((c) => (
          <li key={c.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/50">
              <Checkbox checked={selected.includes(c.id)} onCheckedChange={(v) => toggle(c.id, v === true)} />
              <span className="flex-1 truncate">{c.title}</span>
              {c.status !== "published" ? <span className="text-xs text-muted-foreground">{c.status.replace(/_/g, " ")}</span> : null}
            </label>
          </li>
        ))}
        {filtered.length === 0 ? <li className="px-3 py-4 text-sm text-muted-foreground">No courses match.</li> : null}
      </ul>
      <p className="border-t px-3 py-2 text-xs text-muted-foreground">{selected.length} selected</p>
    </div>
  );
}

export function CreateGroupProductDialog({
  kind,
  courses,
  create,
}: {
  kind: "bundle" | "membership";
  courses: CourseOption[];
  create: (input: { kind: "bundle" | "membership"; name: string; description: string | null; grantsAllCourses: boolean; courseIds: string[] }) => Promise<ClientActionResult<{ productId: string }>>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [all, setAll] = useState(kind === "membership");
  const [selected, setSelected] = useState<string[]>([]);
  const { run, pending, fieldErrors } = useAction(create, {
    onSuccess: (data) => {
      setOpen(false);
      router.push(`/admin/pricing/${data.productId}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={kind === "bundle" ? "default" : "outline"}>
          <Plus className="size-4" /> {kind === "bundle" ? "New bundle" : "New membership"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{kind === "bundle" ? "New bundle" : "New membership"}</DialogTitle>
          <DialogDescription>
            {kind === "bundle"
              ? "Sell several courses together, usually at a lower combined price."
              : "Give members access to the whole catalogue or a set of courses — one-time or by subscription."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run({ kind, name, description: description.trim() || null, grantsAllCourses: kind === "membership" && all, courseIds: kind === "membership" && all ? [] : selected });
          }}
        >
          <Field>
            <FieldLabel htmlFor="group-name">Name</FieldLabel>
            <Input id="group-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} placeholder={kind === "bundle" ? "E-commerce starter bundle" : "All-access membership"} />
            {fieldErrors.name?.[0] ? <FieldError>{fieldErrors.name[0]}</FieldError> : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="group-description">Description</FieldLabel>
            <Textarea id="group-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={1500} />
          </Field>
          {kind === "membership" ? (
            <label className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
              <span>
                <span className="block text-sm font-medium">All courses</span>
                <span className="block text-xs text-muted-foreground">Includes courses published in the future.</span>
              </span>
              <Switch checked={all} onCheckedChange={setAll} aria-label="All courses" />
            </label>
          ) : null}
          {kind === "bundle" || !all ? (
            <Field>
              <FieldLabel>Courses</FieldLabel>
              <CourseChecklist courses={courses} selected={selected} onChange={setSelected} />
              {fieldErrors.courseIds?.[0] ? <FieldError>{fieldErrors.courseIds[0]}</FieldError> : null}
            </Field>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : kind === "bundle" ? "Create bundle" : "Create membership"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CompositionEditor({
  product,
  courses,
  initialCourseIds,
  bundle,
  save,
}: {
  product: { id: string; kind: "bundle" | "membership"; grants_all_courses: boolean };
  courses: CourseOption[];
  initialCourseIds: string[];
  bundle: { headline: string | null; highlights: string[] } | null;
  save: (input: { productId: string; grantsAllCourses: boolean; courseIds: string[]; headline: string | null; highlights: string[] }) => Promise<ClientActionResult<null>>;
}) {
  const router = useRouter();
  const [all, setAll] = useState(product.grants_all_courses);
  const [selected, setSelected] = useState<string[]>(initialCourseIds);
  const [headline, setHeadline] = useState(bundle?.headline ?? "");
  const [highlights, setHighlights] = useState<string[]>(bundle?.highlights ?? []);
  const [draft, setDraft] = useState("");
  const { run, pending } = useAction(save, { onSuccess: () => router.refresh() });

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        void run({ productId: product.id, grantsAllCourses: product.kind === "membership" && all, courseIds: selected, headline: headline.trim() || null, highlights });
      }}
    >
      {product.kind === "membership" ? (
        <label className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
          <span>
            <span className="block text-sm font-medium">All courses</span>
            <span className="block text-xs text-muted-foreground">Members can open every published course, including future ones.</span>
          </span>
          <Switch checked={all} onCheckedChange={setAll} aria-label="All courses" />
        </label>
      ) : null}
      {product.kind === "bundle" || !all ? (
        <Field>
          <FieldLabel>Included courses</FieldLabel>
          <CourseChecklist courses={courses} selected={selected} onChange={setSelected} />
          <FieldDescription>Changes apply to new purchases. Existing buyers keep the courses they were granted.</FieldDescription>
        </Field>
      ) : null}
      {product.kind === "bundle" ? (
        <>
          <Field>
            <FieldLabel htmlFor="bundle-headline">Headline</FieldLabel>
            <Input id="bundle-headline" value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={200} placeholder="Everything you need to launch your first store" />
          </Field>
          <Field>
            <FieldLabel htmlFor="bundle-highlight">Highlights</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="bundle-highlight"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={160}
                placeholder="Add a highlight and press Add"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (draft.trim() && highlights.length < 12) {
                      setHighlights([...highlights, draft.trim()]);
                      setDraft("");
                    }
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (draft.trim() && highlights.length < 12) {
                    setHighlights([...highlights, draft.trim()]);
                    setDraft("");
                  }
                }}
              >
                Add
              </Button>
            </div>
            {highlights.length ? (
              <ul className="mt-2 space-y-1.5">
                {highlights.map((h, i) => (
                  <li key={`${h}-${i}`} className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-sm">
                    <span className="flex-1">{h}</span>
                    <button type="button" aria-label={`Remove ${h}`} className="text-muted-foreground hover:text-foreground" onClick={() => setHighlights(highlights.filter((_, j) => j !== i))}>
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </Field>
        </>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save included courses"}
        </Button>
      </div>
    </form>
  );
}
