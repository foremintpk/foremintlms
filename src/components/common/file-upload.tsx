"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FileUp, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

export type UploadPurpose =
  | "course_content"
  | "course_image"
  | "category_image"
  | "marketing"
  | "avatar"
  | "submission"
  | "message_attachment"
  | "ticket_attachment"
  | "live_resource"
  | "document";

export interface UploadedFile {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  publicUrl: string | null;
}

interface UploadState {
  key: string;
  name: string;
  size: number;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
  result?: UploadedFile;
}

/** Upload one file: sign → PUT with progress → verify. */
export async function uploadFile(
  file: File,
  purpose: UploadPurpose,
  context: Record<string, string | undefined>,
  onProgress?: (pct: number) => void,
): Promise<UploadedFile> {
  const signRes = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      purpose,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      context,
    }),
  });
  const signed = await signRes.json();
  if (!signRes.ok) throw new Error(signed.error ?? "Upload failed.");

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signed.signedUrl);
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "max-age=3600");
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (key) xhr.setRequestHeader("apikey", key);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload failed. Try again.")));
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(file);
  });

  const doneRes = await fetch("/api/uploads/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mediaFileId: signed.mediaFileId }),
  });
  const done = await doneRes.json();
  if (!doneRes.ok) throw new Error(done.error ?? "Upload could not be verified.");
  return done as UploadedFile;
}

/**
 * Drag-and-drop uploader with per-file progress. Files go straight to
 * Supabase Storage via signed URLs; the server validates type, size and
 * permission before signing and verifies the bytes afterwards.
 */
export function FileUpload({
  purpose,
  context = {},
  accept,
  multiple = false,
  maxFiles = 5,
  label = "Upload a file",
  hint,
  onUploaded,
  className,
  disabled,
}: {
  purpose: UploadPurpose;
  context?: Record<string, string | undefined>;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  label?: string;
  hint?: string;
  onUploaded: (file: UploadedFile) => void;
  className?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadState[]>([]);
  const [dragging, setDragging] = useState(false);

  const start = (files: FileList | File[]) => {
    const list = Array.from(files).slice(0, multiple ? maxFiles : 1);
    for (const file of list) {
      const key = `${file.name}-${file.size}-${file.lastModified}`;
      setItems((prev) => [...prev.filter((p) => p.key !== key), { key, name: file.name, size: file.size, progress: 0, status: "uploading" }]);
      uploadFile(file, purpose, context, (pct) =>
        setItems((prev) => prev.map((p) => (p.key === key ? { ...p, progress: pct } : p))),
      )
        .then((result) => {
          setItems((prev) => prev.map((p) => (p.key === key ? { ...p, progress: 100, status: "done", result } : p)));
          onUploaded(result);
        })
        .catch((err: Error) => {
          setItems((prev) => prev.map((p) => (p.key === key ? { ...p, status: "error", error: err.message } : p)));
        });
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled && e.dataTransfer.files.length) start(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center transition-colors",
          dragging ? "border-primary bg-brand-soft/60" : "bg-muted/30",
          disabled && "opacity-60",
        )}
      >
        <FileUp className="size-6 text-muted-foreground" aria-hidden />
        <div className="text-sm">
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 font-semibold"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            {label}
          </Button>{" "}
          <span className="text-muted-foreground">or drag it here</span>
        </div>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={(e) => {
            if (e.target.files?.length) start(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {items.length > 0 ? (
        <ul className="space-y-2" aria-live="polite">
          {items.map((item) => (
            <li key={item.key} className="rounded-lg border bg-card px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                {item.status === "uploading" ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : item.status === "done" ? (
                  <CheckCircle2 className="size-4 text-success" />
                ) : (
                  <X className="size-4 text-destructive" />
                )}
                <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{formatBytes(item.size)}</span>
                {item.status !== "uploading" ? (
                  <button
                    type="button"
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                    aria-label={`Dismiss ${item.name}`}
                    onClick={() => setItems((prev) => prev.filter((p) => p.key !== item.key))}
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </div>
              {item.status === "uploading" ? <Progress value={item.progress} className="mt-2 h-1.5" /> : null}
              {item.status === "error" ? <p className="mt-1 text-xs text-destructive">{item.error}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
