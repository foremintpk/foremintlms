/** Certificate eligibility and numbering. Pure functions. */

export interface CertificateRules {
  certificate_enabled: boolean;
  certificate_min_progress: number;
  certificate_require_quizzes: boolean;
  certificate_require_assignments: boolean;
}

export interface EligibilityInput {
  course: CertificateRules;
  progressPercent: number;
  quizzes: { id: string; title: string; passed: boolean }[];
  assignments: { id: string; title: string; status: string | null }[];
}

export interface Eligibility {
  eligible: boolean;
  missing: string[];
}

const ASSIGNMENT_DONE = new Set(["graded", "approved"]);

export function certificateEligibility(input: EligibilityInput): Eligibility {
  const missing: string[] = [];
  if (!input.course.certificate_enabled) return { eligible: false, missing: ["This course does not issue certificates."] };
  if (input.progressPercent + 1e-9 < input.course.certificate_min_progress) {
    missing.push(`Complete at least ${input.course.certificate_min_progress}% of the lessons (you're at ${Math.floor(input.progressPercent)}%).`);
  }
  if (input.course.certificate_require_quizzes) {
    for (const q of input.quizzes) if (!q.passed) missing.push(`Pass the quiz “${q.title}”.`);
  }
  if (input.course.certificate_require_assignments) {
    for (const a of input.assignments) {
      if (!a.status || !ASSIGNMENT_DONE.has(a.status)) missing.push(`Get the assignment “${a.title}” graded.`);
    }
  }
  return { eligible: missing.length === 0, missing };
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I for readability

/** FMA-2026-7K3Q9XPA — unique, readable, hard to guess. */
export function generateCertificateNumber(issuedAt: Date, randomBytes: Uint8Array): string {
  let code = "";
  for (let i = 0; i < 8; i++) code += ALPHABET[randomBytes[i] % ALPHABET.length];
  return `FMA-${issuedAt.getUTCFullYear()}-${code}`;
}

export function isValidCertificateNumber(value: string): boolean {
  return /^FMA-\d{4}-[A-HJ-NP-Z2-9]{8}$/.test(value);
}
