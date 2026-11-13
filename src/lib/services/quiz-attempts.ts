import "server-only";
import { randomInt } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SessionUser } from "@/lib/auth/session";
import { getCourseAccess } from "@/lib/services/access";
import { syncCompletionAfterGrading } from "@/lib/services/progress";
import { notify } from "@/lib/services/notifications";
import { UserFacingError } from "@/lib/actions";
import { isReleased, lessonReleaseDate } from "@/lib/domain/access";
import {
  canRevealAnswers,
  canStartAttempt,
  gradeAttempt,
  isAttemptExpired,
  shuffle,
  type AnswerInput,
  type GradableQuestion,
  type QuestionType,
} from "@/lib/domain/quiz";

const cryptoRandom = () => randomInt(0, 2 ** 32) / 2 ** 32;

export interface QuizRow {
  id: string;
  course_id: string;
  lesson_id: string | null;
  title: string;
  description: string | null;
  time_limit_minutes: number | null;
  max_attempts: number | null;
  passing_score: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  question_bank_id: string | null;
  draw_count: number | null;
  show_correct_answers: "never" | "after_submit" | "after_pass";
  retry_cooldown_minutes: number;
  status: string;
}

export interface AttemptRow {
  id: string;
  quiz_id: string;
  user_id: string;
  course_id: string;
  attempt_number: number;
  status: "in_progress" | "submitted" | "needs_review" | "graded" | "expired";
  question_ids: string[];
  option_orders: Record<string, string[]>;
  started_at: string;
  expires_at: string | null;
  submitted_at: string | null;
  score: number | null;
  max_score: number | null;
  percent: number | null;
  passed: boolean | null;
}

const QUIZ_COLUMNS =
  "id, course_id, lesson_id, title, description, time_limit_minutes, max_attempts, passing_score, shuffle_questions, shuffle_options, question_bank_id, draw_count, show_correct_answers, retry_cooldown_minutes, status";
const ATTEMPT_COLUMNS =
  "id, quiz_id, user_id, course_id, attempt_number, status, question_ids, option_orders, started_at, expires_at, submitted_at, score, max_score, percent, passed";

interface QuestionRow {
  id: string;
  question_type: QuestionType;
  prompt: string;
  explanation: string | null;
  points: number;
  sort_order: number;
  accepted_answers: string[];
  case_sensitive: boolean;
  requires_manual_review: boolean;
  quiz_options: { id: string; label: string; is_correct: boolean; sort_order: number }[];
}

/** Load a quiz and verify the learner may take it (access, published, lesson released). */
export async function getQuizForLearner(user: SessionUser, quizId: string, courseId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("quizzes").select(QUIZ_COLUMNS).eq("id", quizId).eq("course_id", courseId).maybeSingle();
  const quiz = data as QuizRow | null;
  if (!quiz) return null;
  const { data: course } = await admin.from("courses").select("id, status").eq("id", courseId).single();
  const access = await getCourseAccess(user, { id: courseId, status: course?.status ?? "draft" });
  if (!access.hasAccess) throw new UserFacingError("You don't have access to this course.");
  if (quiz.status !== "published" && !access.isStaff) throw new UserFacingError("This quiz isn't available.");
  if (quiz.lesson_id && !access.isStaff) {
    const { data: lesson } = await admin
      .from("lessons")
      .select("release_at, release_after_days, is_published, course_modules(release_at, release_after_days, is_published)")
      .eq("id", quiz.lesson_id)
      .maybeSingle();
    const l = lesson as {
      release_at: string | null;
      release_after_days: number | null;
      is_published: boolean;
      course_modules: { release_at: string | null; release_after_days: number | null; is_published: boolean } | null;
    } | null;
    if (l && l.course_modules) {
      const release = lessonReleaseDate(l, l.course_modules, access.enrollment ? new Date(access.enrollment.enrolled_at) : null);
      if (!isReleased(release)) throw new UserFacingError("This quiz hasn't been released yet.");
    }
  }
  return { quiz, access };
}

export async function listAttempts(userId: string, quizId: string): Promise<AttemptRow[]> {
  const { data } = await createAdminClient()
    .from("quiz_attempts")
    .select(ATTEMPT_COLUMNS)
    .eq("user_id", userId)
    .eq("quiz_id", quizId)
    .order("attempt_number", { ascending: false });
  return (data ?? []) as AttemptRow[];
}

