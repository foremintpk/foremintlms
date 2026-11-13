import { z } from "zod";

/** Course-builder input schemas shared by forms (client) and actions (server). */

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const RESERVED_SLUGS = ["new", "edit", "admin", "api", "learn", "teach", "categories", "search"];

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Use at least 3 characters")
  .max(100, "Use at most 100 characters")
  .regex(SLUG_RE, "Use lowercase letters, numbers and single hyphens")
  .refine((s) => !RESERVED_SLUGS.includes(s), "This address is reserved");

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const listOf = (maxItems: number, maxLen: number) =>
  z
    .array(z.string().trim().max(maxLen))
    .max(maxItems)
    .transform((items) => items.filter((i) => i.length > 0));

const isoDateTime = z
  .string()
  .datetime({ offset: true })
  .nullish()
  .transform((v) => v ?? null);

export const LEVELS = ["beginner", "intermediate", "advanced", "all_levels"] as const;
export const VISIBILITIES = ["public", "unlisted", "private"] as const;
export const COURSE_STATUSES = ["draft", "in_review", "published", "unpublished", "archived"] as const;

export const createCourseSchema = z.object({
  title: z.string().trim().min(3, "Give the course a title").max(200),
  categoryId: z.uuid().nullish(),
});

export const courseDetailsSchema = z.object({
  courseId: z.uuid(),
  title: z.string().trim().min(3, "Give the course a title").max(200),
  slug: slugSchema,
  short_description: nullableText(400),
  description: z.string().max(100_000).default(""),
  thumbnail_url: z.string().trim().url().max(2048).nullish().transform((v) => v ?? null),
  banner_url: z.string().trim().url().max(2048).nullish().transform((v) => v ?? null),
  promo_video_asset_id: z.uuid().nullish().transform((v) => v ?? null),
  category_id: z.uuid().nullish().transform((v) => v ?? null),
  level: z.enum(LEVELS),
  language: z.string().trim().min(2).max(12).default("en"),
  estimated_duration_minutes: z.number().int().min(0).max(100_000).nullish().transform((v) => v ?? null),
  learning_outcomes: listOf(20, 240),
  requirements: listOf(20, 240),
  target_audience: listOf(20, 240),
  tags: listOf(15, 40).transform((tags) => [...new Set(tags.map((t) => t.toLowerCase()))]),
  visibility: z.enum(VISIBILITIES),
  is_free: z.boolean(),
  sequential_progression: z.boolean(),
  discussions_enabled: z.boolean(),
  certificate_enabled: z.boolean(),
  certificate_min_progress: z.number().int().min(1).max(100),
  certificate_require_quizzes: z.boolean(),
  certificate_require_assignments: z.boolean(),
  seo_title: nullableText(70),
  seo_description: nullableText(170),
});
export type CourseDetailsInput = z.input<typeof courseDetailsSchema>;

export const moduleSchema = z.object({
  courseId: z.uuid(),
  moduleId: z.uuid().optional(),
  title: z.string().trim().min(1, "Name the module").max(200),
  description: nullableText(2000),
  is_published: z.boolean().default(true),
  release_at: isoDateTime,
  release_after_days: z.number().int().min(0).max(3650).nullish().transform((v) => v ?? null),
});

export const COMPLETION_RULES = ["manual", "video_watched", "quiz_passed", "assignment_approved"] as const;
export const LESSON_TYPES = ["video", "article", "quiz", "assignment", "live", "resource", "mixed"] as const;

export const lessonSettingsSchema = z
  .object({
    courseId: z.uuid(),
    lessonId: z.uuid().optional(),
    moduleId: z.uuid(),
    title: z.string().trim().min(1, "Name the lesson").max(200),
    summary: nullableText(2000),
    lesson_type: z.enum(LESSON_TYPES),
    duration_minutes: z.number().int().min(0).max(10_000).nullish().transform((v) => v ?? null),
    is_preview: z.boolean().default(false),
    is_published: z.boolean().default(true),
    release_at: isoDateTime,
    release_after_days: z.number().int().min(0).max(3650).nullish().transform((v) => v ?? null),
    prerequisite_lesson_id: z.uuid().nullish().transform((v) => v ?? null),
    completion_rule: z.enum(COMPLETION_RULES).default("manual"),
  })
  .refine((v) => !v.lessonId || v.prerequisite_lesson_id !== v.lessonId, {
    path: ["prerequisite_lesson_id"],
    message: "A lesson can't be its own prerequisite",
  });

export const quizSettingsSchema = z
  .object({
    courseId: z.uuid(),
    quizId: z.uuid(),
    title: z.string().trim().min(1, "Name the quiz").max(200),
    description: nullableText(4000),
    lesson_id: z.uuid().nullish().transform((v) => v ?? null),
    time_limit_minutes: z.number().int().min(1).max(600).nullish().transform((v) => v ?? null),
    max_attempts: z.number().int().min(1).max(100).nullish().transform((v) => v ?? null),
    passing_score: z.number().int().min(0).max(100),
    shuffle_questions: z.boolean(),
    shuffle_options: z.boolean(),
    question_bank_id: z.uuid().nullish().transform((v) => v ?? null),
    draw_count: z.number().int().min(1).max(200).nullish().transform((v) => v ?? null),
    show_correct_answers: z.enum(["never", "after_submit", "after_pass"]),
    retry_cooldown_minutes: z.number().int().min(0).max(43_200),
    counts_toward_completion: z.boolean(),
    status: z.enum(["draft", "published", "archived"]),
  })
  .refine((v) => !v.draw_count || v.question_bank_id, {
    path: ["draw_count"],
    message: "Choose a question bank to draw questions from",
  });

