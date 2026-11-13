import { describe, expect, it } from "vitest";
import {
  canRevealAnswers,
  canStartAttempt,
  gradeAttempt,
  gradeQuestion,
  isAttemptExpired,
  normalizeAnswer,
  shuffle,
  summarize,
  type GradableQuestion,
} from "@/lib/domain/quiz";

function q(partial: Partial<GradableQuestion> & Pick<GradableQuestion, "id" | "question_type">): GradableQuestion {
  return { points: 1, accepted_answers: [], case_sensitive: false, requires_manual_review: false, options: [], ...partial };
}

const single = q({
  id: "q1",
  question_type: "single_choice",
  options: [
    { id: "a", is_correct: false },
    { id: "b", is_correct: true },
  ],
});
const multi = q({
  id: "q2",
  question_type: "multiple_choice",
  points: 2,
  options: [
    { id: "a", is_correct: true },
    { id: "b", is_correct: true },
    { id: "c", is_correct: false },
  ],
});
const tf = q({ id: "q3", question_type: "true_false", options: [{ id: "t", is_correct: true }, { id: "f", is_correct: false }] });
const short = q({ id: "q4", question_type: "short_answer", accepted_answers: ["Limited Liability Company", "LLC"] });
const manual = q({ id: "q5", question_type: "short_answer", requires_manual_review: true, points: 3 });

describe("gradeQuestion", () => {
  it("grades single choice", () => {
    expect(gradeQuestion(single, { questionId: "q1", selectedOptionIds: ["b"] })).toMatchObject({ isCorrect: true, pointsAwarded: 1 });
    expect(gradeQuestion(single, { questionId: "q1", selectedOptionIds: ["a"] })).toMatchObject({ isCorrect: false, pointsAwarded: 0 });
  });
  it("rejects multiple selections on single choice", () => {
    expect(gradeQuestion(single, { questionId: "q1", selectedOptionIds: ["a", "b"] }).isCorrect).toBe(false);
  });
  it("treats unanswered as wrong", () => {
    expect(gradeQuestion(single, undefined)).toMatchObject({ isCorrect: false, pointsAwarded: 0, needsReview: false });
  });
  it("ignores option ids that don't belong to the question", () => {
    expect(gradeQuestion(single, { questionId: "q1", selectedOptionIds: ["forged"] }).isCorrect).toBe(false);
  });
  it("grades multiple choice all-or-nothing", () => {
    expect(gradeQuestion(multi, { questionId: "q2", selectedOptionIds: ["a", "b"] })).toMatchObject({ isCorrect: true, pointsAwarded: 2 });
    expect(gradeQuestion(multi, { questionId: "q2", selectedOptionIds: ["a"] }).pointsAwarded).toBe(0);
    expect(gradeQuestion(multi, { questionId: "q2", selectedOptionIds: ["a", "b", "c"] }).pointsAwarded).toBe(0);
  });
  it("de-duplicates repeated selections", () => {
    expect(gradeQuestion(multi, { questionId: "q2", selectedOptionIds: ["a", "a", "b"] }).isCorrect).toBe(true);
  });
  it("grades true/false", () => {
    expect(gradeQuestion(tf, { questionId: "q3", selectedOptionIds: ["t"] }).isCorrect).toBe(true);
  });
  it("matches short answers case- and whitespace-insensitively", () => {
    expect(gradeQuestion(short, { questionId: "q4", selectedOptionIds: [], textAnswer: "  limited   liability company " }).isCorrect).toBe(true);
    expect(gradeQuestion(short, { questionId: "q4", selectedOptionIds: [], textAnswer: "llc" }).isCorrect).toBe(true);
    expect(gradeQuestion(short, { questionId: "q4", selectedOptionIds: [], textAnswer: "LTD" }).isCorrect).toBe(false);
  });
  it("respects case-sensitive short answers", () => {
    const cs = { ...short, case_sensitive: true };
    expect(gradeQuestion(cs, { questionId: "q4", selectedOptionIds: [], textAnswer: "llc" }).isCorrect).toBe(false);
    expect(gradeQuestion(cs, { questionId: "q4", selectedOptionIds: [], textAnswer: "LLC" }).isCorrect).toBe(true);
  });
  it("sends manual-review answers to a teacher", () => {
    expect(gradeQuestion(manual, { questionId: "q5", selectedOptionIds: [], textAnswer: "My essay" })).toMatchObject({
      isCorrect: null,
      pointsAwarded: null,
      needsReview: true,
    });
  });
  it("scores a blank manual answer as zero without review", () => {
    expect(gradeQuestion(manual, { questionId: "q5", selectedOptionIds: [], textAnswer: "  " })).toMatchObject({ pointsAwarded: 0, needsReview: false });
  });
});