export function attemptAvailability(quiz: QuizRow, attempts: AttemptRow[], now = new Date()) {
  const finished = attempts.filter((a) => a.status !== "in_progress");
  const inProgress = attempts.find((a) => a.status === "in_progress" && !isAttemptExpired(a.expires_at, now));
  const lastSubmitted = finished.find((a) => a.submitted_at)?.submitted_at;
  const rule = canStartAttempt({
    maxAttempts: quiz.max_attempts,
    attemptsUsed: finished.length,
    cooldownMinutes: quiz.retry_cooldown_minutes,
    lastSubmittedAt: lastSubmitted ? new Date(lastSubmitted) : null,
    hasInProgress: false,
    alreadyPassed: finished.some((a) => a.passed),
    now,
  });
  return { inProgress: inProgress ?? null, ...rule, attemptsUsed: finished.length };
}

async function loadQuestions(ids: string[]): Promise<QuestionRow[]> {
  if (ids.length === 0) return [];
  const { data } = await createAdminClient()
    .from("quiz_questions")
    .select("id, question_type, prompt, explanation, points, sort_order, accepted_answers, case_sensitive, requires_manual_review, quiz_options(id, label, is_correct, sort_order)")
    .in("id", ids);
  const rows = (data ?? []) as QuestionRow[];
  const order = new Map(ids.map((id, i) => [id, i]));
  return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/** Auto-submit attempts whose timer ran out, grading the answers saved in time. */
async function finalizeExpired(user: SessionUser, quiz: QuizRow, attempts: AttemptRow[]) {
  for (const a of attempts) {
    if (a.status === "in_progress" && isAttemptExpired(a.expires_at)) {
      await gradeAndStore(user, quiz, a);
    }
  }
}

/** Start (or resume) an attempt. */
export async function startAttempt(user: SessionUser, quizId: string, courseId: string): Promise<{ attemptId: string; resumed: boolean }> {
  const ctx = await getQuizForLearner(user, quizId, courseId);
  if (!ctx) throw new UserFacingError("Quiz not found.");
  const { quiz } = ctx;
  let attempts = await listAttempts(user.id, quiz.id);
  await finalizeExpired(user, quiz, attempts);
  attempts = await listAttempts(user.id, quiz.id);

  const availability = attemptAvailability(quiz, attempts);
  if (availability.inProgress) return { attemptId: availability.inProgress.id, resumed: true };
  if (!availability.allowed) {
    throw new UserFacingError(
      availability.reason === "max_attempts"
        ? "You've used all your attempts for this quiz."
        : availability.reason === "cooldown" && availability.retryAt
          ? `You can try again after ${availability.retryAt.toUTCString()}.`
          : "You can't start a new attempt right now.",
    );
  }

  const admin = createAdminClient();
  let questionIds: string[];
  if (quiz.question_bank_id && quiz.draw_count) {
    const { data } = await admin.from("quiz_questions").select("id").eq("question_bank_id", quiz.question_bank_id);
    questionIds = shuffle(((data ?? []) as { id: string }[]).map((q) => q.id), cryptoRandom).slice(0, quiz.draw_count);
  } else {
    const { data } = await admin.from("quiz_questions").select("id").eq("quiz_id", quiz.id).order("sort_order").order("created_at");
    questionIds = ((data ?? []) as { id: string }[]).map((q) => q.id);
    if (quiz.shuffle_questions) questionIds = shuffle(questionIds, cryptoRandom);
  }
  if (questionIds.length === 0) throw new UserFacingError("This quiz has no questions yet.");

  const questions = await loadQuestions(questionIds);
  const optionOrders: Record<string, string[]> = {};
  for (const q of questions) {
    const ids = [...q.quiz_options].sort((a, b) => a.sort_order - b.sort_order).map((o) => o.id);
    optionOrders[q.id] = quiz.shuffle_options && q.question_type !== "true_false" ? shuffle(ids, cryptoRandom) : ids;
  }

  const attemptNumber = (attempts[0]?.attempt_number ?? 0) + 1;
  const now = new Date();
  const { data: created, error } = await admin
    .from("quiz_attempts")
    .insert({
      quiz_id: quiz.id,
      user_id: user.id,
      course_id: quiz.course_id,
      attempt_number: attemptNumber,
      status: "in_progress",
      question_ids: questionIds,
      option_orders: optionOrders,
      started_at: now.toISOString(),
      expires_at: quiz.time_limit_minutes ? new Date(now.getTime() + quiz.time_limit_minutes * 60_000).toISOString() : null,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") {
      const latest = (await listAttempts(user.id, quiz.id)).find((a) => a.status === "in_progress");
      if (latest) return { attemptId: latest.id, resumed: true };
    }
    throw new Error(`start attempt failed: ${error.message}`);
  }
  return { attemptId: created.id, resumed: false };
}

async function loadOwnAttempt(user: SessionUser, attemptId: string): Promise<AttemptRow> {
  const { data } = await createAdminClient().from("quiz_attempts").select(ATTEMPT_COLUMNS).eq("id", attemptId).maybeSingle();
  const attempt = data as AttemptRow | null;
  if (!attempt || attempt.user_id !== user.id) throw new UserFacingError("Attempt not found.");
  return attempt;
}

/** Question payload safe to send to the browser: no answer keys, no explanations. */
export interface SafeQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  points: number;
  options: { id: string; label: string }[];
}

