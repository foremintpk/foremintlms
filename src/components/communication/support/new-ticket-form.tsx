"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTrackedTransition } from "@/hooks/use-tracked-transition";
import { Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload, type UploadedFile } from "@/components/common/file-upload";
import { CATEGORY_LABEL, TICKET_CATEGORIES, type TicketCategory } from "../lib/tickets";
import { createTicketAction } from "./actions";

export function NewTicketForm({
  courses,
  basePath,
  defaultCategory = "general",
  defaultCourseId = null,
}: {
  courses: { id: string; title: string }[];
  basePath: string;
  defaultCategory?: TicketCategory;
  defaultCourseId?: string | null;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TicketCategory>(defaultCategory);
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
  const [courseId, setCourseId] = useState<string>(defaultCourseId ?? "none");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTrackedTransition();

  const submit = () =>
    startTransition(async () => {
      const res = await createTicketAction({
        subject,
        description,
        category,
        priority,
        courseId: courseId === "none" ? null : courseId,
        attachmentIds: files.map((f) => f.id),
      });
      if (res.ok) {
        toast.success(res.message ?? "Ticket created");
        router.push(`${basePath}/${res.data.id}`);
      } else {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
      }
    });

  return (
    <form
      className="grid gap-5 rounded-2xl border bg-card p-5 shadow-card sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="ticket-subject">Subject</Label>
        <Input
          id="ticket-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          placeholder="e.g. I can't open lesson 3 of Shopify Store Launch"
          aria-invalid={Boolean(errors.subject)}
          required
        />
        {errors.subject ? <p className="text-xs text-destructive">{errors.subject[0]}</p> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="ticket-category">Topic</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as TicketCategory)}>
            <SelectTrigger id="ticket-category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TICKET_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ticket-priority">Priority</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as "low" | "normal" | "high")}>
            <SelectTrigger id="ticket-priority" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low — whenever you can</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">High — I’m blocked</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ticket-course">Course (optional)</Label>
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger id="ticket-course" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not about a course</SelectItem>
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {(category === "course_content" || category === "certificate") && courseId === "none" ? (
        <p className="-mt-2 text-xs text-muted-foreground">Choose the course so its instructor can help too.</p>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="ticket-description">What happened?</Label>
        <Textarea
          id="ticket-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={7}
          maxLength={20_000}
          placeholder="Describe what you were doing, what you expected and what happened instead. Include any error message you saw."
          aria-invalid={Boolean(errors.description)}
          required
        />
        {errors.description ? <p className="text-xs text-destructive">{errors.description[0]}</p> : null}
      </div>

      <div className="grid gap-2">
        <Label>Attachments (optional)</Label>
        <FileUpload
          purpose="ticket_attachment"
          multiple
          maxFiles={5}
          label="Add screenshots or files"
          hint="Up to 5 files — screenshots help us fix things faster."
          onUploaded={(f) => setFiles((prev) => (prev.length >= 5 ? prev : [...prev, f]))}
        />
        {files.length ? (
          <ul className="flex flex-wrap gap-2">
            {files.map((f) => (
              <li key={f.id} className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs">
                <Paperclip className="size-3" />
                <span className="max-w-48 truncate">{f.fileName}</span>
                <button type="button" aria-label={`Remove ${f.fileName}`} onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))}>
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push(basePath)} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || subject.trim().length < 3 || description.trim().length < 10}>
          {pending ? "Creating ticket…" : "Create ticket"}
        </Button>
      </div>
    </form>
  );
}
