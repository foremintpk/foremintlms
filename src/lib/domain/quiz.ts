/**
 * Quiz grading and attempt rules. Pure functions — no I/O.
 */

export type QuestionType = "single_choice" | "multiple_choice" | "true_false" | "short_answer";

export interface GradableQuestion {
  id: string;
  question_type: QuestionType;
  points: number;
  accepted_answers: string[];
  case_sensitive: boolean;
  requires_manual_review: boolean;
  options: { id: string; is_correct: boolean }[];
}

export interface AnswerInput {
  questionId: string;
  selectedOptionIds: string[];
  textAnswer?: string | null;
}

export interface QuestionGrade {
  questionId: string;
  isCorrect: boolean | null;
  pointsAwarded: number | null;
  needsReview: boolean;
}

export function normalizeAnswer(value: string, caseSensitive: boolean): string {
  const collapsed = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  return caseSensitive ? collapsed : collapsed.toLowerCase();
}

export function gradeQuestion(q: GradableQuestion, answer: AnswerInput | undefined): QuestionGrade {
  const base = { questionId: q.id };
  if (q.question_type === "short_answer") {
    const text = answer?.textAnswer?.trim() ?? "";
    if (!text) return { ...base, isCorrect: false, pointsAwarded: 0, needsReview: false };
    if (q.requires_manual_review || q.accepted_answers.length === 0) {
      return { ...base, isCorrect: null, pointsAwarded: null, needsReview: true };
    }
    const given = normalizeAnswer(text, q.case_sensitive);
    const ok = q.accepted_answers.some((a) => normalizeAnswer(a, q.case_sensitive) === given);
    return { ...base, isCorrect: ok, pointsAwarded: ok ? q.points : 0, needsReview: false };
  }

  const validIds = new Set(q.options.map((o) => o.id));
  const selected = [...new Set(answer?.selectedOptionIds ?? [])].filter((id) => validIds.has(id));
  const correct = q.options.filter((o) => o.is_correct).map((o) => o.id);

  if (q.question_type === "multiple_choice") {
    // All-or-nothing: the selection must match the correct set exactly.
    const ok = selected.length === correct.length && correct.every((id) => selected.includes(id));
    return { ...base, isCorrect: ok, pointsAwarded: ok ? q.points : 0, needsReview: false };
  }

  // single_choice / true_false
  const ok = selected.length === 1 && correct.includes(selected[0]);
  return { ...base, isCorrect: ok, pointsAwarded: ok ? q.points : 0, needsReview: false };
}

export interface AttemptGrade {
  grades: QuestionGrade[];
  score: number;
  maxScore: number;
  percent: number;
  /** null while any answer awaits manual review. */
  passed: boolean | null;
  needsReview: boolean;
}

export function gradeAttempt(questions: GradableQuestion[], answers: AnswerInput[], passingScore: number): AttemptGrade {
  const byQuestion = new Map(answers.map((a) => [a.questionId, a]));
  const grades = questions.map((q) => gradeQuestion(q, byQuestion.get(q.id)));
  return summarize(questions, grades, passingScore);
}

/** Recompute totals after a teacher reviews manual answers. */
export function summarize(questions: GradableQuestion[], grades: QuestionGrade[], passingScore: number): AttemptGrade {
  const maxScore = round2(questions.reduce((s, q) => s + Number(q.points), 0));
  const score = round2(grades.reduce((s, g) => s + (g.pointsAwarded ?? 0), 0));
  const needsReview = grades.some((g) => g.needsReview && g.pointsAwarded === null);
  const percent = maxScore > 0 ? round2((score / maxScore) * 100) : 0;
  return { grades, score, maxScore, percent, passed: needsReview ? null : percent >= passingScore, needsReview };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface AttemptRuleInput {
  maxAttempts: number | null;
  attemptsUsed: number;
  cooldownMinutes: number;
  lastSubmittedAt: Date | null;
  hasInProgress: boolean;
  alreadyPassed: boolean;
  now?: Date;
}

export type AttemptBlock = "max_attempts" | "cooldown" | "in_progress" | null;

export function canStartAttempt(input: AttemptRuleInput): { allowed: boolean; reason: AttemptBlock; retryAt: Date | null } {
  const now = input.now ?? new Date();
  if (input.hasInProgress) return { allowed: false, reason: "in_progress", retryAt: null };
  if (input.maxAttempts !== null && input.attemptsUsed >= input.maxAttempts) {
    return { allowed: false, reason: "max_attempts", retryAt: null };
  }
  if (input.cooldownMinutes > 0 && input.lastSubmittedAt) {
    const retryAt = new Date(input.lastSubmittedAt.getTime() + input.cooldownMinutes * 60_000);
    if (retryAt.getTime() > now.getTime()) return { allowed: false, reason: "cooldown", retryAt };
  }
  return { allowed: true, reason: null, retryAt: null };
}

/** Fisher–Yates with an injectable random source (crypto in prod, seeded in tests). */
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function isAttemptExpired(expiresAt: string | null, now: Date = new Date(), graceSeconds = 15): boolean {
  if (!expiresAt) return false;
  return now.getTime() > new Date(expiresAt).getTime() + graceSeconds * 1000;
}

/** Whether correct answers may be revealed to the learner after submitting. */
export function canRevealAnswers(mode: "never" | "after_submit" | "after_pass", passed: boolean | null): boolean {
  if (mode === "never") return false;
  if (mode === "after_submit") return true;
  return passed === true;
}