export async function getAttemptForTaking(user: SessionUser, attemptId: string) {
  const attempt = await loadOwnAttempt(user, attemptId);
  const questions = await loadQuestions(attempt.question_ids);
  const { data: saved } = await createAdminClient()
    .from("quiz_answers")
    .select("question_id, selected_option_ids, text_answer")
    .eq("attempt_id", attempt.id);
  const safe: SafeQuestion[] = questions.map((q) => {
    const order = attempt.option_orders?.[q.id] ?? q.quiz_options.map((o) => o.id);
    const byId = new Map(q.quiz_options.map((o) => [o.id, o]));
    return {
      id: q.id,
      type: q.question_type,
      prompt: q.prompt,
      points: Number(q.points),
      options: order.filter((id) => byId.has(id)).map((id) => ({ id, label: byId.get(id)!.label })),
    };
  });
  const answers: Record<string, { selected: string[]; text: string }> = {};
  for (const a of (saved ?? []) as { question_id: string; selected_option_ids: string[]; text_answer: string | null }[]) {
    answers[a.question_id] = { selected: a.selected_option_ids ?? [], text: a.text_answer ?? "" };
  }
  return { attempt, questions: safe, answers };
}

function sanitizeAnswers(attempt: AttemptRow, answers: AnswerInput[]): AnswerInput[] {
  const allowed = new Set(attempt.question_ids);
  return answers
    .filter((a) => allowed.has(a.questionId))
    .map((a) => ({
      questionId: a.questionId,
      selectedOptionIds: [...new Set((a.selectedOptionIds ?? []).filter((id) => (attempt.option_orders?.[a.questionId] ?? []).includes(id)))],
      textAnswer: a.textAnswer ? String(a.textAnswer).slice(0, 4000) : null,
    }));
}

async function persistAnswers(attemptId: string, answers: AnswerInput[]) {
  if (answers.length === 0) return;
  const { error } = await createAdminClient()
    .from("quiz_answers")
    .upsert(
      answers.map((a) => ({
        attempt_id: attemptId,
        question_id: a.questionId,
        selected_option_ids: a.selectedOptionIds,
        text_answer: a.textAnswer ?? null,
      })),
      { onConflict: "attempt_id,question_id" },
    );
  if (error) throw new Error(`save answers failed: ${error.message}`);
}

/** Autosave while the attempt is open. */
export async function saveAttemptAnswers(user: SessionUser, attemptId: string, answers: AnswerInput[]) {
  const attempt = await loadOwnAttempt(user, attemptId);
  if (attempt.status !== "in_progress") throw new UserFacingError("This attempt has already been submitted.");
  if (isAttemptExpired(attempt.expires_at)) throw new UserFacingError("Time is up for this attempt.");
  await persistAnswers(attempt.id, sanitizeAnswers(attempt, answers));
}

async function gradeAndStore(user: SessionUser, quiz: QuizRow, attempt: AttemptRow) {
  const admin = createAdminClient();
  const questions = await loadQuestions(attempt.question_ids);
  const { data: saved } = await admin
    .from("quiz_answers")
    .select("question_id, selected_option_ids, text_answer")
    .eq("attempt_id", attempt.id);
  const answers: AnswerInput[] = ((saved ?? []) as { question_id: string; selected_option_ids: string[]; text_answer: string | null }[]).map((a) => ({
    questionId: a.question_id,
    selectedOptionIds: a.selected_option_ids ?? [],
    textAnswer: a.text_answer,
  }));
  const gradable: GradableQuestion[] = questions.map((q) => ({
    id: q.id,
    question_type: q.question_type,
    points: Number(q.points),
    accepted_answers: q.accepted_answers ?? [],
    case_sensitive: q.case_sensitive,
    requires_manual_review: q.requires_manual_review,
    options: q.quiz_options.map((o) => ({ id: o.id, is_correct: o.is_correct })),
  }));
  const result = gradeAttempt(gradable, answers, quiz.passing_score);
  const answered = new Map(answers.map((a) => [a.questionId, a]));

  await admin.from("quiz_answers").upsert(
    result.grades.map((g) => ({
      attempt_id: attempt.id,
      question_id: g.questionId,
      selected_option_ids: answered.get(g.questionId)?.selectedOptionIds ?? [],
      text_answer: answered.get(g.questionId)?.textAnswer ?? null,
      is_correct: g.isCorrect,
      points_awarded: g.pointsAwarded,
    })),
    { onConflict: "attempt_id,question_id" },
  );

  const { error } = await admin
    .from("quiz_attempts")
    .update({
      status: result.needsReview ? "needs_review" : "graded",
      submitted_at: new Date().toISOString(),
      score: result.score,
      max_score: result.maxScore,
      percent: result.percent,
      passed: result.passed,
      graded_at: result.needsReview ? null : new Date().toISOString(),
    })
    .eq("id", attempt.id)
    .eq("status", "in_progress");
  if (error) throw new Error(`grade attempt failed: ${error.message}`);

  if (result.needsReview) {
    const { data: staff } = await admin.from("course_instructors").select("user_id").eq("course_id", quiz.course_id);
    await notify(((staff ?? []) as { user_id: string }[]).map((s) => s.user_id), {
      category: "learning",
      type: "quiz_needs_review",
      title: `Quiz answers to review: ${quiz.title}`,
      body: `${user.fullName || user.displayName} submitted answers that need marking.`,
      url: "/teach/reviews",
    });
  } else if (result.passed) {
    await syncCompletionAfterGrading({ userId: user.id, courseId: quiz.course_id, quizId: quiz.id });
  }
  return result;
}

