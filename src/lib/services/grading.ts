import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/services/notifications";
import { syncCompletionAfterGrading } from "@/lib/services/progress";
import { UserFacingError } from "@/lib/actions";
import { appUrl } from "@/lib/env";
import { sha256 } from "@/lib/security/crypto";
import { summarize, type GradableQuestion, type QuestionGrade, type QuestionType } from "@/lib/domain/quiz";
import type { SessionUser } from "@/lib/auth/session";
import type { Json } from "@/types/database";
import { computeGrade, correctnessFor, parseRubric, submissionPasses } from "./grading-rules";

/**
 * Instructor grading: assignment submissions and manually reviewed quiz
 * answers. Callers must have verified course staff access (assertCourseStaff)
 * for the row's course before calling these.
 */

export interface SubmissionRow {
  id: string;
  assignment_id: string;
  user_id: string;
  course_id: string;
  attempt_number: number;
  status: "submitted" | "under_review" | "resubmission_requested" | "graded" | "approved";
  text_body: string | null;
  links: string[];
  file_ids: string[];
  submitted_at: string;
  is_late: boolean;
  grade_points: number | null;
  rubric_scores: Record<string, unknown>;
  graded_at: string | null;
  graded_by: string | null;
}

export interface AssignmentRow {
  id: string;
  course_id: string;
  title: string;
  instructions: string | null;
  max_points: number;
  passing_points: number | null;
  due_at: string | null;
  late_penalty_percent: number;
  rubric: unknown;
  grading_criteria: string | null;
}

export async function loadSubmission(submissionId: string): Promise<{ submission: SubmissionRow; assignment: AssignmentRow } | null> {
  const admin = createAdminClient();
  const { data: submission } = await admin.from("assignment_submissions").select("*").eq("id", submissionId).maybeSingle();
  if (!submission) return null;
  const { data: assignment } = await admin
    .from("assignments")
    .select("id, course_id, title, instructions, max_points, passing_points, due_at, late_penalty_percent, rubric, grading_criteria")
    .eq("id", (submission as SubmissionRow).assignment_id)
    .maybeSingle();
  if (!assignment) return null;
  return {
    submission: { ...(submission as SubmissionRow), grade_points: submission.grade_points === null ? null : Number(submission.grade_points) },
    assignment: { ...(assignment as AssignmentRow), max_points: Number(assignment.max_points), passing_points: assignment.passing_points === null ? null : Number(assignment.passing_points) },
  };
}

async function courseInfo(courseId: string): Promise<{ title: string; slug: string }> {
  const { data } = await createAdminClient().from("courses").select("title, slug").eq("id", courseId).maybeSingle();
  return (data as { title: string; slug: string } | null) ?? { title: "your course", slug: "" };
}

export async function markSubmissionUnderReview(submission: SubmissionRow): Promise<void> {
  if (submission.status !== "submitted") return;
  await createAdminClient().from("assignment_submissions").update({ status: "under_review" }).eq("id", submission.id).eq("status", "submitted");
}

export type GradeDecision = "approve" | "grade" | "request_resubmission";

export interface GradeSubmissionInput {
  decision: GradeDecision;
  points: number | null;
  rubricScores: Record<string, number>;
  feedback: string | null;
}

const DECISION_LABEL: Record<GradeDecision, string> = {
  approve: "Approved",
  grade: "Graded",
  request_resubmission: "Resubmission requested",
};

