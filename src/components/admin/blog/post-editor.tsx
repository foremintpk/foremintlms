"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Archive, CalendarClock, Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/common/rich-text-editor";
import { ConfirmAction } from "@/components/common/confirm-action";
import { StatusBadge } from "@/components/common/status-badge";
import { LocalTime } from "@/components/common/local-time";
import { ImageField } from "@/components/admin/image-field";
import { useAction } from "@/hooks/use-action";
import { createPost, deletePost, savePost } from "@/app/admin/blog/actions";

export interface PostDetail {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
  cover_image_url: string | null;
  author_name: string | null;
  category: string | null;
  tags: string[];
  reading_minutes: number | null;
  status: "draft" | "scheduled" | "published" | "archived";
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
}

export function NewPostDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const { run, pending, fieldErrors } = useAction(createPost);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New post
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New post</DialogTitle>
          <DialogDescription>It starts as a draft.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run({ title });
          }}
        >
          <Field>
            <FieldLabel htmlFor="post-new-title">Title</FieldLabel>
            <Input id="post-new-title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} autoFocus />
            <FieldError>{fieldErrors.title?.[0]}</FieldError>
          </Field>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={pending || !title.trim()}>
              {pending ? "Creating…" : "Create post"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PostEditor({ post, existingCategories }: { post: PostDetail; existingCategories: string[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [body, setBody] = useState(post.body ?? "");
  const [cover, setCover] = useState(post.cover_image_url ?? "");
  const [scheduleAt, setScheduleAt] = useState(post.status === "scheduled" ? toLocalInput(post.published_at) : "");
  const { run, pending, fieldErrors } = useAction(savePost, { onSuccess: () => router.refresh() });

  const submit = (intent: "draft" | "publish" | "schedule" | "archive") => {
    const form = formRef.current;
    if (!form || !form.reportValidity()) return;
    const f = new FormData(form);
    void run({
      id: post.id,
      title: String(f.get("title") ?? ""),
      slug: String(f.get("slug") ?? ""),
      excerpt: String(f.get("excerpt") ?? ""),
      body,
      cover_image_url: cover,
      author_name: String(f.get("author_name") ?? ""),
      category: String(f.get("category") ?? ""),
      tags: String(f.get("tags") ?? ""),
      intent,
      publish_at: scheduleAt ? new Date(scheduleAt).toISOString() : "",
      seo_title: String(f.get("seo_title") ?? ""),
      seo_description: String(f.get("seo_description") ?? ""),
    });
  };

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        submit(post.status === "published" ? "publish" : "draft");
      }}
      className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]"
    >
      <Card>
        <CardContent className="pt-6">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="post-title">Title</FieldLabel>
              <Input id="post-title" name="title" defaultValue={post.title} required maxLength={200} className="text-base" />
              <FieldError>{fieldErrors.title?.[0]}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="post-excerpt">Excerpt</FieldLabel>
              <Textarea id="post-excerpt" name="excerpt" rows={2} maxLength={600} defaultValue={post.excerpt ?? ""} />
              <FieldDescription>Shown on the blog list and in search results.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Article</FieldLabel>
              <RichTextEditor value={body} onChange={setBody} minHeight={420} ariaLabel="Article body" />
              <FieldError>{fieldErrors.body?.[0]}</FieldError>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <div className="grid h-fit gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              Publishing <StatusBadge status={post.status} />
            </CardTitle>
            {post.published_at ? (
              <CardDescription>
                {post.status === "scheduled" ? "Goes live " : "Published "}
                <LocalTime value={post.published_at} />
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button type="button" onClick={() => submit("publish")} disabled={pending}>
              <Send /> {post.status === "published" ? "Update post" : "Publish now"}
            </Button>
            <Field>
              <FieldLabel htmlFor="post-schedule">Schedule for later</FieldLabel>
              <div className="flex gap-2">
                <Input id="post-schedule" type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
                <Button type="button" variant="outline" onClick={() => submit("schedule")} disabled={pending || !scheduleAt}>
                  <CalendarClock /> Schedule
                </Button>
              </div>
              <FieldDescription>In your local time.</FieldDescription>
              <FieldError>{fieldErrors.publish_at?.[0]}</FieldError>
            </Field>
            <div className="flex flex-wrap gap-2 border-t pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => submit("draft")} disabled={pending}>
                {post.status === "published" ? "Unpublish to draft" : "Save draft"}
              </Button>
              {post.status !== "archived" ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => submit("archive")} disabled={pending}>
                  <Archive /> Archive
                </Button>
              ) : null}
              <ConfirmAction
                trigger={
                  <Button type="button" variant="ghost" size="sm" className="text-destructive">
                    <Trash2 /> Delete
                  </Button>
                }
                title="Delete this post?"
                description="It will be removed from the website and deleted permanently."
                confirmLabel="Delete post"
                destructive
                action={() => deletePost({ id: post.id })}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="post-slug">URL slug</FieldLabel>
                <Input id="post-slug" name="slug" defaultValue={post.slug} />
                <FieldError>{fieldErrors.slug?.[0]}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="post-author">Author name</FieldLabel>
                <Input id="post-author" name="author_name" defaultValue={post.author_name ?? ""} maxLength={120} />
              </Field>
              <Field>
                <FieldLabel htmlFor="post-category">Category</FieldLabel>
                <Input id="post-category" name="category" defaultValue={post.category ?? ""} list="post-categories" maxLength={60} />
                <datalist id="post-categories">
                  {existingCategories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field>
                <FieldLabel htmlFor="post-tags">Tags</FieldLabel>
                <Input id="post-tags" name="tags" defaultValue={(post.tags ?? []).join(", ")} placeholder="shopify, seo" />
                <FieldDescription>Separate with commas.</FieldDescription>
              </Field>
            </FieldGroup>
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
            <CardTitle>Search engines</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="post-seo-title">SEO title</FieldLabel>
                <Input id="post-seo-title" name="seo_title" maxLength={70} defaultValue={post.seo_title ?? ""} />
              </Field>
              <Field>
                <FieldLabel htmlFor="post-seo-desc">SEO description</FieldLabel>
                <Textarea id="post-seo-desc" name="seo_description" rows={3} maxLength={170} defaultValue={post.seo_description ?? ""} />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
