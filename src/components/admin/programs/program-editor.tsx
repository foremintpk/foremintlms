"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/common/rich-text-editor";
import { StatusBadge } from "@/components/common/status-badge";
import { ConfirmAction } from "@/components/common/confirm-action";
import { EmptyState } from "@/components/common/empty-state";
import { SortableList } from "@/components/admin/sortable-list";
import { ImageField } from "@/components/admin/image-field";
import { useAction } from "@/hooks/use-action";
import { createProgram, deleteProgram, saveProgram, setProgramCourses } from "@/app/admin/programs/actions";

export interface ProgramDetail {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  image_url: string | null;
  level: "beginner" | "intermediate" | "advanced" | "all_levels";
  status: "draft" | "published" | "archived";
  is_featured: boolean;
  sort_order: number;
}

export interface ProgramCourse {
  id: string;
  title: string;
  status: string;
  is_required: boolean;
}

export function NewProgramDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const { run, pending, fieldErrors } = useAction(createProgram);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New program
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New program</DialogTitle>
          <DialogDescription>It starts as a draft. You can add courses on the next screen.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run({ title });
          }}
        >
          <Field>
            <FieldLabel htmlFor="program-title">Title</FieldLabel>
            <Input id="program-title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} autoFocus />
            <FieldError>{fieldErrors.title?.[0]}</FieldError>
          </Field>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={pending || !title.trim()}>
              {pending ? "Creating…" : "Create program"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProgramEditor({ program, items, allCourses }: {
  program: ProgramDetail;
  items: ProgramCourse[];
  allCourses: { id: string; title: string; status: string }[];
}) {
  const router = useRouter();
  const [description, setDescription] = useState(program.description ?? "");
  const [image, setImage] = useState(program.image_url ?? "");
  const [level, setLevel] = useState(program.level);
  const [status, setStatus] = useState(program.status);
  const [featured, setFeatured] = useState(program.is_featured);
  const [list, setList] = useState(items);
  const [dirty, setDirty] = useState(false);
  const [toAdd, setToAdd] = useState<string>("");
  const save = useAction(saveProgram, { onSuccess: () => router.refresh() });
  const saveCourses = useAction(setProgramCourses, {
    onSuccess: () => {
      setDirty(false);
      router.refresh();
    },
  });

  const available = allCourses.filter((c) => !list.some((l) => l.id === c.id));

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Card>
        <CardHeader>
          <CardTitle>Program details</CardTitle>
          <CardDescription>Shown on the public Programs page when published.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void save.run({
                id: program.id,
                title: String(f.get("title") ?? ""),
                slug: String(f.get("slug") ?? ""),
                summary: String(f.get("summary") ?? ""),
                description,
                image_url: image,
                level,
                status,
                is_featured: featured,
                sort_order: Number(f.get("sort_order") ?? 0),
              });
            }}
          >
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="p-title">Title</FieldLabel>
                  <Input id="p-title" name="title" defaultValue={program.title} required maxLength={200} />
                  <FieldError>{save.fieldErrors.title?.[0]}</FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor="p-slug">URL slug</FieldLabel>
                  <Input id="p-slug" name="slug" defaultValue={program.slug} />
                  <FieldError>{save.fieldErrors.slug?.[0]}</FieldError>
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="p-summary">Summary</FieldLabel>
                <Textarea id="p-summary" name="summary" rows={2} maxLength={400} defaultValue={program.summary ?? ""} />
              </Field>
              <Field>
                <FieldLabel>Description</FieldLabel>
                <RichTextEditor value={description} onChange={setDescription} ariaLabel="Program description" />
              </Field>
              <Field>
                <FieldLabel>Cover image</FieldLabel>
                <ImageField value={image} onChange={setImage} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="p-level">Level</FieldLabel>
                  <Select value={level} onValueChange={(v) => setLevel(v as ProgramDetail["level"])}>
                    <SelectTrigger id="p-level">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_levels">All levels</SelectItem>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="p-status">Status</FieldLabel>
                  <Select value={status} onValueChange={(v) => setStatus(v as ProgramDetail["status"])}>
                    <SelectTrigger id="p-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="p-sort">Sort order</FieldLabel>
                  <Input id="p-sort" name="sort_order" type="number" min={0} defaultValue={program.sort_order} />
                </Field>
              </div>
              <Field orientation="horizontal">
                <Switch id="p-featured" checked={featured} onCheckedChange={setFeatured} />
                <FieldLabel htmlFor="p-featured">Feature on the home page</FieldLabel>
              </Field>
            </FieldGroup>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <ConfirmAction
                trigger={
                  <Button type="button" variant="ghost" className="text-destructive">
                    <Trash2 /> Delete program
                  </Button>
                }
                title="Delete this program?"
                description="The courses themselves are not affected."
                confirmLabel="Delete program"
                destructive
                action={() => deleteProgram({ id: program.id })}
              />
              <Button type="submit" disabled={save.pending}>
                {save.pending ? "Saving…" : "Save program"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Courses in this program</CardTitle>
          <CardDescription>Drag to set the order learners should follow. Optional courses are marked as electives.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex gap-2">
            <Select value={toAdd} onValueChange={setToAdd}>
              <SelectTrigger className="flex-1" aria-label="Course to add">
                <SelectValue placeholder={available.length ? "Choose a course" : "All courses added"} />
              </SelectTrigger>
              <SelectContent>
                {available.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              disabled={!toAdd}
              onClick={() => {
                const course = allCourses.find((c) => c.id === toAdd);
                if (!course) return;
                setList((l) => [...l, { id: course.id, title: course.title, status: course.status, is_required: true }]);
                setToAdd("");
                setDirty(true);
              }}
            >
              <Plus /> Add
            </Button>
          </div>
          {list.length === 0 ? (
            <EmptyState title="No courses yet" description="Add the first course above." className="py-8" />
          ) : (
            <SortableList
              items={list}
              onReorder={(ids) => {
                setList((l) => ids.map((id) => l.find((x) => x.id === id)!).filter(Boolean));
                setDirty(true);
              }}
              renderItem={(c, index) => (
                <div className="flex items-center gap-2">
                  <span className="w-5 text-xs text-muted-foreground tabular-nums">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.title}</p>
                    <StatusBadge status={c.status} className="mt-1" />
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Switch
                      checked={c.is_required}
                      onCheckedChange={(v) => {
                        setList((l) => l.map((x) => (x.id === c.id ? { ...x, is_required: v } : x)));
                        setDirty(true);
                      }}
                      aria-label={`Required: ${c.title}`}
                    />
                    Required
                  </label>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Remove ${c.title}`}
                    onClick={() => {
                      setList((l) => l.filter((x) => x.id !== c.id));
                      setDirty(true);
                    }}
                  >
                    <X />
                  </Button>
                </div>
              )}
            />
          )}
          <div className="flex items-center justify-between gap-3">
            <FieldDescription>{dirty ? "You have unsaved changes." : "Saved."}</FieldDescription>
            <Button
              type="button"
              disabled={!dirty || saveCourses.pending}
              onClick={() => void saveCourses.run({ id: program.id, items: list.map((c) => ({ course_id: c.id, is_required: c.is_required })) })}
            >
              {saveCourses.pending ? "Saving…" : "Save course order"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
