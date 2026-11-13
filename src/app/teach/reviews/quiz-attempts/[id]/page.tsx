import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/app-shell/page-header";
import { LocalTime } from "@/components/common/local-time";
import { StatusBadge } from "@/components/common/status-badge";
import { QuizReviewForm, type ReviewItem } from "@/components/teaching/quiz-review-form";
import { getCourseRole, requireTeacher } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAttemptForReview } from "@/lib/services/grading";

export const instant = false;
export const metadata = { title: "Review quiz answers" };

export default async function QuizAttemptReviewPage({ params }: PageProps<"/teach/reviews/quiz-attempts/[id]">) {
  const { id } = await params;
  const user = await requireTeacher(`/teach/reviews/quiz-attempts/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();
  const data = await loadAttemptForReview(id);
  if (!data) notFound();
  const role = await getCourseRole(user, data.attempt.course_id);
  if (!role.isInstructor && !role.isAdmin) notFound();

  const { data: student } = await createAdminClient()
    .from("profiles")
    .select("full_name, display_name")
    .eq("id", data.attempt.user_id)
    .maybeSingle();

  const answers = new Map(data.answers.map((a) => [a.question_id, a]));
  const items: ReviewItem[] = data.questions.map((q, i) => {
    const answer = answers.get(q.id);
    const selected = new Set(answer?.selected_option_ids ?? []);
    return {
      questionId: q.id,
      index: i + 1,
      type: q.question_type,
      prompt: q.prompt,
      points: q.points,
      acceptedAnswers: q.accepted_answers,
      options: q.options.map((o) => ({ id: o.id, label: o.label, isCorrect: o.is_correct, selected: selected.has(o.id) })),
      textAnswer: answer?.text_answer ?? null,
      pointsAwarded: answer?.points_awarded ?? null,
      feedback: answer?.feedback ?? null,
      // Written answers that were answered are scored by the instructor.
      reviewable: q.question_type === "short_answer" && Boolean(answer?.text_answer?.trim()),
    };
  });
  const s = student as { full_name: string; display_name: string | null } | null;

  return (
    <>
      <PageHeader
        back={{ href: "/teach/reviews", label: "Reviews" }}
        title={data.quiz.title}
        description={
          <>
            <Link href={`/teach/students/${data.attempt.user_id}`} className="font-medium text-foreground hover:text-primary">
              {s?.full_name || s?.display_name || "Student"}
            </Link>
            {` · attempt ${data.attempt.attempt_number}`}
            {data.attempt.submitted_at ? (
              <>
                {" · submitted "}
                <LocalTime value={data.attempt.submitted_at} />
              </>
            ) : null}
            {` · pass mark ${data.quiz.passing_score}%`}
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            {data.attempt.status === "graded" && data.attempt.percent !== null ? (
              <span className="text-sm font-medium tabular-nums">{Number(data.attempt.percent)}%</span>
            ) : null}
            <StatusBadge status={data.attempt.status} />
          </div>
        }
      />
      {data.attempt.status !== "needs_review" && data.attempt.status !== "graded" ? (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">This attempt isn&apos;t waiting for review.</p>
      ) : (
        <QuizReviewForm attemptId={data.attempt.id} items={items} alreadyGraded={data.attempt.status === "graded"} />
      )}
    </>
  );
}
