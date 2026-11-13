import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { getCourseAccess } from "@/lib/services/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { listLessonDiscussions } from "@/lib/services/discussions";
import { DiscussionBadges } from "./discussions/discussion-list";
import { AskLessonQuestionForm } from "./discussions/composers";
import { PersonAvatar } from "./person";
import { LocalTime } from "@/components/common/local-time";

/**
 * Lesson-level Q&A shown under the lesson player: recent questions about
 * this lesson, an "Ask about this lesson" form and a link to all course
 * discussions. Renders nothing for viewers without course access.
 */
export async function LessonDiscussions({
  courseId,
  courseSlug,
  lessonId,
}: {
  courseId: string;
  courseSlug: string;
  lessonId: string;
}) {
  const user = await getSessionUser();
  if (!user) return null;
  const { data: course } = await createAdminClient()
    .from("courses")
    .select("id, status, discussions_enabled")
    .eq("id", courseId)
    .maybeSingle();
  const row = course as { id: string; status: string; discussions_enabled: boolean } | null;
  if (!row) return null;
  const access = await getCourseAccess(user, { id: row.id, status: row.status });
  if (!access.hasAccess || (!row.discussions_enabled && !access.isStaff)) return null;

  const { items, total } = await listLessonDiscussions(courseId, lessonId, 5);
  const base = `/learn/courses/${courseSlug}/discussions`;

  return (
    <section aria-labelledby={`lesson-qa-${lessonId}`} className="rounded-2xl border bg-card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id={`lesson-qa-${lessonId}`} className="flex items-center gap-2 text-base font-semibold">
            <MessagesSquare className="size-4 text-primary" /> Questions about this lesson
          </h2>
          <p className="text-sm text-muted-foreground">
            {total === 0 ? "No questions yet. Ask the first one." : `${total} ${total === 1 ? "question" : "questions"} from your class.`}
          </p>
        </div>
        <AskLessonQuestionForm courseId={courseId} lessonId={lessonId} />
      </div>
      {items.length ? (
        <ul className="divide-y rounded-xl border">
          {items.map((d) => (
            <li key={d.id}>
              <Link href={`${base}/${d.id}`} className="flex gap-3 p-3 transition-colors hover:bg-muted/50">
                <PersonAvatar person={d.author} className="size-8" />
                <div className="min-w-0 flex-1">
                  <DiscussionBadges d={d} />
                  <p className="mt-0.5 line-clamp-1 text-sm font-medium">{d.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.author.name} · {d.replyCount} {d.replyCount === 1 ? "reply" : "replies"} · <LocalTime value={d.lastActivityAt} format="relative" />
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {total > items.length ? (
          <Link href={`${base}?lesson=${lessonId}`} className="font-medium text-primary hover:underline">
            See all {total} questions for this lesson
          </Link>
        ) : null}
        <Link href={base} className="font-medium text-primary hover:underline">
          Open course discussions
        </Link>
      </div>
    </section>
  );
}
