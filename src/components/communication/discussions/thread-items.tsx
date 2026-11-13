"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  CheckCircle2,
  Ellipsis,
  EyeOff,
  Eye,
  Flag,
  Lock,
  LockOpen,
  MessageCircleReply,
  Pencil,
  Pin,
  PinOff,
  RotateCcw,
  ShieldX,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LocalTime } from "@/components/common/local-time";
import { cn } from "@/lib/utils";
import { PersonAvatar, RoleBadge, type PersonCard } from "../person";
import { PlainText } from "../plain-text";
import { ReportDialog } from "../report-dialog";
import {
  acceptAnswerAction,
  deleteDiscussionAction,
  deleteReplyAction,
  editDiscussionAction,
  editReplyAction,
  reportPostAction,
  staffDiscussionActionAction,
  staffReplyActionAction,
  toggleReactionAction,
} from "./actions";
import { ReplyComposer } from "./composers";

export const REACTION_META = {
  like: { emoji: "👍", label: "Like" },
  love: { emoji: "❤️", label: "Love" },
  insightful: { emoji: "💡", label: "Insightful" },
  celebrate: { emoji: "🎉", label: "Celebrate" },
  thanks: { emoji: "🙏", label: "Thanks" },
} as const;
export type ReactionKey = keyof typeof REACTION_META;

