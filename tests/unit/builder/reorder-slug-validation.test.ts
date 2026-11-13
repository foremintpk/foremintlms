import { describe, expect, it } from "vitest";
import { arrayMove, findModuleOfLesson, moveLesson, moveModule, sameOrder, toReorderPayload, type ModuleOrder } from "@/lib/services/courses/reorder";
import { courseSlugFromTitle, isValidCourseSlug, uniqueSlug } from "@/lib/services/courses/slug";
import { assignmentSchema, questionSchema, slugSchema } from "@/lib/validation/course";

const structure: ModuleOrder[] = [
  { id: "m1", lessonIds: ["a", "b", "c"] },
  { id: "m2", lessonIds: ["d"] },
  { id: "m3", lessonIds: [] },
];

describe("curriculum reordering", () => {
  it("moves items within an array and clamps the target", () => {
    expect(arrayMove([1, 2, 3], 0, 2)).toEqual([2, 3, 1]);
    expect(arrayMove([1, 2, 3], 2, -5)).toEqual([3, 1, 2]);
    expect(arrayMove([1, 2, 3], 9, 0)).toEqual([1, 2, 3]);
  });

  it("reorders a lesson inside its module", () => {
    const next = moveLesson(structure, "a", "m1", 2);
    expect(next[0].lessonIds).toEqual(["b", "c", "a"]);
    expect(structure[0].lessonIds).toEqual(["a", "b", "c"]); // input untouched
  });

  it("moves a lesson to another module, including an empty one", () => {
    expect(moveLesson(structure, "b", "m2", 0).map((m) => m.lessonIds)).toEqual([["a", "c"], ["b", "d"], []]);
    expect(moveLesson(structure, "d", "m3", 0).map((m) => m.lessonIds)).toEqual([["a", "b", "c"], [], ["d"]]);
  });

  it("ignores unknown lessons or modules", () => {
    expect(moveLesson(structure, "zz", "m2", 0)).toEqual(structure);
    expect(moveLesson(structure, "a", "nope", 0)).toEqual(structure);
  });

  it("moves modules and builds the RPC payload", () => {
    const next = moveModule(structure, "m3", 0);
    expect(next.map((m) => m.id)).toEqual(["m3", "m1", "m2"]);
    expect(toReorderPayload(next)[1]).toEqual({ id: "m1", lessons: ["a", "b", "c"] });
    expect(findModuleOfLesson(next, "d")).toBe("m2");
  });

  it("detects unchanged order", () => {
    expect(sameOrder(structure, structure.map((m) => ({ ...m, lessonIds: [...m.lessonIds] })))).toBe(true);
    expect(sameOrder(structure, moveLesson(structure, "a", "m1", 1))).toBe(false);
  });
});

describe("course slugs", () => {
  it("derives valid slugs from titles", () => {
    expect(courseSlugFromTitle("Amazon FBA: From Zero & Beyond!")).toBe("amazon-fba-from-zero-and-beyond");
    expect(courseSlugFromTitle("AI")).toBe("ai-course");
    expect(courseSlugFromTitle("New")).toBe("new-course");
    expect(isValidCourseSlug(courseSlugFromTitle("Ünïcödé   title -- here"))).toBe(true);
  });

  it("finds the first free variant", () => {
    expect(uniqueSlug("shopify", [])).toBe("shopify");
    expect(uniqueSlug("shopify", ["shopify", "shopify-2"])).toBe("shopify-3");
  });

  it("validates slugs", () => {
    expect(slugSchema.safeParse("good-slug-1").success).toBe(true);
    for (const bad of ["Bad Slug", "double--hyphen", "-leading", "ab", "admin"]) {
      expect(slugSchema.safeParse(bad).success).toBe(false);
    }
  });
});

const COURSE = "6b0d9f6e-9a3c-4f3d-9a51-6a9f8e3f2c11";
const QUIZ = "7c1e0a7f-0b4d-4e4e-8b62-7b0a9f4a3d22";

