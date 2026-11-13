/**
 * Pure grading rules for instructor reviews (unit tested).
 */

export interface RubricCriterion {
  id: string;
  criterion: string;
  description: string | null;
  points: number;
}

/** Normalise a stored rubric (tolerates older/alternate key names). */
export function parseRubric(raw: unknown): RubricCriterion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index): RubricCriterion | null => {
      if (!item || typeof item !== "object") return null;
      const r = item as Record<string, unknown>;
      const points = Number(r.points ?? r.max_points ?? r.maxPoints ?? 0);
      const criterion = String(r.criterion ?? r.title ?? r.name ?? "").trim();
      if (!criterion || !Number.isFinite(points) || points <= 0) return null;
      return {
        id: String(r.id ?? `criterion-${index + 1}`),
        criterion,
        description: typeof r.description === "string" && r.description.trim() ? r.description.trim() : null,
        points,
      };
    })
    .filter((c): c is RubricCriterion => c !== null);
}

export interface GradeInput {
  maxPoints: number;
  /** Explicit points; when omitted and a rubric is scored, the rubric total is used. */
  points?: number | null;
  rubric: RubricCriterion[];
  rubricScores?: Record<string, number>;
  isLate: boolean;
  latePenaltyPercent: number;
}

export interface GradeResult {
  rawPoints: number | null;
  finalPoints: number | null;
  penaltyApplied: number;
  errors: string[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeGrade(input: GradeInput): GradeResult {
  const errors: string[] = [];
  let rubricTotal: number | null = null;
  if (input.rubric.length && input.rubricScores && Object.keys(input.rubricScores).length) {
    rubricTotal = 0;
    for (const c of input.rubric) {
      const score = input.rubricScores[c.id];
      if (score === undefined || score === null || Number.isNaN(score)) {
        errors.push(`Score “${c.criterion}”.`);
        continue;
      }
      if (score < 0 || score > c.points) errors.push(`“${c.criterion}” must be between 0 and ${c.points}.`);
      rubricTotal += score;
    }
  }
  const raw = input.points ?? rubricTotal;
  if (raw === null || raw === undefined) return { rawPoints: null, finalPoints: null, penaltyApplied: 0, errors };
  if (raw < 0 || raw > input.maxPoints) errors.push(`Points must be between 0 and ${input.maxPoints}.`);
  const penalty = input.isLate ? Math.min(Math.max(input.latePenaltyPercent, 0), 100) : 0;
  const final = round2(raw * (1 - penalty / 100));
  return { rawPoints: round2(raw), finalPoints: final, penaltyApplied: penalty, errors };
}

/** A graded submission counts as passed when there is no pass mark or it meets it. */
export function submissionPasses(finalPoints: number | null, passingPoints: number | null): boolean {
  if (passingPoints === null || passingPoints === undefined) return true;
  return finalPoints !== null && finalPoints >= passingPoints;
}

/** Correctness flag for a manually reviewed answer (partial credit is neither). */
export function correctnessFor(points: number, maxPoints: number): boolean | null {
  if (points >= maxPoints) return true;
  if (points <= 0) return false;
  return null;
}
