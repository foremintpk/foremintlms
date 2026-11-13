import { describe, expect, it } from "vitest";
import { certificateEligibility, generateCertificateNumber, isValidCertificateNumber } from "@/lib/domain/certificates";

const rules = {
  certificate_enabled: true,
  certificate_min_progress: 100,
  certificate_require_quizzes: true,
  certificate_require_assignments: true,
};

describe("certificateEligibility", () => {
  it("is eligible when every requirement is met", () => {
    const r = certificateEligibility({
      course: rules,
      progressPercent: 100,
      quizzes: [{ id: "q", title: "Final quiz", passed: true }],
      assignments: [{ id: "a", title: "Project", status: "approved" }],
    });
    expect(r).toEqual({ eligible: true, missing: [] });
  });
  it("lists every missing requirement", () => {
    const r = certificateEligibility({
      course: rules,
      progressPercent: 60,
      quizzes: [{ id: "q", title: "Final quiz", passed: false }],
      assignments: [{ id: "a", title: "Project", status: "submitted" }],
    });
    expect(r.eligible).toBe(false);
    expect(r.missing).toHaveLength(3);
    expect(r.missing[0]).toContain("60%");
  });
  it("ignores quizzes and assignments when not required", () => {
    const r = certificateEligibility({
      course: { ...rules, certificate_require_quizzes: false, certificate_require_assignments: false, certificate_min_progress: 80 },
      progressPercent: 80,
      quizzes: [{ id: "q", title: "Quiz", passed: false }],
      assignments: [{ id: "a", title: "Project", status: null }],
    });
    expect(r.eligible).toBe(true);
  });
  it("accepts graded assignments", () => {
    const r = certificateEligibility({ course: rules, progressPercent: 100, quizzes: [], assignments: [{ id: "a", title: "P", status: "graded" }] });
    expect(r.eligible).toBe(true);
  });
  it("never issues when certificates are disabled", () => {
    const r = certificateEligibility({ course: { ...rules, certificate_enabled: false }, progressPercent: 100, quizzes: [], assignments: [] });
    expect(r.eligible).toBe(false);
  });
  it("tolerates floating point progress", () => {
    const r = certificateEligibility({ course: { ...rules, certificate_min_progress: 33 }, progressPercent: 32.9999999999, quizzes: [], assignments: [] });
    expect(r.eligible).toBe(true);
  });
});

describe("certificate numbers", () => {
  it("formats readable, valid numbers", () => {
    const n = generateCertificateNumber(new Date("2026-03-04T00:00:00Z"), new Uint8Array([0, 1, 2, 3, 4, 5, 6, 255]));
    expect(n).toMatch(/^FMA-2026-[A-Z2-9]{8}$/);
    expect(isValidCertificateNumber(n)).toBe(true);
  });
  it("never uses ambiguous characters", () => {
    for (let b = 0; b < 256; b++) {
      const n = generateCertificateNumber(new Date("2026-01-01T00:00:00Z"), new Uint8Array(8).fill(b));
      expect(n.slice("FMA-2026-".length)).not.toMatch(/[01IO]/);
    }
  });
  it("rejects malformed numbers", () => {
    expect(isValidCertificateNumber("FMA-2026-ABCDEFGO")).toBe(false);
    expect(isValidCertificateNumber("FMA-26-ABCDEFGH")).toBe(false);
    expect(isValidCertificateNumber("fma-2026-ABCDEFGH")).toBe(false);
  });
});