describe("question validation", () => {
  const base = { courseId: COURSE, quizId: QUIZ, prompt: "Q?", points: 1, accepted_answers: [], explanation: null };

  it("requires exactly one correct option for single choice", () => {
    const two = questionSchema.safeParse({
      ...base,
      question_type: "single_choice",
      options: [
        { label: "A", is_correct: true },
        { label: "B", is_correct: true },
      ],
    });
    expect(two.success).toBe(false);
    const one = questionSchema.safeParse({
      ...base,
      question_type: "single_choice",
      options: [
        { label: "A", is_correct: true },
        { label: "B", is_correct: false },
      ],
    });
    expect(one.success).toBe(true);
  });

  it("requires at least one correct option for multiple choice", () => {
    const none = questionSchema.safeParse({
      ...base,
      question_type: "multiple_choice",
      options: [
        { label: "A", is_correct: false },
        { label: "B", is_correct: false },
      ],
    });
    expect(none.success).toBe(false);
  });

  it("requires accepted answers for auto-graded short answers", () => {
    expect(questionSchema.safeParse({ ...base, question_type: "short_answer", options: [] }).success).toBe(false);
    expect(questionSchema.safeParse({ ...base, question_type: "short_answer", options: [], requires_manual_review: true }).success).toBe(true);
    expect(questionSchema.safeParse({ ...base, question_type: "short_answer", options: [], accepted_answers: ["FBA"] }).success).toBe(true);
  });

  it("requires exactly two options for true/false", () => {
    const three = questionSchema.safeParse({
      ...base,
      question_type: "true_false",
      options: [
        { label: "True", is_correct: true },
        { label: "False", is_correct: false },
        { label: "Maybe", is_correct: false },
      ],
    });
    expect(three.success).toBe(false);
  });
});

describe("assignment validation", () => {
  const base = {
    courseId: COURSE,
    assignmentId: QUIZ,
    title: "Task",
    instructions: "<p>Do the thing well</p>",
    max_points: 100,
    passing_points: 50,
    due_mode: "none" as const,
    due_at: null,
    due_days_after_enrollment: null,
    allow_late_submissions: true,
    late_penalty_percent: 0,
    submission_types: ["text" as const],
    allowed_file_types: [],
    max_file_size_mb: 25,
    max_files: 0,
    rubric: [],
    grading_criteria: null,
    counts_toward_completion: true,
    status: "draft" as const,
    supporting_media_ids: [],
  };

  it("accepts a minimal assignment", () => {
    expect(assignmentSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a pass mark above the maximum", () => {
    expect(assignmentSchema.safeParse({ ...base, passing_points: 120 }).success).toBe(false);
  });

  it("requires a date for fixed deadlines and days for relative ones", () => {
    expect(assignmentSchema.safeParse({ ...base, due_mode: "fixed" }).success).toBe(false);
    expect(assignmentSchema.safeParse({ ...base, due_mode: "fixed", due_at: "2026-12-01T10:00:00.000Z" }).success).toBe(true);
    expect(assignmentSchema.safeParse({ ...base, due_mode: "relative" }).success).toBe(false);
    expect(assignmentSchema.safeParse({ ...base, due_mode: "relative", due_days_after_enrollment: 14 }).success).toBe(true);
  });

  it("requires file types when files can be submitted", () => {
    expect(assignmentSchema.safeParse({ ...base, submission_types: ["file"], max_files: 1 }).success).toBe(false);
    expect(assignmentSchema.safeParse({ ...base, submission_types: ["file"], allowed_file_types: ["pdf"], max_files: 1 }).success).toBe(true);
  });

  it("keeps rubric points within the maximum", () => {
    const rubric = [
      { id: "a", criterion: "Clarity", description: "", points: 60 },
      { id: "b", criterion: "Depth", description: "", points: 60 },
    ];
    expect(assignmentSchema.safeParse({ ...base, rubric }).success).toBe(false);
  });
});