/** Submit: save any final answers (only if time remains), then grade. */
export async function submitAttempt(user: SessionUser, attemptId: string, finalAnswers: AnswerInput[]) {
  const attempt = await loadOwnAttempt(user, attemptId);
  if (attempt.status !== "in_progress") return { attemptId, alreadySubmitted: true };
  const { data } = await createAdminClient().from("quizzes").select(QUIZ_COLUMNS).eq("id", attempt.quiz_id).single();
  const quiz = data as QuizRow;
  // Answers sent after the timer (plus a short network grace) are ignored.
  if (!isAttemptExpired(attempt.expires_at)) {
    await persistAnswers(attempt.id, sanitizeAnswers(attempt, finalAnswers));
  }
  await gradeAndStore(user, quiz, attempt);
  return { attemptId, alreadySubmitted: false };
}

export interface ResultQuestion {
  id: string;
  prompt: string;
  type: QuestionType;
  points: number;
  pointsAwarded: number | null;
  isCorrect: boolean | null;
  selected: string[];
  text: string | null;
  feedback: string | null;
  options: { id: string; label: string; isCorrect: boolean | null }[];
  explanation: string | null;
  acceptedAnswers: string[] | null;
}

export async function getAttemptResult(user: SessionUser, attemptId: string) {
  const attempt = await loadOwnAttempt(user, attemptId);
  if (attempt.status === "in_progress") return { attempt, quiz: null, reveal: false, questions: [] as ResultQuestion[] };
  const admin = createAdminClient();
  const [{ data: quizData }, questions, { data: saved }] = await Promise.all([
    admin.from("quizzes").select(QUIZ_COLUMNS).eq("id", attempt.quiz_id).single(),
    loadQuestions(attempt.question_ids),
    admin.from("quiz_answers").select("question_id, selected_option_ids, text_answer, is_correct, points_awarded, feedback").eq("attempt_id", attempt.id),
  ]);
  const quiz = quizData as QuizRow;
  const reveal = canRevealAnswers(quiz.show_correct_answers, attempt.passed);
  const answers = new Map(
    ((saved ?? []) as {
      question_id: string;
      selected_option_ids: string[];
      text_answer: string | null;
      is_correct: boolean | null;
      points_awarded: number | null;
      feedback: string | null;
    }[]).map((a) => [a.question_id, a]),
  );
  const result: ResultQuestion[] = questions.map((q) => {
    const a = answers.get(q.id);
    const order = attempt.option_orders?.[q.id] ?? q.quiz_options.map((o) => o.id);
    const byId = new Map(q.quiz_options.map((o) => [o.id, o]));
    return {
      id: q.id,
      prompt: q.prompt,
      type: q.question_type,
      points: Number(q.points),
      pointsAwarded: a?.points_awarded != null ? Number(a.points_awarded) : null,
      isCorrect: a?.is_correct ?? null,
      selected: a?.selected_option_ids ?? [],
      text: a?.text_answer ?? null,
      feedback: a?.feedback ?? null,
      options: order.filter((id) => byId.has(id)).map((id) => ({ id, label: byId.get(id)!.label, isCorrect: reveal ? byId.get(id)!.is_correct : null })),
      explanation: reveal ? q.explanation : null,
      acceptedAnswers: reveal && q.question_type === "short_answer" && !q.requires_manual_review ? q.accepted_answers : null,
    };
  });
  return { attempt, quiz, reveal, questions: result };
}