export function ReactionBar({
  courseId,
  discussionId,
  replyId,
  counts,
  mine,
  disabled,
}: {
  courseId: string;
  discussionId?: string;
  replyId?: string;
  counts: Partial<Record<ReactionKey, number>>;
  mine: ReactionKey[];
  disabled?: boolean;
}) {
  const [state, setState] = useState({ counts, mine });
  const [pending, startTransition] = useTransition();

  const toggle = (key: ReactionKey) => {
    const active = state.mine.includes(key);
    const prev = state;
    setState({
      counts: { ...state.counts, [key]: Math.max(0, (state.counts[key] ?? 0) + (active ? -1 : 1)) },
      mine: active ? state.mine.filter((k) => k !== key) : [...state.mine, key],
    });
    startTransition(async () => {
      const res = await toggleReactionAction({ courseId, discussionId: discussionId ?? null, replyId: replyId ?? null, emoji: key });
      if (!res.ok) {
        setState(prev);
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Reactions">
      {(Object.keys(REACTION_META) as ReactionKey[]).map((key) => {
        const count = state.counts[key] ?? 0;
        const active = state.mine.includes(key);
        if (count === 0 && !active && disabled) return null;
        return (
          <button
            key={key}
            type="button"
            disabled={disabled || pending}
            onClick={() => toggle(key)}
            aria-pressed={active}
            aria-label={`${REACTION_META[key].label}${count ? `, ${count}` : ""}`}
            title={REACTION_META[key].label}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-full border px-2 text-xs transition-colors disabled:cursor-default",
              active ? "border-primary/40 bg-brand-soft text-primary" : "bg-background text-muted-foreground hover:bg-muted",
              count === 0 && !active && "opacity-60 hover:opacity-100",
            )}
          >
            <span aria-hidden>{REACTION_META[key].emoji}</span>
            {count > 0 ? <span className="tabular-nums">{count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export interface DiscussionView {
  id: string;
  title: string;
  body: string;
  kind: "discussion" | "question" | "announcement";
  isPinned: boolean;
  isLocked: boolean;
  isResolved: boolean;
  status: "visible" | "hidden" | "removed";
}

export function DiscussionActions({
  discussion,
  courseId,
  isAuthor,
  isStaff,
  listHref,
}: {
  discussion: DiscussionView;
  courseId: string;
  isAuthor: boolean;
  isStaff: boolean;
  listHref: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(discussion.title);
  const [body, setBody] = useState(discussion.body);
  const [reporting, setReporting] = useState(false);
  const [pending, startTransition] = useTransition();

  const staff = (action: "pin" | "unpin" | "lock" | "unlock" | "hide" | "unhide" | "remove" | "resolve" | "reopen") =>
    startTransition(async () => {
      if (action === "remove" && !window.confirm("Remove this discussion for everyone? This can't be undone from the course page.")) return;
      const res = await staffDiscussionActionAction({ discussionId: discussion.id, action });
      if (res.ok) {
        toast.success(res.message ?? "Updated");
        if (action === "remove") router.push(listHref);
      } else toast.error(res.error);
    });

  const remove = () =>
    startTransition(async () => {
      if (!window.confirm("Delete this post and all of its replies?")) return;
      const res = await deleteDiscussionAction({ discussionId: discussion.id });
      if (res.ok) {
        toast.success(res.message ?? "Deleted");
        router.push(listHref);
      } else toast.error(res.error);
    });

  return (
    <>
      <div className="flex items-center gap-2">
        {discussion.kind === "question" && (isAuthor || isStaff) ? (
          <Button size="sm" variant={discussion.isResolved ? "outline" : "secondary"} disabled={pending} onClick={() => staff(discussion.isResolved ? "reopen" : "resolve")}>
            {discussion.isResolved ? <RotateCcw className="size-4" /> : <CheckCircle2 className="size-4" />}
            {discussion.isResolved ? "Reopen question" : "Mark resolved"}
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Discussion options" disabled={pending}>
              <Ellipsis className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {isAuthor ? (
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <Pencil /> Edit post
              </DropdownMenuItem>
            ) : null}
            {isAuthor ? (
              <DropdownMenuItem onSelect={remove} className="text-destructive focus:text-destructive">
                <Trash2 /> Delete post
              </DropdownMenuItem>
            ) : null}
            {!isAuthor ? (
              <DropdownMenuItem onSelect={() => setReporting(true)}>
                <Flag /> Report
              </DropdownMenuItem>
            ) : null}
            {isStaff ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">Moderation</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => staff(discussion.isPinned ? "unpin" : "pin")}>
                  {discussion.isPinned ? <PinOff /> : <Pin />} {discussion.isPinned ? "Unpin" : "Pin to top"}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => staff(discussion.isLocked ? "unlock" : "lock")}>
                  {discussion.isLocked ? <LockOpen /> : <Lock />} {discussion.isLocked ? "Unlock replies" : "Lock replies"}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => staff(discussion.status === "hidden" ? "unhide" : "hide")}>
                  {discussion.status === "hidden" ? <Eye /> : <EyeOff />} {discussion.status === "hidden" ? "Make visible" : "Hide from students"}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => staff("remove")} className="text-destructive focus:text-destructive">
                  <ShieldX /> Remove
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {editing ? (
        <form
          className="mt-4 grid w-full gap-3 rounded-xl border bg-muted/30 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const res = await editDiscussionAction({ discussionId: discussion.id, title, body });
              if (res.ok) {
                toast.success(res.message ?? "Saved");
                setEditing(false);
              } else toast.error(res.error);
            });
          }}
        >
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} aria-label="Title" />
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} aria-label="Details" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending || title.trim().length < 3 || !body.trim()}>
              Save changes
            </Button>
          </div>
        </form>
      ) : null}

      <ReportDialog
        open={reporting}
        onOpenChange={setReporting}
        what="post"
        onSubmit={async (input) => {
          const res = await reportPostAction({ targetType: "discussion", targetId: discussion.id, courseId, ...input });
          return res.ok ? { ok: true, message: res.message } : { ok: false, error: res.error };
        }}
      />
    </>
  );
}

export interface ReplyView {
  id: string;
  author: PersonCard;
  body: string;
  isInstructorAnswer: boolean;
  isAcceptedAnswer: boolean;
  status: "visible" | "hidden" | "removed";
  createdAt: string;
  updatedAt: string;
  reactions: Partial<Record<ReactionKey, number>>;
  myReactions: ReactionKey[];
  children: ReplyView[];
}

export function ReplyCard({
  reply,
  courseId,
  discussionId,
  meId,
  isStaff,
  canAccept,
  isQuestion,
  locked,
  nested = false,
}: {
  reply: ReplyView;
  courseId: string;
  discussionId: string;
  meId: string;
  isStaff: boolean;
  canAccept: boolean;
  isQuestion: boolean;
  locked: boolean;
  nested?: boolean;
}) {
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(reply.body);
  const [reporting, setReporting] = useState(false);
  const [pending, startTransition] = useTransition();
  const mine = reply.author.id === meId;
  const canReply = !locked || isStaff;

  const run = (fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>, confirmText?: string) =>
    startTransition(async () => {
      if (confirmText && !window.confirm(confirmText)) return;
      const res = await fn();
      if (res.ok) toast.success(res.message ?? "Done");
      else toast.error(res.error);
    });

  return (
    <article
      id={`reply-${reply.id}`}
      className={cn(
        "scroll-mt-24 rounded-2xl border bg-card p-4",
        reply.isAcceptedAnswer && "border-mint-strong/40 bg-mint-soft/40",
        reply.status === "hidden" && "border-dashed opacity-75",
        nested && "rounded-xl bg-background",
      )}
    >
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <PersonAvatar person={reply.author} className="size-8" />
        <span className="text-sm font-semibold">{reply.author.name}</span>
        <RoleBadge role={reply.author.role} />
        {reply.isAcceptedAnswer ? (
          <span className="inline-flex h-5 items-center gap-1 rounded-full bg-success-soft px-2 text-[11px] font-medium text-success">
            <CheckCircle2 className="size-3" /> Accepted answer
          </span>
        ) : reply.isInstructorAnswer && isQuestion ? (
          <span className="inline-flex h-5 items-center rounded-full bg-brand-soft px-2 text-[11px] font-medium text-primary">Instructor answer</span>
        ) : null}
        {reply.status === "hidden" ? <span className="text-[11px] font-medium text-warning">Hidden from students</span> : null}
        <span className="ml-auto text-xs text-muted-foreground">
          <LocalTime value={reply.createdAt} format="relative" />
          {reply.updatedAt !== reply.createdAt ? " · edited" : ""}
        </span>
      </header>

      <div className="mt-3 pl-10">
        {editing ? (
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                const res = await editReplyAction({ replyId: reply.id, body });
                if (res.ok) setEditing(false);
                return res;
              });
            }}
          >
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} aria-label="Edit reply" />
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={pending || !body.trim()}>
                Save
              </Button>
            </div>
          </form>
        ) : (
          <PlainText text={reply.body} />
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ReactionBar courseId={courseId} replyId={reply.id} counts={reply.reactions} mine={reply.myReactions} />
          <div className="ml-auto flex items-center gap-1">
            {!nested && canReply ? (
              <Button variant="ghost" size="sm" onClick={() => setReplying((v) => !v)}>
                <MessageCircleReply className="size-4" /> Reply
              </Button>
            ) : null}
            {isQuestion && canAccept && !mine ? (
              <Button
                variant={reply.isAcceptedAnswer ? "outline" : "ghost"}
                size="sm"
                disabled={pending}
                onClick={() => run(() => acceptAnswerAction({ replyId: reply.id, accept: !reply.isAcceptedAnswer }))}
              >
                <CheckCircle2 className="size-4" /> {reply.isAcceptedAnswer ? "Unaccept" : "Accept answer"}
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Reply options">
                  <Ellipsis className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {mine ? (
                  <>
                    <DropdownMenuItem onSelect={() => setEditing(true)}>
                      <Pencil /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() => run(() => deleteReplyAction({ replyId: reply.id }), "Delete this reply?")}
                    >
                      <Trash2 /> Delete
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem onSelect={() => setReporting(true)}>
                    <Flag /> Report
                  </DropdownMenuItem>
                )}
                {isStaff && !mine ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => run(() => staffReplyActionAction({ replyId: reply.id, action: reply.status === "hidden" ? "unhide" : "hide" }))}
                    >
                      {reply.status === "hidden" ? <Eye /> : <EyeOff />} {reply.status === "hidden" ? "Make visible" : "Hide from students"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() => run(() => staffReplyActionAction({ replyId: reply.id, action: "remove" }), "Remove this reply for everyone?")}
                    >
                      <ShieldX /> Remove
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {reply.children.length ? (
          <div className="mt-4 space-y-3 border-l-2 pl-4">
            {reply.children.map((child) => (
              <ReplyCard
                key={child.id}
                reply={child}
                courseId={courseId}
                discussionId={discussionId}
                meId={meId}
                isStaff={isStaff}
                canAccept={canAccept}
                isQuestion={isQuestion}
                locked={locked}
                nested
              />
            ))}
          </div>
        ) : null}

        {replying ? (
          <div className="mt-4 border-l-2 pl-4">
            <ReplyComposer
              courseId={courseId}
              discussionId={discussionId}
              parentReplyId={reply.id}
              autoFocus
              placeholder={`Reply to ${reply.author.name}`}
              onDone={() => setReplying(false)}
            />
          </div>
        ) : null}
      </div>

      <ReportDialog
        open={reporting}
        onOpenChange={setReporting}
        what="reply"
        onSubmit={async (input) => {
          const res = await reportPostAction({ targetType: "reply", targetId: reply.id, courseId, ...input });
          return res.ok ? { ok: true, message: res.message } : { ok: false, error: res.error };
        }}
      />
    </article>
  );
}
