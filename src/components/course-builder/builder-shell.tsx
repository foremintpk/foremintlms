import Link from "next/link";
import { CalendarClock, ChevronLeft, Eye, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";
import { LocalTime } from "@/components/common/local-time";
import type { BuilderContext } from "@/lib/services/courses/builder";
import { BuilderTabs, type BuilderTab } from "./builder-tabs";

export function builderTabs(ctx: BuilderContext): BuilderTab[] {
  const base = ctx.courseBase;
  const tabs: BuilderTab[] = [
    { href: base, label: "Details", exact: true },
    { href: `${base}/curriculum`, label: "Curriculum" },
    { href: `${base}/quizzes`, label: "Quizzes" },
    { href: `${base}/assignments`, label: "Assignments" },
  ];
  if (ctx.area === "admin") tabs.push({ href: `${base}/instructors`, label: "Instructors" });
  tabs.push({ href: `${base}/review`, label: "Review & publish" });
  if (ctx.area === "admin") {
    tabs.push({ href: `/admin/pricing?course=${ctx.course.id}`, label: "Pricing", external: true });
    tabs.push({ href: `/admin/live?course=${ctx.course.id}`, label: "Live classes", external: true });
  } else {
    tabs.push({ href: `/teach/live?course=${ctx.course.id}`, label: "Live classes", external: true });
    tabs.push({ href: `/teach/students?course=${ctx.course.id}`, label: "Students", external: true });
  }
  return tabs;
}

/** Header and section tabs shared by every course-builder page. */
export function BuilderShell({ ctx, children }: { ctx: BuilderContext; children: React.ReactNode }) {
  const { course } = ctx;
  const scheduled = course.status === "in_review" && course.scheduled_publish_at;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Link
          href={ctx.basePath}
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> All courses
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={course.status} />
              {course.is_featured ? <StatusBadge status="featured" label="Featured" tone="brand" /> : null}
              {course.visibility !== "public" ? <StatusBadge status={course.visibility} label={course.visibility === "unlisted" ? "Unlisted" : "Private"} tone="neutral" /> : null}
              {scheduled ? (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarClock className="size-3.5" /> Publishes <LocalTime value={course.scheduled_publish_at} format="weekday" />
                </span>
              ) : null}
            </div>
            <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{course.title}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="lg">
              <Link href={`/learn/courses/${course.slug}`} target="_blank" rel="noopener">
                <Eye /> Preview as student
              </Link>
            </Button>
            {course.status === "published" ? (
              <Button asChild variant="outline" size="lg">
                <Link href={`/courses/${course.slug}`} target="_blank" rel="noopener">
                  <Globe /> View public page
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
        <BuilderTabs tabs={builderTabs(ctx)} />
      </div>
      {children}
    </div>
  );
}