describe("gradeAttempt", () => {
  it("computes score, percent and pass", () => {
    const r = gradeAttempt(
      [single, multi, tf],
      [
        { questionId: "q1", selectedOptionIds: ["b"] },
        { questionId: "q2", selectedOptionIds: ["a", "b"] },
        { questionId: "q3", selectedOptionIds: ["f"] },
      ],
      70,
    );
    expect(r).toMatchObject({ score: 3, maxScore: 4, percent: 75, passed: true, needsReview: false });
  });
  it("fails below the passing score", () => {
    const r = gradeAttempt([single, multi], [{ questionId: "q1", selectedOptionIds: ["b"] }], 50);
    expect(r).toMatchObject({ score: 1, maxScore: 3, percent: 33.33, passed: false });
  });
  it("leaves pass undecided while answers await review", () => {
    const r = gradeAttempt([single, manual], [{ questionId: "q1", selectedOptionIds: ["b"] }, { questionId: "q5", selectedOptionIds: [], textAnswer: "x" }], 50);
    expect(r.needsReview).toBe(true);
    expect(r.passed).toBeNull();
  });
  it("finalises after a teacher awards points", () => {
    const first = gradeAttempt([single, manual], [{ questionId: "q1", selectedOptionIds: ["b"] }, { questionId: "q5", selectedOptionIds: [], textAnswer: "x" }], 50);
    const reviewed = first.grades.map((g) => (g.questionId === "q5" ? { ...g, pointsAwarded: 2, isCorrect: true, needsReview: false } : g));
    const r = summarize([single, manual], reviewed, 50);
    expect(r).toMatchObject({ score: 3, maxScore: 4, percent: 75, passed: true, needsReview: false });
  });
});

describe("canStartAttempt", () => {
  const now = new Date("2026-06-01T12:00:00Z");
  const base = { maxAttempts: 3, attemptsUsed: 0, cooldownMinutes: 0, lastSubmittedAt: null, hasInProgress: false, alreadyPassed: false, now };
  it("allows a first attempt", () => {
    expect(canStartAttempt(base).allowed).toBe(true);
  });
  it("blocks when an attempt is in progress", () => {
    expect(canStartAttempt({ ...base, hasInProgress: true }).reason).toBe("in_progress");
  });
  it("enforces the attempt limit", () => {
    expect(canStartAttempt({ ...base, attemptsUsed: 3 }).reason).toBe("max_attempts");
    expect(canStartAttempt({ ...base, maxAttempts: null, attemptsUsed: 99 }).allowed).toBe(true);
  });
  it("enforces the retry cooldown", () => {
    const r = canStartAttempt({ ...base, attemptsUsed: 1, cooldownMinutes: 30, lastSubmittedAt: new Date("2026-06-01T11:45:00Z") });
    expect(r.reason).toBe("cooldown");
    expect(r.retryAt?.toISOString()).toBe("2026-06-01T12:15:00.000Z");
    expect(canStartAttempt({ ...base, attemptsUsed: 1, cooldownMinutes: 10, lastSubmittedAt: new Date("2026-06-01T11:45:00Z") }).allowed).toBe(true);
  });
});

describe("helpers", () => {
  it("normalizes unicode and whitespace", () => {
    expect(normalizeAnswer("  Ｆｏｏ   Bar ", false)).toBe("foo bar");
  });
  it("shuffles deterministically with an injected random source and keeps all items", () => {
    let i = 0;
    const seq = [0.1, 0.9, 0.5, 0.3];
    const out = shuffle([1, 2, 3, 4, 5], () => seq[i++ % seq.length]);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(shuffle([1, 2, 3], () => 0.999999)).toEqual([1, 2, 3]);
  });
  it("detects expired attempts with a grace window", () => {
    const now = new Date("2026-06-01T12:00:10Z");
    expect(isAttemptExpired(null, now)).toBe(false);
    expect(isAttemptExpired("2026-06-01T12:00:00Z", now)).toBe(false);
    expect(isAttemptExpired("2026-06-01T11:59:00Z", now)).toBe(true);
  });
  it("reveals answers per quiz setting", () => {
    expect(canRevealAnswers("never", true)).toBe(false);
    expect(canRevealAnswers("after_submit", false)).toBe(true);
    expect(canRevealAnswers("after_pass", false)).toBe(false);
    expect(canRevealAnswers("after_pass", true)).toBe(true);
    expect(canRevealAnswers("after_pass", null)).toBe(false);
  });
});
