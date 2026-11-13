"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Download, FileIcon, Link2, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { FileUpload } from "@/components/common/file-upload";
import { ConfirmAction } from "@/components/common/confirm-action";
import { useAction } from "@/hooks/use-action";
import { formatBytes } from "@/lib/format";
import { deleteResource, reorderResources, saveResource } from "@/lib/services/courses/actions/blocks";
import type { LessonResourceRow, MediaFileSummary } from "@/lib/services/courses/builder";
import { FormRow, SwitchRow, fieldError } from "./form-bits";

function ResourceDialog({
  courseId,
  lessonId,
  resource,
  onClose,
}: {
  courseId: string;
  lessonId: string;
  resource: LessonResourceRow | null;
  onClose: () => void;
}) {
  const [type, setType] = useState<"file" | "link">(resource?.resource_type ?? "file");
  const [title, setTitle] = useState(resource?.title ?? "");
  const [description, setDescription] = useState(resource?.description ?? "");
  const [url, setUrl] = useState(resource?.url ?? "");
  const [file, setFile] = useState<MediaFileSummary | null>(resource?.file ?? null);
  const [downloadable, setDownloadable] = useState(resource?.is_downloadable ?? true);
  const save = useAction(saveResource, { onSuccess: onClose });

  return (
    <Dialog open onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <form
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void save.run({
              courseId,
              lessonId,
              resourceId: resource?.id,
              title,
              description: description || null,
              resource_type: type,
              media_file_id: type === "file" ? (file?.id ?? null) : null,
              url: type === "link" ? url : null,
              is_downloadable: downloadable,
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{resource ? "Edit resource" : "Add a resource"}</DialogTitle>
            <DialogDescription>Templates, worksheets and useful links for this lesson.</DialogDescription>
          </DialogHeader>
          <RadioGroup value={type} onValueChange={(v) => setType(v as "file" | "link")} className="grid grid-cols-2 gap-2">
            <Label className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-sm font-normal">
              <RadioGroupItem value="file" /> File
            </Label>
            <Label className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-sm font-normal">
              <RadioGroupItem value="link" /> Link
            </Label>
          </RadioGroup>
          <FormRow label="Name" error={fieldError(save.fieldErrors, "title")}>
            <Input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Product research checklist" />
          </FormRow>
          {type === "file" ? (
            <FormRow label="File" error={fieldError(save.fieldErrors, "resource_type")}>
              {file ? (
                <p className="rounded-lg border bg-card px-3 py-2 text-sm">
                  {file.file_name} <span className="text-muted-foreground">· {formatBytes(file.size_bytes)}</span>
                </p>
              ) : null}
              <FileUpload
                purpose="course_content"
                context={{ courseId }}
                label={file ? "Replace file" : "Upload a file"}
                onUploaded={(f) => {
                  setFile({ id: f.id, file_name: f.fileName, mime_type: f.mimeType, size_bytes: f.size, status: "ready" });
                  if (!title) setTitle(f.fileName.replace(/\.[^.]+$/, ""));
                }}
              />
            </FormRow>
          ) : (
            <FormRow label="Address" error={fieldError(save.fieldErrors, "url") ?? fieldError(save.fieldErrors, "resource_type")}>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
            </FormRow>
          )}
          <FormRow label="Description" optional>
            <Textarea rows={2} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormRow>
          {type === "file" ? <SwitchRow label="Students can download it" checked={downloadable} onCheckedChange={setDownloadable} /> : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.pending || !title.trim() || (type === "file" ? !file : !url.trim())}>
              {save.pending ? <Loader2 className="animate-spin" /> : null}
              {resource ? "Save resource" : "Add resource"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ResourceManager({
  courseId,
  lessonId,
  resources,
  canEdit,
}: {
  courseId: string;
  lessonId: string;
  resources: LessonResourceRow[];
  canEdit: boolean;
}) {
  const [dialog, setDialog] = useState<{ open: boolean; resource: LessonResourceRow | null }>({ open: false, resource: null });
  const reorder = useAction(reorderResources, { silent: true });
  const move = (index: number, dir: -1 | 1) => {
    const ids = resources.map((r) => r.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    void reorder.run({ courseId, lessonId, resourceIds: ids });
  };

  return (
    <section className="grid gap-3 rounded-2xl border bg-card p-4 sm:p-5" aria-labelledby="lesson-resources">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="lesson-resources" className="text-base font-semibold">
            Lesson resources
          </h2>
          <p className="text-sm text-muted-foreground">Shown beside the lesson and wherever you add a Resources block.</p>
        </div>
        {canEdit ? (
          <Button variant="outline" onClick={() => setDialog({ open: true, resource: null })}>
            <Plus /> Add resource
          </Button>
        ) : null}
      </div>
      {resources.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">No resources yet.</p>
      ) : (
        <ul className="grid gap-2">
          {resources.map((r, i) => (
            <li key={r.id} className="flex items-center gap-3 rounded-xl border px-3 py-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                {r.resource_type === "file" ? <FileIcon className="size-4" /> : <Link2 className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.resource_type === "file"
                    ? r.file
                      ? `${r.file.file_name} · ${formatBytes(r.file.size_bytes)}${r.is_downloadable ? "" : " · view only"}`
                      : "File unavailable"
                    : r.url}
                </p>
              </div>
              <div className="flex shrink-0 items-center">
                {r.resource_type === "file" && r.media_file_id ? (
                  <Button asChild variant="ghost" size="icon-sm" aria-label={`Download ${r.title}`}>
                    <a href={`/api/files/${r.media_file_id}?download=1`}>
                      <Download />
                    </a>
                  </Button>
                ) : null}
                {canEdit ? (
                  <>
                    <Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0 || reorder.pending} onClick={() => move(i, -1)}>
                      <ArrowUp />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Move down"
                      disabled={i === resources.length - 1 || reorder.pending}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${r.title}`} onClick={() => setDialog({ open: true, resource: r })}>
                      <Pencil />
                    </Button>
                    <ConfirmAction
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${r.title}`} className="text-muted-foreground hover:text-destructive">
                          <Trash2 />
                        </Button>
                      }
                      title={`Delete “${r.title}”?`}
                      description={r.resource_type === "file" ? "The file is deleted from storage unless another lesson uses it." : undefined}
                      confirmLabel="Delete resource"
                      destructive
                      action={() => deleteResource({ courseId, resourceId: r.id })}
                    />
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {dialog.open ? (
        <ResourceDialog
          key={dialog.resource?.id ?? "new"}
          courseId={courseId}
          lessonId={lessonId}
          resource={dialog.resource}
          onClose={() => setDialog({ open: false, resource: null })}
        />
      ) : null}
    </section>
  );
}
