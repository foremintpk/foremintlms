import { notFound } from "next/navigation";
import { MessagesSquare } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ListToolbar } from "@/components/common/list-toolbar";
import { PaginationBar } from "@/components/common/pagination-bar";
import { DiscussionAccessRequired, DiscussionsDisabled } from "@/components/communication/discussions/access-required";
import { NewDiscussionDialog } from "@/components/communication/discussions/composers";
import { DiscussionListItem } from "@/components/communication/discussions/discussion-list";
import { requireUser } from "@/lib/auth/guards";
import { parseListParams } from "@/lib/list-params";
import { getDiscussionContext, listCourseLessons, listDiscussions, type DiscussionFilter } from "@/lib/services/discussions";

export const instant = false;
export const metadata = { title: "Course discussions" };

const FILTERS: { value: DiscussionFilter; label: string }[] = [
  { value: "questions", label: "Questions" },
  { value: "unanswered", label: "Unanswered" },
  { value: "resolved", label: "Resolved" },
  { value: "announcements", label: "Announcements" },
];

export default async function CourseDiscussionsPage({ params, searchParams }: PageProps<"/learn/courses/[slug]/discussions">) {
  const { slug } = await params;
  const sp = await searchParams;
  const basePath = `/learn/courses/${slug}/discussions`;
  const user = await requireUser(basePath);
  const ctx = await getDiscussionContext(user, slug);
  if (!ctx) notFound();

  const header = (actions?: React.ReactNode) => (
    <PageHeader
      title="Discussions"
      description={`Questions and conversations for ${ctx.course.title}.`}
      back={{ href: `/learn/courses/${slug}`, label: ctx.course.title }}
      actions={actions}
    />
  );

  if (!ctx.hasAccess) {
    return (
      <>
        {header()}
        <DiscussionAccessRequired courseSlug={slug} courseTitle={ctx.course.title} reason={ctx.accessReason} />
      </>
    );
  }
  if (!ctx.course.discussionsEnabled && !ctx.isStaff) {
    return (
      <>
        {header()}
        <DiscussionsDisabled courseSlug={slug} />
      </>
    );
  }

  const lp = parseListParams(sp, { pageSize: 20, filterKeys: ["filter", "lesson"] });
  const filter = (FILTERS.some((f) => f.value === lp.filters.filter) ? lp.filters.filter : "all") as DiscussionFilter;
  const [{ items, total }, lessons] = await Promise.all([
    listDiscussions(ctx.course.id, { filter, lessonId: lp.filters.lesson ?? null, q: lp.q, from: lp.from, to: lp.to }),
    listCourseLessons(ctx.course.id),
  ]);
  const filtered = Boolean(lp.q || lp.filters.filter || lp.filters.lesson);

  return (
    <div className="mx-auto w-full max-w-4xl">
      {header(<NewDiscussionDialog courseId={ctx.course.id} lessons={lessons} isStaff={ctx.isStaff} defaultLessonId={lp.filters.lesson ?? null} />)}
      <ListToolbar
        searchPlaceholder="Search discussions"
        filters={[
          { key: "filter", label: "Topics", options: FILTERS },
          ...(lessons.length ? [{ key: "lesson", label: "Lessons", options: lessons.map((l) => ({ value: l.id, label: l.title })) }] : []),
        ]}
      />
      {!ctx.course.discussionsEnabled ? (
        <p className="mb-4 rounded-xl border border-warning/30 bg-warning-soft px-4 py-2 text-sm text-warning">
          Discussions are turned off for students in this course. Only course staff can see this page.
        </p>
      ) : null}
      {items.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title={filtered ? "No discussions match" : "No discussions yet"}
          description={filtered ? "Try a different filter or search term." : "Ask the first question — instructors and classmates can answer here."}
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-card">
          {items.map((d) => (
            <DiscussionListItem key={d.id} d={d} href={`${basePath}/${d.id}`} />
          ))}
        </ul>
      )}
      <PaginationBar basePath={basePath} searchParams={sp} page={lp.page} pageSize={lp.pageSize} total={total} />
    </div>
  );
}
