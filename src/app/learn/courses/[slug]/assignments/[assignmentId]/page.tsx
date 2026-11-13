import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { CalendarClock, ExternalLink, MessageSquareText, Paperclip, Trophy } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/app-shell/page-header";
import { LocalTime } from "@/components/common/local-time";
import { RichContent } from "@/components/common/rich-content";
import { StatusBadge } from "@/components/common/status-badge";
import { AssignmentForm } from "@/components/learning/assignment-form";
import { FileCard } from "@/components/learning/content-blocks";
import { requireUser } from "@/lib/auth/guards";
import { UserFacingError } from "@/lib/actions";
import { formatBytes } from "@/lib/format";
import { canSubmitNew, isLate } from "@/lib/services/assignments/due";
import { getCourseBySlug } from "@/lib/services/learner";
import { getAssignmentForLearner, getFeedbackFor, getMediaMeta, listSubmissions } from "@/lib/services/submissions";

export const instant = false;

export const metadata: Metadata = { title: "Assignment" };

const uuidRe = /^[0-9a-f-]{36}$/i;

const STATUS_COPY: Record<string, string> = {
  submitted: "Submitted — waiting for review",
  under_review: "Your instructor is reviewing it",
  resubmission_requested: "Changes requested — please resubmit",
  graded: "Graded",
  approved: "Approved",
};