export async function gradeSubmission(
  actor: SessionUser,
  submission: SubmissionRow,
  assignment: AssignmentRow,
  input: GradeSubmissionInput,
): Promise<{ status: SubmissionRow["status"]; finalPoints: number | null }> {
  const admin = createAdminClient();
  const rubric = parseRubric(assignment.rubric);
  const feedback = input.feedback?.trim() || null;

  let status: SubmissionRow["status"];
  let finalPoints: number | null = null;
  let rubricScores: Record<string, unknown> = {};
  let penaltyNote = "";

  if (input.decision === "request_resubmission") {
    if (!feedback) throw new UserFacingError("Explain what the student should change before requesting a resubmission.");
    status = "resubmission_requested";
  } else {
    const grade = computeGrade({
      maxPoints: assignment.max_points,
      points: input.points,
      rubric,
      rubricScores: input.rubricScores,
      isLate: submission.is_late,
      latePenaltyPercent: assignment.late_penalty_percent,
    });
    if (grade.errors.length) throw new UserFacingError(grade.errors.join(" "));
    if (input.decision === "grade" && grade.finalPoints === null) {
      throw new UserFacingError("Enter the points (or score the rubric) to grade this submission.");
    }
    finalPoints = grade.finalPoints;
    rubricScores = {
      criteria: Object.keys(input.rubricScores).length ? input.rubricScores : undefined,
      raw_points: grade.rawPoints,
      late_penalty_percent: grade.penaltyApplied || undefined,
    };
    if (grade.penaltyApplied > 0 && grade.rawPoints !== null) {
      penaltyNote = ` A ${grade.penaltyApplied}% late penalty was applied (${grade.rawPoints} → ${grade.finalPoints}).`;
    }
    status = input.decision === "approve" ? "approved" : "graded";
  }

  const { error } = await admin
    .from("assignment_submissions")
    .update({
      status,
      grade_points: finalPoints,
      rubric_scores: rubricScores as Json,
      graded_at: status === "resubmission_requested" ? null : new Date().toISOString(),
      graded_by: actor.id,
    })
    .eq("id", submission.id);
  if (error) throw new Error(`grading update failed: ${error.message}`);

  if (feedback) {
    const { error: fbError } = await admin
      .from("assignment_feedback")
      .insert({ submission_id: submission.id, author_id: actor.id, body: feedback.slice(0, 20000) });
    if (fbError) throw new Error(`feedback insert failed: ${fbError.message}`);
  }

  const course = await courseInfo(assignment.course_id);
  const url = `/learn/courses/${course.slug}/assignments/${assignment.id}`;
  const gradeSummary =
    status === "resubmission_requested"
      ? "Read the feedback and submit an updated version."
      : finalPoints !== null
        ? `Score: ${finalPoints} / ${assignment.max_points}.${penaltyNote}`
        : "No points were assigned.";
  await notify(submission.user_id, {
    category: "learning",
    type: "assignment_reviewed",
    title: `${assignment.title}: ${DECISION_LABEL[input.decision].toLowerCase()}`,
    body: gradeSummary,
    url,
    data: { submission_id: submission.id, assignment_id: assignment.id },
    email: {
      templateKey: "learning.assignment_graded",
      idempotencyKey: `assignment-reviewed:${submission.id}:${status}:${finalPoints ?? "na"}:${sha256(feedback ?? "").slice(0, 12)}`,
      payload: {
        assignment_title: assignment.title,
        course_title: course.title,
        status: DECISION_LABEL[input.decision],
        grade_summary: gradeSummary,
        instructor_name: actor.fullName || actor.displayName,
        cta_url: appUrl(url),
      },
    },
  });

  const passed = status === "approved" || (status === "graded" && submissionPasses(finalPoints, assignment.passing_points));
  if (passed) {
    await syncCompletionAfterGrading({ userId: submission.user_id, courseId: assignment.course_id, assignmentId: assignment.id });
  }
  return { status, finalPoints };
}

