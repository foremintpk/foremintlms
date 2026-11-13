import Link from "next/link";
import { CheckCircle2, CircleHelp, EyeOff, Lock, Megaphone, MessageCircle, Pin } from "lucide-react";
import { LocalTime } from "@/components/common/local-time";
import { cn } from "@/lib/utils";
import type { DiscussionSummary } from "@/lib/services/discussions";
import { PersonAvatar, RoleBadge } from "../person";

export function DiscussionBadges({ d }: { d: Pick<DiscussionSummary, "kind" | "isPinned" | "isLocked" | "isResolved" | "answeredAt" | "status"> }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {d.isPinned ? (
        <span className="inline-flex h-5 items-center gap-1 rounded-full bg-brand-soft px-2 text-[11px] font-medium text-primary">
          <Pin className="size-3" /> Pinned
        </span>
      ) : null}
      {d.kind === "announcement" ? (
        <span className="inline-flex h-5 items-center gap-1 rounded-full bg-info-soft px-2 text-[11px] font-medium text-info">
          <Megaphone className="size-3" /> Announcement
        </span>
      ) : null}
      {d.kind === "question" ? (
        d.isResolved ? (
          <span className="inline-flex h-5 items-center gap-1 rounded-full bg-success-soft px-2 text-[11px] font-medium text-success">
            <CheckCircle2 className="size-3" /> Resolved
          </span>
        ) : d.answeredAt ? (
          <span className="inline-flex h-5 items-center gap-1 rounded-full bg-success-soft px-2 text-[11px] font-medium text-success">
            <CheckCircle2 className="size-3" /> Answered
          </span>
        ) : (
          <span className="inline-flex h-5 items-center gap-1 rounded-full bg-warning-soft px-2 text-[11px] font-medium text-warning">
            <CircleHelp className="size-3" /> Unanswered
          </span>
        )
      ) : null}
      {d.isLocked ? (
        <span className="inline-flex h-5 items-center gap-1 rounded-full bg-muted px-2 text-[11px] font-medium text-muted-foreground">
          <Lock className="size-3" /> Locked
        </span>
      ) : null}
      {d.status === "hidden" ? (
        <span className="inline-flex h-5 items-center gap-1 rounded-full bg-muted px-2 text-[11px] font-medium text-muted-foreground">
          <EyeOff className="size-3" /> Hidden
        </span>
      ) : null}
    </span>
  );
}

export function DiscussionListItem({ d, href, showLesson = true }: { d: DiscussionSummary; href: string; showLesson?: boolean }) {
  return (
    <li>
      <Link href={href} className={cn("flex gap-3 p-4 transition-colors hover:bg-muted/50 sm:gap-4", d.status === "hidden" && "opacity-70")}>
        <PersonAvatar person={d.author} className="mt-0.5 size-9 max-sm:hidden" />
        <div className="min-w-0 flex-1">
          <DiscussionBadges d={d} />
          <h3 className="mt-1 line-clamp-2 text-[0.95rem] leading-snug font-semibold text-foreground">{d.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{d.preview}</p>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{d.author.name}</span>
            <RoleBadge role={d.author.role} className="h-4 px-1.5 text-[10px]" />
            {showLesson && d.lessonTitle ? <span className="truncate">in {d.lessonTitle}</span> : null}
            <span>
              Active <LocalTime value={d.lastActivityAt} format="relative" />
            </span>
          </p>
        </div>
        <span className="flex shrink-0 items-start gap-1 pt-1 text-sm text-muted-foreground tabular-nums" aria-label={`${d.replyCount} replies`}>
          <MessageCircle className="size-4" /> {d.replyCount}
        </span>
      </Link>
    </li>
  );
}
