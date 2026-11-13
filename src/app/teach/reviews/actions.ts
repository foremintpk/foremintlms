"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { assertCourseStaff } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { ok, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import {
  addSubmissionFeedback,
  gradeSubmission,
  loadAttemptForReview,
  loadSubmission,
  markSubmissionUnderReview,
  reviewQuizAttempt,
} from "@/lib/services/grading";

async function staffSubmission(submissionId: string) {
  const id = z.uuid().parse(submissionId);
  const loaded = await loadSubmission(id);
  if (!loaded) throw new UserFacingError("This submission no longer exists.");
  const { user } = await assertCourseStaff(loaded.submission.course_id);
  return { ...loaded, user };
}

export async function startReviewAction(input: { submissionId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { submission, user } = await staffSubmission(input.submissionId);
    await markSubmissionUnderReview(submission);
    await audit({ actor: user, action: "submission.review_started", entityType: "assignment_submission", entityId: submission.id });
    refresh();
    return ok(null, "Marked as in review");
  });
}

const gradeSchema = z.object({
  submissionId: z.uuid(),
  decision: z.enum(["approve", "grade", "request_resubmission"]),
  points: z.number().min(0).max(100000).nullable(),
  rubricScores: z.record(z.string().max(100), z.number().min(0).max(100000)).default({}),
  feedback: z.string().trim().max(20000).nullable(),
});

export async function gradeSubmissionAction(input: unknown): Promise<ActionResult<{ status: string }>> {
  return runAction(async () => {
    const parsed = gradeSchema.parse(input);
    const { submission, assignment, user } = await staffSubmission(parsed.submissionId);
    const result = await gradeSubmission(user, submission, assignment, {
      decision: parsed.decision,
      points: parsed.points,
      rubricScores: parsed.rubricScores,
      feedback: parsed.feedback,
    });
    await audit({
      actor: user,
      action: `submission.${parsed.decision}`,
      entityType: "assignment_submission",
      entityId: submission.id,
      summary: `${assignment.title}: ${result.status}${result.finalPoints !== null ? ` (${result.finalPoints}/${assignment.max_points})` : ""}`,
      metadata: { student_id: submission.user_id, course_id: assignment.course_id },
    });
    refresh();
    const message =
      parsed.decision === "approve" ? "Submission approved" : parsed.decision === "grade" ? "Grade saved" : "Resubmission requested";
    return ok({ status: result.status }, message);
  });
}

export async function addSubmissionCommentAction(input: { submissionId: string; body: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { submission, assignment, user } = await staffSubmission(input.submissionId);
    const body = z.string().trim().min(1, "Write some feedback first").max(20000).parse(input.body);
    await addSubmissionFeedback(user, submission, assignment, body);
    await audit({ actor: user, action: "submission.feedback_added", entityType: "assignment_submission", entityId: submission.id });
    refresh();
    return ok(null, "Feedback sent");
  });
}

const reviewSchema = z.object({
  attemptId: z.uuid(),
  awards: z
    .array(
      z.object({
        questionId: z.uuid(),
        points: z.number().min(0).max(100000),
        feedback: z.string().trim().max(4000).nullable(),
      }),
    )
    .max(200),
});

export async function reviewQuizAttemptAction(input: unknown): Promise<ActionResult<{ passed: boolean | null; percent: number }>> {
  return runAction(async () => {
    const parsed = reviewSchema.parse(input);
    const data = await loadAttemptForReview(parsed.attemptId);
    if (!data) throw new UserFacingError("This attempt no longer exists.");
    const { user } = await assertCourseStaff(data.attempt.course_id);
    const result = await reviewQuizAttempt(user, data, parsed.awards);
    await audit({
      actor: user,
      action: "quiz_attempt.reviewed",
      entityType: "quiz_attempt",
      entityId: data.attempt.id,
      summary: `${data.quiz.title}: ${result.percent}% (${result.passed ? "passed" : "not passed"})`,
      metadata: { student_id: data.attempt.user_id },
    });
    refresh();
    return ok({ passed: result.passed, percent: result.percent }, "Review saved");
  });
}