export const QUESTION_TYPES = ["single_choice", "multiple_choice", "true_false", "short_answer"] as const;

export const questionSchema = z
  .object({
    courseId: z.uuid(),
    questionId: z.uuid().optional(),
    quizId: z.uuid().nullish().transform((v) => v ?? null),
    bankId: z.uuid().nullish().transform((v) => v ?? null),
    question_type: z.enum(QUESTION_TYPES),
    prompt: z.string().trim().min(1, "Write the question").max(4000),
    explanation: nullableText(4000),
    points: z.number().min(0.5).max(1000),
    accepted_answers: listOf(30, 300),
    case_sensitive: z.boolean().default(false),
    requires_manual_review: z.boolean().default(false),
    options: z
      .array(z.object({ id: z.uuid().optional(), label: z.string().trim().min(1, "Options need text").max(1000), is_correct: z.boolean() }))
      .max(12),
  })
  .superRefine((q, ctx) => {
    if (!q.quizId && !q.bankId) ctx.addIssue({ code: "custom", path: ["quizId"], message: "Missing quiz or bank" });
    const correct = q.options.filter((o) => o.is_correct).length;
    if (q.question_type === "short_answer") {
      if (!q.requires_manual_review && q.accepted_answers.length === 0) {
        ctx.addIssue({ code: "custom", path: ["accepted_answers"], message: "Add at least one accepted answer, or mark it for manual review" });
      }
      return;
    }
    if (q.question_type === "true_false" && q.options.length !== 2) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "True/false questions have exactly two options" });
    }
    if (q.options.length < 2) ctx.addIssue({ code: "custom", path: ["options"], message: "Add at least two options" });
    if ((q.question_type === "single_choice" || q.question_type === "true_false") && correct !== 1) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Mark exactly one correct option" });
    }
    if (q.question_type === "multiple_choice" && correct < 1) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Mark at least one correct option" });
    }
  });
export type QuestionInput = z.input<typeof questionSchema>;

export const rubricCriterionSchema = z.object({
  id: z.string().min(1).max(40),
  criterion: z.string().trim().min(1, "Name the criterion").max(200),
  description: z.string().trim().max(1000).default(""),
  points: z.number().min(0).max(1000),
});
export type RubricCriterion = z.infer<typeof rubricCriterionSchema>;

export const SUBMISSION_TYPES = ["text", "file", "link"] as const;
export const ASSIGNMENT_FILE_TYPES = ["pdf", "docx", "pptx", "xlsx", "png", "jpg", "jpeg", "webp", "zip", "txt"] as const;

export const assignmentSchema = z
  .object({
    courseId: z.uuid(),
    assignmentId: z.uuid(),
    title: z.string().trim().min(1, "Name the assignment").max(200),
    instructions: z.string().max(100_000).default(""),
    lesson_id: z.uuid().nullish().transform((v) => v ?? null),
    max_points: z.number().min(1).max(1000),
    passing_points: z.number().min(0).max(1000).nullish().transform((v) => v ?? null),
    due_mode: z.enum(["none", "fixed", "relative"]),
    due_at: isoDateTime,
    due_days_after_enrollment: z.number().int().min(1).max(3650).nullish().transform((v) => v ?? null),
    allow_late_submissions: z.boolean(),
    late_penalty_percent: z.number().int().min(0).max(100),
    submission_types: z.array(z.enum(SUBMISSION_TYPES)).min(1, "Allow at least one way to submit"),
    allowed_file_types: z.array(z.enum(ASSIGNMENT_FILE_TYPES)),
    max_file_size_mb: z.number().int().min(1).max(500),
    max_files: z.number().int().min(0).max(20),
    rubric: z.array(rubricCriterionSchema).max(20),
    grading_criteria: nullableText(4000),
    counts_toward_completion: z.boolean(),
    status: z.enum(["draft", "published", "archived"]),
    supporting_media_ids: z.array(z.uuid()).max(20),
  })
  .superRefine((a, ctx) => {
    if (a.passing_points !== null && a.passing_points > a.max_points) {
      ctx.addIssue({ code: "custom", path: ["passing_points"], message: "Passing points can't exceed the maximum" });
    }
    if (a.due_mode === "fixed" && !a.due_at) ctx.addIssue({ code: "custom", path: ["due_at"], message: "Choose a due date" });
    if (a.due_mode === "relative" && !a.due_days_after_enrollment) {
      ctx.addIssue({ code: "custom", path: ["due_days_after_enrollment"], message: "Enter the number of days" });
    }
    if (a.submission_types.includes("file") && (a.allowed_file_types.length === 0 || a.max_files === 0)) {
      ctx.addIssue({ code: "custom", path: ["allowed_file_types"], message: "Choose file types and allow at least one file" });
    }
    const rubricTotal = a.rubric.reduce((s, r) => s + r.points, 0);
    if (a.rubric.length > 0 && rubricTotal > a.max_points) {
      ctx.addIssue({ code: "custom", path: ["rubric"], message: `Rubric points (${rubricTotal}) exceed the maximum (${a.max_points})` });
    }
  });
export type AssignmentInput = z.input<typeof assignmentSchema>;
