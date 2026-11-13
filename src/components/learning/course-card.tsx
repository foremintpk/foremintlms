import Image from "next/image";
import Link from "next/link";
import { BookOpen, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";
import { LocalTime } from "@/components/common/local-time";
import type { LearnerCourseCard } from "@/lib/services/learner";
import { ProgressBar } from "./progress-bar";

const ACCESS_LABEL: Record<string, string> = {
  expired: "Access ended",
  revoked: "Access revoked",
  suspended: "Access paused",
  course_unavailable: "Unavailable",
  none: "No access",
};

export function CourseThumb({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  return (
    <div className={`relative aspect-[16/9] overflow-hidden bg-brand-soft ${className ?? ""}`}>
      {src ? (
        <Image src={src} alt={alt} fill sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw" className="object-cover" />
      ) : (
        <div className="grid size-full place-items-center text-primary">
          <BookOpen className="size-8" aria-hidden />
        </div>
      )}
    </div>
  );
}

export function LearnerCourseCardView({ card }: { card: LearnerCourseCard }) {
  const href = card.access.hasAccess
    ? card.lastLessonId && card.bucket === "active"
      ? `/learn/courses/${card.slug}/lessons/${card.lastLessonId}`
      : `/learn/courses/${card.slug}`
    : `/learn/courses/${card.slug}`;
  const cta = !card.access.hasAccess
    ? card.access.reason === "expired"
      ? "Renew access"
      : "View course"
    : card.bucket === "completed"
      ? "Review course"
      : card.progressPercent > 0
        ? "Continue"
        : "Start course";

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-card transition-colors hover:border-primary/30">
      <Link href={`/learn/courses/${card.slug}`} tabIndex={-1} aria-hidden>
        <CourseThumb src={card.thumbnailUrl} alt="" />
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 font-heading text-base leading-snug font-semibold">
            <Link href={`/learn/courses/${card.slug}`} className="outline-none hover:text-primary focus-visible:underline">
              {card.title}
            </Link>
          </h3>
          {card.bucket === "completed" ? (
            <StatusBadge status="completed" />
          ) : !card.access.hasAccess ? (
            <StatusBadge status={card.access.reason === "revoked" ? "revoked" : "expired"} label={ACCESS_LABEL[card.access.reason]} />
          ) : null}
        </div>
        {card.instructors.length ? <p className="text-sm text-muted-foreground">{card.instructors.join(", ")}</p> : null}
        <div className="mt-auto space-y-2">
          <ProgressBar value={card.progressPercent} label={`${card.title} progress`} />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="tabular-nums">
              {card.completedLessons} of {card.totalLessons} lessons
            </span>
            <span className="tabular-nums">{Math.round(card.progressPercent)}%</span>
          </div>
          {card.access.hasAccess && card.access.expiresAt ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarClock className="size-3.5" aria-hidden /> Access until <LocalTime value={card.access.expiresAt} format="date" />
            </p>
          ) : null}
        </div>
        <Button asChild size="sm" variant={card.access.hasAccess ? "default" : "outline"} className="mt-1 w-full">
          <Link href={!card.access.hasAccess && card.access.reason === "expired" ? `/courses/${card.slug}#pricing` : href}>{cta}</Link>
        </Button>
      </div>
    </article>
  );
}
