import { describe, expect, it } from "vitest";
import {
  computeAccessWindow,
  computeLessonLocks,
  entitlementCovers,
  isEntitlementActive,
  isReleased,
  lessonReleaseDate,
  progressPercent,
  resolveCourseAccess,
  type EntitlementLike,
} from "@/lib/domain/access";

const NOW = new Date("2026-06-01T12:00:00Z");
const COURSE = "course-1";

function ent(partial: Partial<EntitlementLike>): EntitlementLike {
  return {
    id: "e1",
    status: "active",
    scope: "course",
    course_id: COURSE,
    starts_at: "2026-01-01T00:00:00Z",
    expires_at: null,
    ...partial,
  };
}

describe("isEntitlementActive", () => {
  it("accepts an open-ended active grant", () => {
    expect(isEntitlementActive(ent({}), NOW)).toBe(true);
  });
  it("rejects grants that have not started", () => {
    expect(isEntitlementActive(ent({ starts_at: "2026-07-01T00:00:00Z" }), NOW)).toBe(false);
  });
  it("rejects grants at or after expiry", () => {
    expect(isEntitlementActive(ent({ expires_at: NOW.toISOString() }), NOW)).toBe(false);
    expect(isEntitlementActive(ent({ expires_at: "2026-05-31T00:00:00Z" }), NOW)).toBe(false);
  });
  it("rejects revoked, expired and suspended statuses even if dates are valid", () => {
    for (const status of ["revoked", "expired", "suspended"] as const) {
      expect(isEntitlementActive(ent({ status }), NOW)).toBe(false);
    }
  });
});

describe("entitlementCovers", () => {
  it("covers its own course and nothing else", () => {
    expect(entitlementCovers(ent({}), COURSE)).toBe(true);
    expect(entitlementCovers(ent({}), "other")).toBe(false);
  });
  it("all-access covers every course", () => {
    expect(entitlementCovers(ent({ scope: "all_access", course_id: null }), "any")).toBe(true);
  });
});

describe("resolveCourseAccess", () => {
  const base = { courseId: COURSE, courseStatus: "published" as const, isStaff: false, now: NOW };

  it("grants staff access regardless of entitlements", () => {
    const r = resolveCourseAccess({ ...base, isStaff: true, entitlements: [], courseStatus: "draft" });
    expect(r).toMatchObject({ hasAccess: true, reason: "staff" });
  });
  it("returns none without entitlements", () => {
    expect(resolveCourseAccess({ ...base, entitlements: [] })).toMatchObject({ hasAccess: false, reason: "none" });
  });
  it("picks the longest-lasting active entitlement", () => {
    const r = resolveCourseAccess({
      ...base,
      entitlements: [
        ent({ id: "short", expires_at: "2026-06-10T00:00:00Z" }),
        ent({ id: "long", expires_at: "2026-12-10T00:00:00Z" }),
      ],
    });
    expect(r).toMatchObject({ hasAccess: true, entitlementId: "long", expiresAt: "2026-12-10T00:00:00Z" });
  });
  it("prefers lifetime over dated access", () => {
    const r = resolveCourseAccess({
      ...base,
      entitlements: [ent({ id: "dated", expires_at: "2027-01-01T00:00:00Z" }), ent({ id: "life", expires_at: null })],
    });
    expect(r.entitlementId).toBe("life");
    expect(r.expiresAt).toBeNull();
  });
  it("uses all-access grants", () => {
    const r = resolveCourseAccess({ ...base, entitlements: [ent({ scope: "all_access", course_id: null })] });
    expect(r).toMatchObject({ hasAccess: true, reason: "entitlement" });
  });
  it("blocks drafts and in-review courses even for entitled learners", () => {
    for (const courseStatus of ["draft", "in_review"] as const) {
      const r = resolveCourseAccess({ ...base, courseStatus, entitlements: [ent({})] });
      expect(r).toMatchObject({ hasAccess: false, reason: "course_unavailable" });
    }
  });
  it("keeps access to unpublished and archived courses for existing learners", () => {
    for (const courseStatus of ["unpublished", "archived"] as const) {
      expect(resolveCourseAccess({ ...base, courseStatus, entitlements: [ent({})] }).hasAccess).toBe(true);
    }
  });
  it("reports expired access", () => {
    const r = resolveCourseAccess({ ...base, entitlements: [ent({ expires_at: "2026-05-01T00:00:00Z" })] });
    expect(r).toMatchObject({ hasAccess: false, reason: "expired" });
  });
  it("reports revoked access", () => {
    const r = resolveCourseAccess({ ...base, entitlements: [ent({ status: "revoked" })] });
    expect(r).toMatchObject({ hasAccess: false, reason: "revoked" });
  });
  it("reports suspended access (disputes)", () => {
    const r = resolveCourseAccess({ ...base, entitlements: [ent({ status: "suspended" })] });
    expect(r).toMatchObject({ hasAccess: false, reason: "suspended" });
  });
  it("ignores entitlements for other courses", () => {
    const r = resolveCourseAccess({ ...base, entitlements: [ent({ course_id: "other" })] });
    expect(r.reason).toBe("none");
  });
});

