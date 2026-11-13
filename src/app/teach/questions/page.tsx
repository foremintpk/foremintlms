import Link from "next/link";
import { CircleCheckBig } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ListToolbar } from "@/components/common/list-toolbar";
import { LocalTime } from "@/components/common/local-time";
import { PaginationBar } from "@/components/common/pagination-bar";
import { QuickAnswer } from "@/components/communication/discussions/quick-answer";
import { PersonAvatar } from "@/components/communication/person";
import { PlainText } from "@/components/communication/plain-text";
import { requireTeacher } from "@/lib/auth/guards";
import { parseListParams } from "@/lib/list-params";
import { listUnansweredQuestions } from "@/lib/services/discussions";

export const instant = false;
export const metadata = { title: "Student questions" };

export default async function TeacherQuestionsPage({ searchParams }: PageProps<"/teach/questions">) {
  const user = await requireTeacher("/teach/questions");
  const sp = await searchParams;
  const lp = parseListParams(sp, { pageSize: 15, filterKeys: ["course"] });
  const { items, total, courses } = await listUnansweredQuestions(user, { courseId: lp.filters.course ?? null, q: lp.q, from: lp.from, to: lp.to });

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="Student questions"
        description="Open questions in your courses that don't have an instructor answer yet, oldest first."
      />
      <ListToolbar
        searchPlaceholder="Search questions"
        filters={courses.length > 1 ? [{ key: "course", label: "Courses", options: courses.map((c) => ({ value: c.id, label: c.title })) }] : []}
      />
      {items.length === 0 ? (
        <EmptyState
          icon={CircleCheckBig}
          title={lp.q || lp.filters.course ? "No open questions match" : "You're all caught up"}
          description={
            courses.length === 0
              ? "Questions appear here once you're assigned to a course."
              : "New questions from your students will show up here."
          }
        />
      ) : (
        <ul className="space-y-4">
          {items.map((q) => (
            <li key={q.id} className="rounded-2xl border bg-card p-4 shadow-card sm:p-5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span className="font-medium text-primary">{q.courseTitle}</span>
                {q.lessonTitle ? <span>· {q.lessonTitle}</span> : null}
                <span>
                  · asked <LocalTime value={q.createdAt} format="relative" />
                </span>
                {q.replyCount > 0 ? <span>· {q.replyCount} student {q.replyCount === 1 ? "reply" : "replies"}</span> : null}
              </div>
              <Link href={`/learn/courses/${q.courseSlug}/discussions/${q.id}`} className="mt-2 block text-base font-semibold hover:underline">
                {q.title}
              </Link>
              <div className="mt-2 flex items-start gap-3">
                <PersonAvatar person={q.author} className="size-8" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{q.author.name}</p>
                  <PlainText text={q.preview} className="mt-1 text-sm text-muted-foreground" />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <QuickAnswer courseId={q.courseId} discussionId={q.id} />
                <Link href={`/learn/courses/${q.courseSlug}/discussions/${q.id}`} className="text-sm font-medium text-muted-foreground hover:text-foreground">
                  Open thread
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
      <PaginationBar basePath="/teach/questions" searchParams={sp} page={lp.page} pageSize={lp.pageSize} total={total} />
    </div>
  );
}