export default async function AssignmentPage({ params }: PageProps<"/learn/courses/[slug]/assignments/[assignmentId]">) {
  const { slug, assignmentId } = await params;
  const user = await requireUser(`/learn/courses/${slug}/assignments/${assignmentId}`);
  const course = await getCourseBySlug(slug);
  if (!course || !uuidRe.test(assignmentId)) notFound();

  let ctx: Awaited<ReturnType<typeof getAssignmentForLearner>>;
  try {
    ctx = await getAssignmentForLearner(user, course.id, assignmentId);
  } catch (err) {
    if (err instanceof UserFacingError) redirect(`/learn/courses/${slug}`);
    throw err;
  }
  if (!ctx) notFound();
  const { assignment, due, access } = ctx;

  const submissions = await listSubmissions(user.id, assignment.id);
  const [feedback, supportingFiles, submittedFiles] = await Promise.all([
    getFeedbackFor(submissions.map((s) => s.id)),
    getMediaMeta(assignment.supporting_media_ids ?? []),
    getMediaMeta(submissions.flatMap((s) => s.file_ids ?? [])),
  ]);
  const filesById = new Map(submittedFiles.map((f) => [f.id, f]));
  const latest = submissions[0] ?? null;
  const gate = canSubmitNew(latest);
  const late = isLate(due);
  const closed = late && !assignment.allow_late_submissions;
  const staffPreview = access.isStaff && !access.enrollment;

  return (
    <>
      <PageHeader title={assignment.title} back={{ href: `/learn/courses/${slug}`, label: course.title }}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          {due ? (
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="size-4" /> Due <LocalTime value={due.toISOString()} format="weekday" />
              {late ? <StatusBadge status="overdue" tone="danger" label="Past due" /> : null}
            </span>
          ) : (
            <span>No deadline</span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Trophy className="size-4" /> {Number(assignment.max_points)} points
            {assignment.passing_points != null ? ` · pass at ${Number(assignment.passing_points)}` : ""}
          </span>
          {late && assignment.allow_late_submissions && assignment.late_penalty_percent > 0 ? (
            <span>Late penalty: {assignment.late_penalty_percent}% of the points</span>
          ) : null}
          {latest ? <StatusBadge status={latest.status} /> : null}
        </div>
      </PageHeader>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-8">
          <section className="rounded-2xl border bg-card p-5 sm:p-6">
            <h2 className="mb-3 text-lg font-semibold">Instructions</h2>
            {assignment.instructions ? <RichContent html={assignment.instructions} /> : <p className="text-sm text-muted-foreground">No written instructions.</p>}
          </section>

          {supportingFiles.length ? (
            <section className="space-y-2">
              <SectionHeader title="Supporting files" />
              {supportingFiles.map((f) => (
                <FileCard key={f.id} file={{ id: f.id, name: f.file_name, mimeType: f.mime_type, size: Number(f.size_bytes) }} />
              ))}
            </section>
          ) : null}

          <section>
            <SectionHeader title={latest ? (gate.allowed ? "Submit a new version" : "Your submission") : "Your submission"} />
            {staffPreview ? (
              <p className="text-sm text-muted-foreground">Staff can&apos;t submit from the student view.</p>
            ) : gate.allowed && !closed ? (
              <div className="rounded-2xl border bg-card p-5 sm:p-6">
                <AssignmentForm
                  courseId={course.id}
                  assignmentId={assignment.id}
                  submissionTypes={assignment.submission_types}
                  allowedFileTypes={assignment.allowed_file_types}
                  maxFiles={assignment.max_files}
                  maxFileSizeMb={assignment.max_file_size_mb}
                  late={late}
                />
              </div>
            ) : closed && gate.allowed ? (
              <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
                The deadline has passed and this assignment doesn&apos;t accept late submissions. Message your instructor if you need an extension.
              </p>
            ) : latest ? (
              <p className="rounded-xl bg-muted px-4 py-3 text-sm">{STATUS_COPY[latest.status] ?? gate.reason}</p>
            ) : null}
          </section>

          {submissions.length ? (
            <section>
              <SectionHeader title="History" description="Every version you've submitted, with your instructor's feedback." />
              <ol className="space-y-4">
                {submissions.map((s) => {
                  const fb = feedback.filter((f) => f.submission_id === s.id);
                  return (
                    <li key={s.id} className="rounded-2xl border bg-card p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">
                          Version {s.attempt_number}{" "}
                          <span className="font-normal text-muted-foreground">
                            · <LocalTime value={s.submitted_at} format="datetime" />
                            {s.is_late ? " · late" : ""}
                          </span>
                        </p>
                        <div className="flex items-center gap-2">
                          {s.grade_points != null ? (
                            <span className="text-sm font-semibold tabular-nums">
                              {Number(s.grade_points)} / {Number(assignment.max_points)}
                            </span>
                          ) : null}
                          <StatusBadge status={s.status} />
                        </div>
                      </div>
                      {s.text_body ? <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-sm whitespace-pre-wrap">{s.text_body}</p> : null}
                      {s.links?.length ? (
                        <ul className="mt-3 space-y-1 text-sm">
                          {s.links.map((l) => (
                            <li key={l}>
                              <a href={l} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-primary hover:underline">
                                {l} <ExternalLink className="size-3" />
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {s.file_ids?.length ? (
                        <ul className="mt-3 space-y-1 text-sm">
                          {s.file_ids.map((id) => {
                            const f = filesById.get(id);
                            return f ? (
                              <li key={id}>
                                <a href={`/api/files/${id}?download=1`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                                  <Paperclip className="size-3.5" /> {f.file_name} <span className="text-muted-foreground">({formatBytes(Number(f.size_bytes))})</span>
                                </a>
                              </li>
                            ) : null;
                          })}
                        </ul>
                      ) : null}
                      {fb.length ? (
                        <div className="mt-4 space-y-2 border-t pt-4">
                          {fb.map((f) => (
                            <div key={f.id} className="rounded-lg bg-info-soft/60 px-3 py-2 text-sm">
                              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-info">
                                <MessageSquareText className="size-3.5" /> {f.author_name} · <LocalTime value={f.created_at} format="date" />
                              </p>
                              <p className="whitespace-pre-wrap">{f.body}</p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}
        </div>

        <aside className="space-y-6">
          {assignment.rubric?.length ? (
            <section className="rounded-2xl border bg-card p-5">
              <h2 className="font-semibold">How it&apos;s graded</h2>
              <ul className="mt-3 space-y-3 text-sm">
                {assignment.rubric.map((r, i) => (
                  <li key={r.id ?? i} className="flex justify-between gap-3">
                    <span>
                      <span className="font-medium">{r.criterion}</span>
                      {r.description ? <span className="block text-muted-foreground">{r.description}</span> : null}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{r.points} pts</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {assignment.grading_criteria ? (
            <section className="rounded-2xl border bg-card p-5">
              <h2 className="font-semibold">Grading criteria</h2>
              <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">{assignment.grading_criteria}</p>
            </section>
          ) : null}
          <section className="rounded-2xl border bg-card p-5 text-sm">
            <h2 className="font-semibold">Submission format</h2>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              {assignment.submission_types.includes("text") ? <li>Written answer</li> : null}
              {assignment.submission_types.includes("link") ? <li>Links to your work</li> : null}
              {assignment.submission_types.includes("file") ? (
                <li>
                  Up to {assignment.max_files} file{assignment.max_files === 1 ? "" : "s"} ({assignment.allowed_file_types.map((e) => `.${e}`).join(", ")}),{" "}
                  {assignment.max_file_size_mb} MB each
                </li>
              ) : null}
            </ul>
            <Link href={`/learn/messages`} className="mt-3 inline-block font-medium text-primary hover:underline">
              Ask your instructor a question
            </Link>
          </section>
        </aside>
      </div>
    </>
  );
}