describe("computeAccessWindow", () => {
  const start = new Date("2026-01-01T00:00:00Z");
  it("gives fixed-term one-time plans an expiry", () => {
    const w = computeAccessWindow({ plan_type: "one_time", access_duration_days: 30, billing_period_days: null, grace_period_days: 3 }, start);
    expect(w.expiresAt?.toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });
  it("gives lifetime plans no expiry", () => {
    const w = computeAccessWindow({ plan_type: "one_time", access_duration_days: null, billing_period_days: null, grace_period_days: 3 }, start);
    expect(w.expiresAt).toBeNull();
  });
  it("runs recurring plans to period end plus grace", () => {
    const w = computeAccessWindow(
      { plan_type: "recurring", access_duration_days: null, billing_period_days: 30, grace_period_days: 3 },
      start,
      new Date("2026-02-01T00:00:00Z"),
    );
    expect(w.expiresAt?.toISOString()).toBe("2026-02-04T00:00:00.000Z");
  });
  it("estimates the period for recurring plans without a provider period end", () => {
    const w = computeAccessWindow({ plan_type: "recurring", access_duration_days: null, billing_period_days: 365, grace_period_days: 0 }, start);
    expect(w.expiresAt?.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});

describe("lessonReleaseDate / isReleased", () => {
  const none = { release_at: null, release_after_days: null };
  const enrolled = new Date("2026-05-01T00:00:00Z");
  it("is immediately released without rules", () => {
    expect(lessonReleaseDate(none, none, enrolled)).toBeNull();
    expect(isReleased(null, NOW)).toBe(true);
  });
  it("uses the latest of lesson and module rules", () => {
    const d = lessonReleaseDate(
      { release_at: "2026-05-10T00:00:00Z", release_after_days: null },
      { release_at: null, release_after_days: 20 },
      enrolled,
    );
    expect(d?.toISOString()).toBe("2026-05-21T00:00:00.000Z");
  });
  it("holds drip lessons when enrollment date is unknown", () => {
    const d = lessonReleaseDate({ release_at: null, release_after_days: 1 }, none, null);
    expect(isReleased(d, NOW)).toBe(false);
  });
  it("treats day-zero drip as immediate", () => {
    const d = lessonReleaseDate({ release_at: null, release_after_days: 0 }, none, enrolled);
    expect(isReleased(d, enrolled)).toBe(true);
  });
});

describe("computeLessonLocks", () => {
  const lessons = [
    { id: "a", prerequisite_lesson_id: null },
    { id: "b", prerequisite_lesson_id: null },
    { id: "c", prerequisite_lesson_id: "a" },
  ];
  it("locks everything after the first incomplete lesson in sequential mode", () => {
    const locks = computeLessonLocks(lessons, new Set(), true);
    expect([...locks.values()]).toEqual([null, "sequential", "sequential"]);
  });
  it("unlocks progressively as lessons are completed", () => {
    const locks = computeLessonLocks(lessons, new Set(["a", "b"]), true);
    expect(locks.get("c")).toBeNull();
  });
  it("enforces prerequisites without sequential mode", () => {
    const locks = computeLessonLocks(lessons, new Set(), false);
    expect(locks.get("b")).toBeNull();
    expect(locks.get("c")).toBe("prerequisite");
  });
});

describe("progressPercent", () => {
  it("handles empty courses and caps at 100", () => {
    expect(progressPercent(0, 0)).toBe(0);
    expect(progressPercent(3, 4)).toBe(75);
    expect(progressPercent(9, 4)).toBe(100);
    expect(progressPercent(1, 3)).toBe(33.33);
  });
});
