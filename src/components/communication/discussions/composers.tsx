"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTrackedTransition } from "@/hooks/use-tracked-transition";
import { MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { createDiscussionAction, createReplyAction } from "./actions";
import { liveMentionIds, MentionTextarea, type Mention } from "./mention-textarea";

type Kind = "discussion" | "question" | "announcement";

export function NewDiscussionDialog({
  courseId,
  lessons,
  isStaff,
  defaultLessonId = null,
  defaultKind = "question",
  triggerLabel = "Start a discussion",
}: {
  courseId: string;
  lessons: { id: string; title: string }[];
  isStaff: boolean;
  defaultLessonId?: string | null;
  defaultKind?: Kind;
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>(defaultKind);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [lessonId, setLessonId] = useState<string>(defaultLessonId ?? "none");
  const [pinned, setPinned] = useState(false);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTrackedTransition();

  const submit = () =>
    startTransition(async () => {
      const res = await createDiscussionAction({
        courseId,
        title,
        body,
        kind,
        lessonId: lessonId === "none" ? null : lessonId,
        isPinned: isStaff ? pinned : false,
        mentionIds: liveMentionIds(body, mentions),
      });
      if (res.ok) {
        toast.success(res.message ?? "Posted");
        setOpen(false);
        setTitle("");
        setBody("");
        setMentions([]);
        router.push(res.data.url);
      } else {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <MessageSquarePlus className="size-4" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{kind === "question" ? "Ask a question" : kind === "announcement" ? "Post an announcement" : "Start a discussion"}</DialogTitle>
          <DialogDescription>Everyone enrolled in this course can read and reply.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="discussion-kind">Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
                <SelectTrigger id="discussion-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="question">Question</SelectItem>
                  <SelectItem value="discussion">Discussion</SelectItem>
                  {isStaff ? <SelectItem value="announcement">Announcement</SelectItem> : null}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="discussion-lesson">Lesson (optional)</Label>
              <Select value={lessonId} onValueChange={setLessonId}>
                <SelectTrigger id="discussion-lesson" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Whole course</SelectItem>
                  {lessons.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="discussion-title">Title</Label>
            <Input
              id="discussion-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder={kind === "question" ? "What do you want to know?" : "What's this about?"}
              aria-invalid={Boolean(errors.title)}
            />
            {errors.title ? <p className="text-xs text-destructive">{errors.title[0]}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="discussion-body">Details</Label>
            <MentionTextarea
              id="discussion-body"
              courseId={courseId}
              value={body}
              onChange={setBody}
              mentions={mentions}
              onMentionsChange={setMentions}
              rows={6}
              placeholder="Share context: what you tried, where you got stuck, links or examples."
            />
            {errors.body ? <p className="text-xs text-destructive">{errors.body[0]}</p> : null}
          </div>
          {isStaff ? (
            <div className="flex items-center gap-2">
              <Switch id="discussion-pin" checked={pinned} onCheckedChange={setPinned} />
              <Label htmlFor="discussion-pin" className="font-normal">
                Pin to the top of the discussions
              </Label>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || title.trim().length < 3 || !body.trim()}>
              {pending ? "Posting…" : kind === "question" ? "Post question" : kind === "announcement" ? "Post announcement" : "Post discussion"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReplyComposer({
  courseId,
  discussionId,
  parentReplyId = null,
  placeholder = "Write a reply",
  autoFocus,
  onDone,
  submitLabel = "Post reply",
  rows = 3,
}: {
  courseId: string;
  discussionId: string;
  parentReplyId?: string | null;
  placeholder?: string;
  autoFocus?: boolean;
  onDone?: () => void;
  submitLabel?: string;
  rows?: number;
}) {
  const [body, setBody] = useState("");
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [pending, startTransition] = useTrackedTransition();

  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await createReplyAction({ discussionId, parentReplyId, body, mentionIds: liveMentionIds(body, mentions) });
          if (res.ok) {
            toast.success(res.message ?? "Reply posted");
            setBody("");
            setMentions([]);
            onDone?.();
          } else toast.error(res.error);
        });
      }}
    >
      <MentionTextarea
        courseId={courseId}
        value={body}
        onChange={setBody}
        mentions={mentions}
        onMentionsChange={setMentions}
        rows={rows}
        placeholder={placeholder}
        ariaLabel={placeholder}
        autoFocus={autoFocus}
      />
      <div className="flex justify-end gap-2">
        {onDone && parentReplyId ? (
          <Button type="button" variant="ghost" size="sm" onClick={onDone} disabled={pending}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={pending || !body.trim()}>
          {pending ? "Posting…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** Compact "ask about this lesson" form used under the lesson player. */
export function AskLessonQuestionForm({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [pending, startTransition] = useTrackedTransition();

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <MessageSquarePlus className="size-4" /> Ask about this lesson
      </Button>
    );
  }

  return (
    <form
      className="grid gap-3 rounded-xl border bg-muted/30 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await createDiscussionAction({
            courseId,
            lessonId,
            kind: "question",
            title,
            body,
            mentionIds: liveMentionIds(body, mentions),
          });
          if (res.ok) {
            toast.success("Question posted");
            setTitle("");
            setBody("");
            setMentions([]);
            setOpen(false);
            router.refresh();
          } else toast.error(res.error);
        });
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor={`ask-${lessonId}`}>Your question</Label>
        <Input id={`ask-${lessonId}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="e.g. How do I choose a product category?" autoFocus />
      </div>
      <MentionTextarea courseId={courseId} value={body} onChange={setBody} mentions={mentions} onMentionsChange={setMentions} rows={3} placeholder="Add details" ariaLabel="Question details" />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending || title.trim().length < 3 || !body.trim()}>
          {pending ? "Posting…" : "Post question"}
        </Button>
      </div>
    </form>
  );
}
