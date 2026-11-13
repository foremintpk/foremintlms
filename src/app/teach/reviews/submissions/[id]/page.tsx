import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Download, ExternalLink, FileText } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/app-shell/page-header";
import { LocalTime } from "@/components/common/local-time";
import { RichContent } from "@/components/common/rich-content";
import { StatusBadge } from "@/components/common/status-badge";
import { GradingForm } from "@/components/teaching/grading-form";
import { getCourseRole, requireTeacher } from "@/lib/auth/guards";
import { formatBytes } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadSubmission } from "@/lib/services/grading";
import { parseRubric } from "@/lib/services/grading-rules";

export const instant = false;
export const metadata = { title: "Review submission" };

export default async function SubmissionReviewPage({ params }: PageProps<"/teach/reviews/submissions/[id]">) {
  const { id } = await params;
  const user = await requireTeacher(`/teach/reviews/submissions/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();
  const loaded = await loadSubmission(id);
  if (!loaded) notFound();
  const { submission, assignment } = loaded;
  const role = await getCourseRole(user, submission.course_id);
  if (!role.isInstructor && !role.isAdmin) notFound();

  const admin = createAdminClient();
  const [studentRes, emailRes, courseRes, filesRes, historyRes, feedbackRes] = await Promise.all([
    admin.from("profiles").select("full_name, display_name").eq("id", submission.user_id).maybeSingle(),
    admin.from("profile_private").select("email").eq("user_id", submission.user_id).maybeSingle(),
    admin.from("courses").select("title").eq("id", submission.course_id).maybeSingle(),
    submission.file_ids.length
      ? admin.from("media_files").select("id, file_name, size_bytes, mime_type, status").in("id", submission.file_ids)
      : Promise.resolve({ data: [] }),
    admin
      .from("assignment_submissions")
      .select("id, attempt_number, status, grade_points, submitted_at")
      .eq("assignment_id", assignment.id)
      .eq("user_id", submission.user_id)
      .order("attempt_number", { ascending: false }),
    admin
      .from("assignment_feedback")
      .select("id, body, created_at, author_id, profiles(full_name)")
      .eq("submission_id", submission.id)
      .order("created_at", { ascending: true }),
  ]);
  const student = studentRes.data as { full_name: string; display_name: string | null } | null;
  const files = ((filesRes.data ?? []) as { id: string; file_name: string; size_bytes: number; mime_type: string; status: string }[]).filter((f) => f.status === "ready");
  const history = (historyRes.data ?? []) as { id: string; attempt_number: number; status: string; grade_points: number | null; submitted_at: string }[];
  const feedback = (feedbackRes.data ?? []) as unknown as { id: string; body: string; created_at: string; author_id: string | null; profiles: { full_name: string } | null }[];
  const rubric = parseRubric(assignment.rubric);
  const storedCriteria = (submission.rubric_scores?.criteria ?? {}) as Record<string, number>;

  return (
    <>
      <PageHeader
        back={{ href: "/teach/reviews", label: "Reviews" }}
        title={assignment.title}
        description={
          <>
            <Link href={`/teach/students/${submission.user_id}`} className="font-medium text-foreground hover:text-primary">
              {student?.full_name || student?.display_name || "Student"}
            </Link>
            {(emailRes.data as { email: string } | null)?.email ? ` · ${(emailRes.data as { email: string }).email}` : ""}
            {` · ${(courseRes.data as { title: string } | null)?.title ?? ""}`}
          </>
        }
        actions={<StatusBadge status={submission.status} />}
      />

      <div className="grid gap-8 xl:grid-cols-[1.5fr_1fr]">
        <div className="grid content-start gap-6">
          <section className="rounded-2xl border bg-card p-5 shadow-card">
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>
                Attempt {submission.attempt_number} · submitted <LocalTime value={submission.submitted_at} />
              </span>
              {submission.is_late ? <StatusBadge status="late" label="Late" tone="warning" /> : null}
              {assignment.due_at ? (
                <span>
                  · due <LocalTime value={assignment.due_at} />
                </span>
              ) : null}
            </div>

            {submission.text_body ? (
              <div className="mb-5">
                <p className="mb-2 text-sm font-medium">Written answer</p>
                <div className="rounded-xl bg-muted/40 p-4 text-[0.95rem] leading-relaxed whitespace-pre-wrap">{submission.text_body}</div>
              </div>
            ) : null}

            {submission.links.length ? (
              <div className="mb-5">
                <p className="mb-2 text-sm font-medium">Links</p>
                <ul className="grid gap-1.5">
                  {submission.links.map((link) => (
                    <li key={link}>
                      <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex max-w-full items-center gap-1.5 text-sm text-primary hover:underline">
                        <ExternalLink className="size-3.5 shrink-0" />
                        <span className="truncate">{link}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {files.length ? (
              <div>
                <p className="mb-2 text-sm font-medium">Files</p>
                <ul className="grid gap-2">
                  {files.map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
                      <a href={`/api/files/${f.id}`} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-2 hover:text-primary">
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{f.file_name}</span>
                      </a>
                      <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                        {formatBytes(f.size_bytes)}
                        <a href={`/api/files/${f.id}?download=1`} aria-label={`Download ${f.file_name}`} className="hover:text-foreground">
                          <Download className="size-4" />
                        </a>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {!submission.text_body && !submission.links.length && !files.length ? (
              <p className="text-sm text-muted-foreground">This submission has no content.</p>
            ) : null}
          </section>

          <section>
            <SectionHeader title="Feedback history" />
            {feedback.length === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No feedback yet.</p>
            ) : (
              <ol className="grid gap-3">
                {feedback.map((f) => (
                  <li key={f.id} className="rounded-xl border bg-card p-4">
                    <p className="mb-1 text-xs text-muted-foreground">
                      {f.profiles?.full_name ?? "Instructor"} · <LocalTime value={f.created_at} />
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{f.body}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <details className="rounded-2xl border bg-card p-5">
            <summary className="cursor-pointer text-sm font-medium">Assignment instructions</summary>
            <div className="mt-4">
              {assignment.instructions ? <RichContent html={assignment.instructions} /> : <p className="text-sm text-muted-foreground">No instructions.</p>}
              {assignment.grading_criteria ? (
                <div className="mt-4 border-t pt-4">
                  <p className="mb-1 text-sm font-medium">Grading criteria</p>
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">{assignment.grading_criteria}</p>
                </div>
              ) : null}
            </div>
          </details>
        </div>

        <div className="grid content-start gap-6">
          <section className="rounded-2xl border bg-card p-5 shadow-card">
            <SectionHeader title="Grade" description={`Out of ${assignment.max_points} points`} />
            <GradingForm
              submissionId={submission.id}
              status={submission.status}
              maxPoints={assignment.max_points}
              passingPoints={assignment.passing_points}
              rubric={rubric}
              initialPoints={submission.grade_points}
              initialRubric={storedCriteria}
              isLate={submission.is_late}
              latePenaltyPercent={assignment.late_penalty_percent}
            />
          </section>

          {history.length > 1 ? (
            <section>
              <SectionHeader title="All attempts" />
              <ul className="grid gap-2">
                {history.map((h) => (
                  <li key={h.id}>
                    <Link
                      href={`/teach/reviews/submissions/${h.id}`}
                      aria-current={h.id === submission.id ? "page" : undefined}
                      className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-2.5 text-sm transition-colors hover:border-primary/30 aria-[current=page]:border-primary"
                    >
                      <span>
                        Attempt {h.attempt_number} · <LocalTime value={h.submitted_at} format="date" />
                      </span>
                      <span className="flex items-center gap-2">
                        {h.grade_points !== null ? <span className="tabular-nums">{Number(h.grade_points)}</span> : null}
                        <StatusBadge status={h.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
