import { describe, expect, it } from "vitest";
import { computeGrade, correctnessFor, parseRubric, submissionPasses } from "@/lib/services/grading-rules";

const rubric = parseRubric([
  { id: "r1", criterion: "Research quality", points: 40 },
  { id: "r2", criterion: "Listing copy", description: "Clear and persuasive", points: 60 },
]);

describe("parseRubric", () => {
  it("normalises criteria and drops invalid rows", () => {
    expect(rubric).toHaveLength(2);
    expect(rubric[1]).toEqual({ id: "r2", criterion: "Listing copy", description: "Clear and persuasive", points: 60 });
    expect(parseRubric([{ title: "Alt key", max_points: 5 }, { criterion: "", points: 3 }, { criterion: "Zero", points: 0 }, null, "x"])).toEqual([
      { id: "criterion-1", criterion: "Alt key", description: null, points: 5 },
    ]);
    expect(parseRubric(null)).toEqual([]);
  });
});

describe("computeGrade", () => {
  it("sums rubric scores when no explicit points are given", () => {
    const g = computeGrade({ maxPoints: 100, rubric, rubricScores: { r1: 30, r2: 45.5 }, isLate: false, latePenaltyPercent: 0 });
    expect(g).toEqual({ rawPoints: 75.5, finalPoints: 75.5, penaltyApplied: 0, errors: [] });
  });

  it("lets explicit points override the rubric total", () => {
    const g = computeGrade({ maxPoints: 100, points: 90, rubric, rubricScores: { r1: 30, r2: 45 }, isLate: false, latePenaltyPercent: 0 });
    expect(g.finalPoints).toBe(90);
  });

  it("applies the late penalty only to late submissions", () => {
    expect(computeGrade({ maxPoints: 100, points: 80, rubric: [], isLate: true, latePenaltyPercent: 10 }).finalPoints).toBe(72);
    expect(computeGrade({ maxPoints: 100, points: 80, rubric: [], isLate: false, latePenaltyPercent: 10 }).finalPoints).toBe(80);
  });

  it("reports out-of-range and missing rubric scores", () => {
    expect(computeGrade({ maxPoints: 100, points: 120, rubric: [], isLate: false, latePenaltyPercent: 0 }).errors.length).toBe(1);
    expect(computeGrade({ maxPoints: 100, rubric, rubricScores: { r1: 50 }, isLate: false, latePenaltyPercent: 0 }).errors.length).toBe(2);
  });

  it("returns no grade when nothing was scored", () => {
    expect(computeGrade({ maxPoints: 100, points: null, rubric, rubricScores: {}, isLate: false, latePenaltyPercent: 0 })).toEqual({
      rawPoints: null,
      finalPoints: null,
      penaltyApplied: 0,
      errors: [],
    });
  });
});

describe("pass and correctness rules", () => {
  it("passes when there is no pass mark or it is met", () => {
    expect(submissionPasses(10, null)).toBe(true);
    expect(submissionPasses(70, 70)).toBe(true);
    expect(submissionPasses(69.5, 70)).toBe(false);
    expect(submissionPasses(null, 70)).toBe(false);
  });

  it("marks full credit correct, zero incorrect and partial credit as neither", () => {
    expect(correctnessFor(2, 2)).toBe(true);
    expect(correctnessFor(0, 2)).toBe(false);
    expect(correctnessFor(1, 2)).toBeNull();
  });
});
