"use client";

import { useState } from "react";
import { Link2, Paperclip, Plus, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload, type UploadedFile } from "@/components/common/file-upload";
import { useAction } from "@/hooks/use-action";
import { formatBytes } from "@/lib/format";
import { submitAssignmentAction } from "@/app/learn/courses/actions";

export function AssignmentForm({
  courseId,
  assignmentId,
  submissionTypes,
  allowedFileTypes,
  maxFiles,
  maxFileSizeMb,
  late,
}: {
  courseId: string;
  assignmentId: string;
  submissionTypes: string[];
  allowedFileTypes: string[];
  maxFiles: number;
  maxFileSizeMb: number;
  late: boolean;
}) {
  const allowText = submissionTypes.includes("text");
  const allowLinks = submissionTypes.includes("link");
  const allowFiles = submissionTypes.includes("file") && maxFiles > 0;
  const [text, setText] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [linkDraft, setLinkDraft] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const { run, pending, error } = useAction(submitAssignmentAction);

  const addLink = () => {
    const v = linkDraft.trim();
    if (!v) return;
    try {
      const u = new URL(v);
      if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
    } catch {
      return;
    }
    if (!links.includes(v) && links.length < 10) setLinks([...links, v]);
    setLinkDraft("");
  };

  const empty = !text.trim() && links.length === 0 && files.length === 0;

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        void run({ courseId, assignmentId, textBody: text.trim() || undefined, links, fileIds: files.map((f) => f.id) });
      }}
    >
      {allowText ? (
        <div className="grid gap-2">
          <Label htmlFor="submission-text">Your answer</Label>
          <Textarea id="submission-text" value={text} onChange={(e) => setText(e.target.value)} rows={8} maxLength={50000} placeholder="Write your response here" />
        </div>
      ) : null}

      {allowLinks ? (
        <div className="grid gap-2">
          <Label htmlFor="submission-link">Links</Label>
          <div className="flex gap-2">
            <Input
              id="submission-link"
              type="url"
              inputMode="url"
              value={linkDraft}
              onChange={(e) => setLinkDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addLink();
                }
              }}
              placeholder="https://"
            />
            <Button type="button" variant="outline" className="h-9 shrink-0" onClick={addLink} disabled={links.length >= 10}>
              <Plus /> Add
            </Button>
          </div>
          {links.length ? (
            <ul className="space-y-1.5">
              {links.map((l) => (
                <li key={l} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm">
                  <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{l}</span>
                  <Button type="button" variant="ghost" size="icon-xs" aria-label={`Remove ${l}`} onClick={() => setLinks(links.filter((x) => x !== l))}>
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {allowFiles ? (
        <div className="grid gap-2">
          <Label>Files</Label>
          <FileUpload
            purpose="submission"
            context={{ assignmentId }}
            multiple={maxFiles > 1}
            maxFiles={maxFiles}
            accept={allowedFileTypes.map((e) => `.${e}`).join(",")}
            hint={`Up to ${maxFiles} file${maxFiles === 1 ? "" : "s"}, ${maxFileSizeMb} MB each: ${allowedFileTypes.map((e) => `.${e}`).join(", ")}`}
            disabled={files.length >= maxFiles}
            onUploaded={(f) => setFiles((prev) => (prev.length >= maxFiles ? prev : [...prev, f]))}
          />
          {files.length ? (
            <ul className="space-y-1.5">
              {files.map((f) => (
                <li key={f.id} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm">
                  <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{f.fileName}</span>
                  <span className="text-xs text-muted-foreground">{formatBytes(f.size)}</span>
                  <Button type="button" variant="ghost" size="icon-xs" aria-label={`Remove ${f.fileName}`} onClick={() => setFiles(files.filter((x) => x.id !== f.id))}>
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {late ? <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">The deadline has passed — this will be marked as a late submission.</p> : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending || empty}>
        <Send /> {pending ? "Submitting…" : "Submit assignment"}
      </Button>
    </form>
  );
}
