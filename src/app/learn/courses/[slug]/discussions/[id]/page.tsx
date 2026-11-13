import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { z } from "zod";
import { LocalTime } from "@/components/common/local-time";
import { DiscussionAccessRequired } from "@/components/communication/discussions/access-required";
import { ReplyComposer } from "@/components/communication/discussions/composers";
import { DiscussionBadges } from "@/components/communication/discussions/discussion-list";
import { DiscussionActions, ReactionBar, ReplyCard } from "@/components/communication/discussions/thread-items";
import { PersonAvatar, RoleBadge } from "@/components/communication/person";
import { PlainText } from "@/components/communication/plain-text";
import { requireUser } from "@/lib/auth/guards";
import { getDiscussionContext, getThread } from "@/lib/services/discussions";

export const instant = false;
export const metadata = { title: "Discussion" };

export default async function DiscussionThreadPage({ params }: PageProps<"/learn/courses/[slug]/discussions/[id]">) {
  const { slug, id } = await params;
  const listHref = `/learn/courses/${slug}/discussions`;
  const user = await requireUser(`${listHref}/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();
  const ctx = await getDiscussionContext(user, slug);
  if (!ctx) notFound();
  if (!ctx.hasAccess) return <DiscussionAccessRequired courseSlug={slug} courseTitle={ctx.course.title} reason={ctx.accessReason} />;

  const thread = await getThread(user, ctx.course.id, id);
  if (!thread) notFound();
  const d = thread.discussion;
  const isAuthor = d.author.id === user.id;
  const isQuestion = d.kind === "question";
  const canReply = d.status === "visible" && (!d.isLocked || ctx.isStaff);
  const replyCount = thread.replies.reduce((n, r) => n + 1 + r.children.length, 0);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href={`/learn/courses/${slug}`} className="hover:text-foreground">
          {ctx.course.title}
        </Link>
        <span aria-hidden>/</span>
        <Link href={listHref} className="hover:text-foreground">
          Discussions
        </Link>
      </nav>

      <article className="rounded-2xl border bg-card p-5 shadow-card sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <DiscussionBadges d={d} />
            <h1 className="mt-2 text-xl leading-tight font-semibold tracking-tight sm:text-2xl">{d.title}</h1>
          </div>
          <DiscussionActions
            discussion={{ id: d.id, title: d.title, body: d.body, kind: d.kind, isPinned: d.isPinned, isLocked: d.isLocked, isResolved: d.isResolved, status: d.status }}
            courseId={ctx.course.id}
            isAuthor={isAuthor}
            isStaff={ctx.isStaff}
            listHref={listHref}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <PersonAvatar person={d.author} className="size-8" />
          <span className="font-semibold">{d.author.name}</span>
          <RoleBadge role={d.author.role} />
          <span className="text-muted-foreground">
            · <LocalTime value={d.createdAt} format="relative" />
            {d.updatedAt !== d.createdAt ? " · edited" : ""}
          </span>
          {d.lessonTitle && d.lessonId ? (
            <Link href={`/learn/courses/${slug}/lessons/${d.lessonId}`} className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
              · {d.lessonTitle}
            </Link>
          ) : null}
        </div>
        <PlainText text={d.body} className="mt-4" />
        <div className="mt-5">
          <ReactionBar courseId={ctx.course.id} discussionId={d.id} counts={d.reactions} mine={d.myReactions} />
        </div>
      </article>

      <section className="mt-8" aria-labelledby="replies-heading">
        <h2 id="replies-heading" className="mb-4 text-base font-semibold">
          {replyCount === 0 ? "No replies yet" : `${replyCount} ${replyCount === 1 ? "reply" : "replies"}`}
        </h2>
        <div className="space-y-4">
          {thread.replies.map((r) => (
            <ReplyCard
              key={r.id}
              reply={r}
              courseId={ctx.course.id}
              discussionId={d.id}
              meId={user.id}
              isStaff={ctx.isStaff}
              canAccept={isAuthor || ctx.isStaff}
              isQuestion={isQuestion}
              locked={d.isLocked}
            />
          ))}
        </div>

        <div className="mt-6 rounded-2xl border bg-card p-4 sm:p-5">
          {canReply ? (
            <>
              <h3 className="mb-3 text-sm font-semibold">{isQuestion && !isAuthor ? "Answer this question" : "Add a reply"}</h3>
              <ReplyComposer courseId={ctx.course.id} discussionId={d.id} placeholder={isQuestion && !isAuthor ? "Share what you know" : "Write a reply"} />
            </>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="size-4" /> {d.status !== "visible" ? "This discussion is hidden from students." : "This discussion is locked. New replies are turned off."}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
