"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, BookOpen, MoreHorizontal, Pencil, Send, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/common/status-badge";
import { RichTextEditor } from "@/components/common/rich-text-editor";
import { ConfirmAction } from "@/components/common/confirm-action";
import { SortableList } from "@/components/admin/sortable-list";
import { ImageField } from "@/components/admin/image-field";
import { CourseChecklist } from "@/components/admin/course-checklist";
import { useAction } from "@/hooks/use-action";
import { slugify } from "@/lib/format";
import {
  assignCategoryCourses,
  deleteCategory,
  reorderCategories,
  saveCategory,
  setCategoryStatus,
} from "@/app/admin/categories/actions";

export interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  description: string | null;
  image_url: string | null;
  icon: string | null;
  accent_color: string | null;
  status: "draft" | "published" | "archived";
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
  course_count: number;
}

export interface CourseOption {
  id: string;
  title: string;
  status: string;
  category_id: string | null;
}

export function CategoryFormDialog({ trigger, category }: { trigger: React.ReactNode; category?: CategoryRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(category));
  const [description, setDescription] = useState(category?.description ?? "");
  const [image, setImage] = useState(category?.image_url ?? "");
  const [status, setStatus] = useState<CategoryRow["status"]>(category?.status ?? "draft");
  const { run, pending, fieldErrors } = useAction(saveCategory, {
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
          <DialogTitle>{category ? "Edit category" : "New category"}</DialogTitle>
          <DialogDescription>Categories appear in the course catalogue, navigation and on the home page.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run({
              id: category?.id,
              name,
              slug,
              short_description: String(f.get("short_description") ?? ""),
              description,
              image_url: image,
              icon: String(f.get("icon") ?? ""),
              accent_color: String(f.get("accent_color") ?? ""),
              status,
              seo_title: String(f.get("seo_title") ?? ""),
              seo_description: String(f.get("seo_description") ?? ""),
            });
          }}
        >
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="cat-name">Name</FieldLabel>
                <Input
                  id="cat-name"
                  value={name}
                  required
                  maxLength={120}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!slugTouched) setSlug(slugify(e.target.value));
                  }}
                />
                <FieldError>{fieldErrors.name?.[0]}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="cat-slug">URL slug</FieldLabel>
                <Input
                  id="cat-slug"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value);
                  }}
                />
                <FieldDescription>/categories/{slugify(slug || name) || "…"}</FieldDescription>
                <FieldError>{fieldErrors.slug?.[0]}</FieldError>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="cat-short">Short description</FieldLabel>
              <Textarea id="cat-short" name="short_description" rows={2} maxLength={280} defaultValue={category?.short_description ?? ""} />
            </Field>
            <Field>
              <FieldLabel>Full description</FieldLabel>
              <RichTextEditor value={description} onChange={setDescription} minHeight={140} ariaLabel="Category description" />
            </Field>
            <Field>
              <FieldLabel>Image</FieldLabel>
              <ImageField value={image} onChange={setImage} purpose="category_image" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="cat-icon">Icon</FieldLabel>
                <Input id="cat-icon" name="icon" placeholder="shopping-bag" defaultValue={category?.icon ?? ""} />
                <FieldDescription>Lucide icon name</FieldDescription>
                <FieldError>{fieldErrors.icon?.[0]}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="cat-color">Accent colour</FieldLabel>
                <Input id="cat-color" name="accent_color" placeholder="#5B3DF5" defaultValue={category?.accent_color ?? ""} />
                <FieldError>{fieldErrors.accent_color?.[0]}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="cat-status">Status</FieldLabel>
                <Select value={status} onValueChange={(v) => setStatus(v as CategoryRow["status"])}>
                  <SelectTrigger id="cat-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="cat-seo-title">SEO title</FieldLabel>
                <Input id="cat-seo-title" name="seo_title" maxLength={70} defaultValue={category?.seo_title ?? ""} />
              </Field>
              <Field>
                <FieldLabel htmlFor="cat-seo-desc">SEO description</FieldLabel>
                <Input id="cat-seo-desc" name="seo_description" maxLength={170} defaultValue={category?.seo_description ?? ""} />
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : category ? "Save category" : "Create category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AssignCoursesDialog({ category, courses, open, onOpenChange }: {
  category: CategoryRow;
  courses: CourseOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(courses.filter((c) => c.category_id === category.id).map((c) => c.id));
  const { run, pending } = useAction(assignCategoryCourses, {
    onSuccess: () => {
      onOpenChange(false);
      router.refresh();
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Courses in {category.name}</DialogTitle>
          <DialogDescription>A course belongs to one category. Selecting a course here moves it out of its current category.</DialogDescription>
        </DialogHeader>
        <CourseChecklist
          courses={courses.map((c) => ({
            id: c.id,
            title: c.title,
            status: c.status,
            hint: c.category_id && c.category_id !== category.id ? "in another category" : undefined,
          }))}
          value={selected}
          onChange={setSelected}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={() => void run({ categoryId: category.id, courseIds: selected })} disabled={pending}>
            {pending ? "Saving…" : "Save courses"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoryActions({ category, courses }: { category: CategoryRow; courses: CourseOption[] }) {
  const router = useRouter();
  const [assignOpen, setAssignOpen] = useState(false);
  const status = useAction(setCategoryStatus, { onSuccess: () => router.refresh() });

  return (
    <div className="flex items-center gap-1">
      <CategoryFormDialog
        category={category}
        trigger={
          <Button size="sm" variant="ghost" aria-label={`Edit ${category.name}`}>
            <Pencil /> <span className="max-sm:hidden">Edit</span>
          </Button>
        }
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label={`More actions for ${category.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setAssignOpen(true)}>
            <BookOpen /> Assign courses
          </DropdownMenuItem>
          {category.status !== "published" ? (
            <DropdownMenuItem disabled={status.pending} onSelect={() => void status.run({ id: category.id, status: "published" })}>
              <Send /> Publish
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled={status.pending} onSelect={() => void status.run({ id: category.id, status: "draft" })}>
              <Undo2 /> Move to drafts
            </DropdownMenuItem>
          )}
          {category.status !== "archived" ? (
            <DropdownMenuItem disabled={status.pending} onSelect={() => void status.run({ id: category.id, status: "archived" })}>
              <Archive /> Archive
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmAction
        trigger={
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={category.course_count > 0}
            aria-label={category.course_count > 0 ? `${category.name} has courses and can't be deleted` : `Delete ${category.name}`}
            title={category.course_count > 0 ? "Categories with courses can only be archived" : "Delete category"}
          >
            <Trash2 />
          </Button>
        }
        title={`Delete ${category.name}?`}
        description="This removes the category permanently. Categories with courses can only be archived."
        confirmLabel="Delete category"
        destructive
        action={() => deleteCategory({ id: category.id })}
        onDone={() => router.refresh()}
      />
      {assignOpen ? <AssignCoursesDialog category={category} courses={courses} open={assignOpen} onOpenChange={setAssignOpen} /> : null}
    </div>
  );
}

export function CategoryManager({ categories, courses }: { categories: CategoryRow[]; courses: CourseOption[] }) {
  const router = useRouter();
  const reorder = useAction(reorderCategories, { onSuccess: () => router.refresh() });
  return (
    <SortableList
      items={categories}
      disabled={reorder.pending}
      onReorder={(ids) => void reorder.run({ ids })}
      renderItem={(c) => (
        <div className="flex items-center gap-3">
          <div className="size-12 shrink-0 overflow-hidden rounded-lg border bg-muted max-sm:hidden">
            {c.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- small admin thumbnail
              <img src={c.image_url} alt="" className="size-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{c.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              /{c.slug} · {c.course_count} course{c.course_count === 1 ? "" : "s"}
            </p>
          </div>
          <StatusBadge status={c.status} />
          <CategoryActions category={c} courses={courses} />
        </div>
      )}
    />
  );
}
