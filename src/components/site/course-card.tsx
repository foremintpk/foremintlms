import Link from "next/link";
import { BarChart2, Clock, PlayCircle } from "lucide-react";
import { formatDuration } from "@/lib/format";
import { LEVEL_LABEL } from "@/lib/services/public/shape";
import type { CourseCard as CourseCardData } from "@/lib/services/public/types";
import { cn } from "@/lib/utils";
import { MediaImage, RatingStars } from "./primitives";

export function CourseCard({ course, className, priority }: { course: CourseCardData; className?: string; priority?: boolean }) {
  const instructor = course.instructors.map((i) => i.public_name).join(", ");
  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card transition-[border-color,box-shadow] duration-200 hover:border-primary/30 hover:shadow-card",
        className,
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        <MediaImage
          src={course.thumbnail_url}
          alt=""
          priority={priority}
          sizes="(min-width: 1280px) 400px, (min-width: 768px) 45vw, 100vw"
          className="transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {course.is_featured ? (
          <span className="absolute top-3 left-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-semibold text-foreground backdrop-blur">
            Featured
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-5">
        {course.category ? <p className="text-sm font-medium text-primary">{course.category.name}</p> : null}
        <h3 className="mt-1.5 text-lg leading-snug font-semibold tracking-[-0.015em]">
          <Link href={`/courses/${course.slug}`} className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline">
            {course.title}
          </Link>
        </h3>
        {instructor ? <p className="mt-1 text-sm text-muted-foreground">with {instructor}</p> : null}
        {course.short_description ? (
          <p className="mt-3 line-clamp-2 text-[0.95rem] text-muted-foreground">{course.short_description}</p>
        ) : null}

        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
          {course.lessonCount > 0 ? (
            <li className="inline-flex items-center gap-1.5">
              <PlayCircle className="size-4" aria-hidden />
              {course.lessonCount} {course.lessonCount === 1 ? "lesson" : "lessons"}
            </li>
          ) : null}
          {course.durationMinutes ? (
            <li className="inline-flex items-center gap-1.5">
              <Clock className="size-4" aria-hidden />
              {formatDuration(course.durationMinutes)}
            </li>
          ) : null}
          <li className="inline-flex items-center gap-1.5">
            <BarChart2 className="size-4" aria-hidden />
            {LEVEL_LABEL[course.level]}
          </li>
        </ul>

        {course.rating ? <RatingStars value={course.rating.average} count={course.rating.count} className="mt-3" /> : null}

        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <div className="min-w-0">
            {course.priceLabel ? (
              <>
                <p className="text-lg font-semibold tracking-tight">{course.priceLabel}</p>
                {course.accessLabel ? <p className="text-xs text-muted-foreground">{course.accessLabel}</p> : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Enrollment opening soon</p>
            )}
          </div>
          <span
            aria-hidden
            className="inline-flex h-9 shrink-0 items-center rounded-lg border bg-background px-3 text-sm font-medium transition-colors group-hover:border-primary/40 group-hover:text-primary"
          >
            View course
          </span>
        </div>
      </div>
    </article>
  );
}

export function CourseGrid({ courses, className }: { courses: CourseCardData[]; className?: string }) {
  return (
    <div className={cn("grid gap-6 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {courses.map((c, i) => (
        <CourseCard key={c.id} course={c} priority={i < 3} />
      ))}
    </div>
  );
}