/** A comment on a submission without changing its status. */
export async function addSubmissionFeedback(actor: SessionUser, submission: SubmissionRow, assignment: AssignmentRow, body: string) {
  const text = body.trim();
  if (!text) throw new UserFacingError("Write some feedback first.");
  const { error } = await createAdminClient()
    .from("assignment_feedback")
    .insert({ submission_id: submission.id, author_id: actor.id, body: text.slice(0, 20000) });
  if (error) throw new Error(`feedback insert failed: ${error.message}`);
  const course = await courseInfo(assignment.course_id);
  const url = `/learn/courses/${course.slug}/assignments/${assignment.id}`;
  await notify(submission.user_id, {
    category: "learning",
    type: "instructor_feedback",
    title: `New feedback on ${assignment.title}`,
    body: text.slice(0, 200),
    url,
    email: {
      templateKey: "learning.instructor_feedback",
      idempotencyKey: `assignment-feedback:${submission.id}:${sha256(text).slice(0, 16)}`,
      payload: {
        instructor_name: actor.fullName || actor.displayName,
        assignment_title: assignment.title,
        course_title: course.title,
        cta_url: appUrl(url),
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Quiz manual review
// ---------------------------------------------------------------------------

export interface AttemptRow {
  id: string;
  quiz_id: string;
  user_id: string;
  course_id: string;
  attempt_number: number;
  status: "in_progress" | "submitted" | "needs_review" | "graded" | "expired";
  question_ids: string[];
  submitted_at: string | null;
  score: number | null;
  max_score: number | null;
  percent: number | null;
  passed: boolean | null;
}

export interface ReviewQuestion {
  id: string;
  question_type: QuestionType;
  prompt: string;
  explanation: string | null;
  points: number;
  accepted_answers: string[];
  case_sensitive: boolean;
  requires_manual_review: boolean;
  options: { id: string; label: string; is_correct: boolean; sort_order: number }[];
}

export interface ReviewAnswer {
  id: string;
  question_id: string;
  selected_option_ids: string[];
  text_answer: string | null;
  is_correct: boolean | null;
  points_awarded: number | null;
  feedback: string | null;
}

export interface AttemptReviewData {
  attempt: AttemptRow;
  quiz: { id: string; title: string; passing_score: number; course_id: string };
  questions: ReviewQuestion[];
  answers: ReviewAnswer[];
}

export async function loadAttemptForReview(attemptId: string): Promise<AttemptReviewData | null> {
  const admin = createAdminClient();
  const { data: attempt } = await admin.from("quiz_attempts").select("*").eq("id", attemptId).maybeSingle();
  if (!attempt) return null;
  const a = attempt as AttemptRow;
  const [{ data: quiz }, { data: questions }, { data: answers }] = await Promise.all([
    admin.from("quizzes").select("id, title, passing_score, course_id").eq("id", a.quiz_id).maybeSingle(),
    a.question_ids.length
      ? admin
          .from("quiz_questions")
          .select("id, question_type, prompt, explanation, points, accepted_answers, case_sensitive, requires_manual_review, quiz_options(id, label, is_correct, sort_order)")
          .in("id", a.question_ids)
      : Promise.resolve({ data: [] }),
    admin.from("quiz_answers").select("id, question_id, selected_option_ids, text_answer, is_correct, points_awarded, feedback").eq("attempt_id", a.id),
  ]);
  if (!quiz) return null;
  const order = new Map(a.question_ids.map((id, i) => [id, i]));
  const parsedQuestions: ReviewQuestion[] = ((questions ?? []) as (Omit<ReviewQuestion, "options"> & { quiz_options: ReviewQuestion["options"] })[])
    .map((q) => ({
      ...q,
      points: Number(q.points),
      options: [...(q.quiz_options ?? [])].sort((x, y) => x.sort_order - y.sort_order),
    }))
    .sort((x, y) => (order.get(x.id) ?? 0) - (order.get(y.id) ?? 0));
  return {
    attempt: a,
    quiz: { ...(quiz as AttemptReviewData["quiz"]), passing_score: Number(quiz.passing_score) },
    questions: parsedQuestions,
    answers: ((answers ?? []) as ReviewAnswer[]).map((ans) => ({
      ...ans,
      points_awarded: ans.points_awarded === null ? null : Number(ans.points_awarded),
    })),
  };
}

export interface QuizAward {
  questionId: string;
  points: number;
  feedback: string | null;
}

export async function reviewQuizAttempt(actor: SessionUser, data: AttemptReviewData, awards: QuizAward[]) {
  const admin = createAdminClient();
  const { attempt, quiz, questions } = data;
  if (attempt.status !== "needs_review" && attempt.status !== "graded") {
    throw new UserFacingError("This attempt isn't waiting for review.");
  }
  const byQuestion = new Map(questions.map((q) => [q.id, q]));
  const answersByQuestion = new Map(data.answers.map((a) => [a.question_id, a]));
  const now = new Date().toISOString();

  for (const award of awards) {
    const question = byQuestion.get(award.questionId);
    if (!question || question.question_type !== "short_answer") throw new UserFacingError("Only written answers can be reviewed manually.");
    if (!Number.isFinite(award.points) || award.points < 0 || award.points > question.points) {
      throw new UserFacingError(`Points for “${question.prompt.slice(0, 60)}” must be between 0 and ${question.points}.`);
    }
    const answer = answersByQuestion.get(question.id);
    const values = {
      points_awarded: award.points,
      is_correct: correctnessFor(award.points, question.points),
      feedback: award.feedback?.trim() ? award.feedback.trim().slice(0, 4000) : null,
      reviewed_by: actor.id,
      reviewed_at: now,
    };
    if (answer) {
      const { error } = await admin.from("quiz_answers").update(values).eq("id", answer.id);
      if (error) throw new Error(`quiz answer update failed: ${error.message}`);
      answersByQuestion.set(question.id, { ...answer, ...values });
    } else {
      // Unanswered question: record the review so totals are explicit.
      const { data: inserted, error } = await admin
        .from("quiz_answers")
        .insert({ attempt_id: attempt.id, question_id: question.id, ...values })
        .select("id, question_id, selected_option_ids, text_answer, is_correct, points_awarded, feedback")
        .single();
      if (error) throw new Error(`quiz answer insert failed: ${error.message}`);
      answersByQuestion.set(question.id, inserted as ReviewAnswer);
    }
  }

  const gradable: GradableQuestion[] = questions.map((q) => ({
    id: q.id,
    question_type: q.question_type,
    points: q.points,
    accepted_answers: q.accepted_answers,
    case_sensitive: q.case_sensitive,
    requires_manual_review: q.requires_manual_review,
    options: q.options.map((o) => ({ id: o.id, is_correct: o.is_correct })),
  }));
  const grades: QuestionGrade[] = questions.map((q) => {
    const answer = answersByQuestion.get(q.id);
    const points = answer?.points_awarded ?? null;
    return {
      questionId: q.id,
      isCorrect: answer?.is_correct ?? (points === null ? null : false),
      pointsAwarded: answer ? points : 0,
      needsReview: Boolean(answer && points === null),
    };
  });
  const result = summarize(gradable, grades, quiz.passing_score);
  if (result.needsReview) throw new UserFacingError("Award points for every written answer before finishing the review.");

  const { error } = await admin
    .from("quiz_attempts")
    .update({
      status: "graded",
      score: result.score,
      max_score: result.maxScore,
      percent: result.percent,
      passed: result.passed,
      graded_by: actor.id,
      graded_at: now,
    })
    .eq("id", attempt.id);
  if (error) throw new Error(`attempt update failed: ${error.message}`);

  const course = await courseInfo(quiz.course_id);
  const url = `/learn/courses/${course.slug}/quizzes/${quiz.id}`;
  await notify(attempt.user_id, {
    category: "learning",
    type: "quiz_reviewed",
    title: `${quiz.title} reviewed: ${result.passed ? "passed" : "not passed"}`,
    body: `Score: ${result.percent}% (pass mark ${quiz.passing_score}%).`,
    url,
    email: {
      templateKey: "learning.instructor_feedback",
      idempotencyKey: `quiz-reviewed:${attempt.id}`,
      payload: {
        instructor_name: actor.fullName || actor.displayName,
        assignment_title: quiz.title,
        course_title: course.title,
        cta_url: appUrl(url),
      },
    },
  });

  if (result.passed) {
    await syncCompletionAfterGrading({ userId: attempt.user_id, courseId: quiz.course_id, quizId: quiz.id });
  }
  return result;
}
