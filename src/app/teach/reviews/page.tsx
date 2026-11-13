import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ListToolbar } from "@/components/common/list-toolbar";
import { LocalTime } from "@/components/common/local-time";
import { StatusBadge } from "@/components/common/status-badge";
import { requireTeacher } from "@/lib/auth/guards";
import { buildQueryString, parseListParams } from "@/lib/list-params";
import { getReviewQueue, getTeacherCourses } from "@/lib/services/teacher-analytics";
import { cn } from "@/lib/utils";

export const instant = false;
export const metadata = { title: "Reviews" };

export default async function TeachReviewsPage({ searchParams }: PageProps<"/teach/reviews">) {
  const user = await requireTeacher("/teach/reviews");
  const raw = await searchParams;
  const params = parseListParams(raw, { filterKeys: ["course", "kind", "scope"] });
  const scope = params.filters.scope === "reviewed" ? "reviewed" : "pending";
  const kind = params.filters.kind === "submission" || params.filters.kind === "quiz" ? params.filters.kind : undefined;
  const [courses, items] = await Promise.all([
    getTeacherCourses(user.id),
    getReviewQueue(user, { courseId: params.filters.course, kind, scope }),
  ]);

  return (
    <>
      <PageHeader title="Reviews" description="Assignment submissions and quiz answers that need your judgement, oldest first." />

      <nav aria-label="Review status" className="mb-4 flex gap-1 border-b">
        {(["pending", "reviewed"] as const).map((s) => (
          <Link
            key={s}
            href={`/teach/reviews${buildQueryString(raw, { scope: s === "pending" ? null : s })}`}
            aria-current={scope === s ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              scope === s ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {s === "pending" ? "Waiting for review" : "Recently reviewed"}
          </Link>
        ))}
      </nav>

      <ListToolbar
        filters={[
          { key: "course", label: "Courses", options: courses.map((c) => ({ value: c.id, label: c.title })) },
          {
            key: "kind",
            label: "Types",
            options: [
              { value: "submission", label: "Assignments" },
              { value: "quiz", label: "Quiz answers" },
            ],
          },
        ]}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title={scope === "pending" ? "Nothing waiting for review" : "No reviews yet"}
          description={scope === "pending" ? "New assignment submissions and written quiz answers will appear here." : undefined}
        />
      ) : (
        <ul className="grid gap-2">
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`}>
              <Link
                href={item.kind === "submission" ? `/teach/reviews/submissions/${item.id}` : `/teach/reviews/quiz-attempts/${item.id}`}
                className="flex flex-col gap-2 rounded-2xl border bg-card px-4 py-3 shadow-card transition-colors hover:border-primary/30 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {item.student_name} · {item.course_title}
                    {item.attempt_number > 1 ? ` · attempt ${item.attempt_number}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={item.kind} label={item.kind === "submission" ? "Assignment" : "Quiz"} tone="neutral" />
                  {item.is_late ? <StatusBadge status="late" label="Late" tone="warning" /> : null}
                  <StatusBadge status={item.status} />
                  {item.submitted_at ? (
                    <span className="text-xs text-muted-foreground">
                      <LocalTime value={item.submitted_at} format="relative" />
                    </span>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
