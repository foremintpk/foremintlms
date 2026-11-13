import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { RubricCriterion } from "@/lib/validation/course";

/** Read models for quiz, question bank and assignment authoring (RLS: course editors). */

const uuid = z.uuid();

export interface QuizListItem {
  id: string;
  title: string;
  status: "draft" | "published" | "archived";
  lesson_id: string | null;
  lesson_title: string | null;
  question_count: number;
  attempt_count: number;
  passing_score: number;
  uses_bank: boolean;
}

export interface BankListItem {
  id: string;
  title: string;
  description: string | null;
  question_count: number;
}

export async function loadQuizOverview(courseId: string) {
  const supabase = await createClient();
  const [quizzesRes, questionsRes, banksRes, attemptsRes, lessonsRes] = await Promise.all([
    supabase
      .from("quizzes")
      .select("id, title, status, lesson_id, passing_score, question_bank_id, draw_count, created_at")
      .eq("course_id", courseId)
      .order("created_at"),
    supabase.from("quiz_questions").select("quiz_id, question_bank_id").eq("course_id", courseId),
    supabase.from("question_banks").select("id, title, description").eq("course_id", courseId).order("created_at"),
    supabase.from("quiz_attempts").select("quiz_id").eq("course_id", courseId),
    supabase.from("lessons").select("id, title").eq("course_id", courseId),
  ]);
  const questions = (questionsRes.data ?? []) as { quiz_id: string | null; question_bank_id: string | null }[];
  const attempts = (attemptsRes.data ?? []) as { quiz_id: string }[];
  const lessons = new Map(((lessonsRes.data ?? []) as { id: string; title: string }[]).map((l) => [l.id, l.title]));
  const count = <T,>(rows: T[], pred: (r: T) => boolean) => rows.filter(pred).length;

  const quizzes: QuizListItem[] = ((quizzesRes.data ?? []) as {
    id: string;
    title: string;
    status: QuizListItem["status"];
    lesson_id: string | null;
    passing_score: number;
    question_bank_id: string | null;
    draw_count: number | null;
  }[]).map((q) => ({
    id: q.id,
    title: q.title,
    status: q.status,
    lesson_id: q.lesson_id,
    lesson_title: q.lesson_id ? (lessons.get(q.lesson_id) ?? null) : null,
    question_count: q.draw_count && q.question_bank_id ? q.draw_count : count(questions, (r) => r.quiz_id === q.id),
    attempt_count: count(attempts, (a) => a.quiz_id === q.id),
    passing_score: q.passing_score,
    uses_bank: Boolean(q.draw_count && q.question_bank_id),
  }));
  const banks: BankListItem[] = ((banksRes.data ?? []) as { id: string; title: string; description: string | null }[]).map((b) => ({
    ...b,
    question_count: count(questions, (r) => r.question_bank_id === b.id && !r.quiz_id),
  }));
  return { quizzes, banks };
}

export interface QuestionWithOptions {
  id: string;
  question_type: "single_choice" | "multiple_choice" | "true_false" | "short_answer";
  prompt: string;
  explanation: string | null;
  points: number;
  sort_order: number;
  accepted_answers: string[];
  case_sensitive: boolean;
  requires_manual_review: boolean;
  options: { id: string; label: string; is_correct: boolean; sort_order: number }[];
}

async function loadQuestions(filter: { quizId?: string; bankId?: string }): Promise<QuestionWithOptions[]> {
  const supabase = await createClient();
  let query = supabase
    .from("quiz_questions")
    .select("id, question_type, prompt, explanation, points, sort_order, accepted_answers, case_sensitive, requires_manual_review")
    .order("sort_order")
    .order("created_at");
  query = filter.quizId ? query.eq("quiz_id", filter.quizId) : query.eq("question_bank_id", filter.bankId!).is("quiz_id", null);
  const { data: questions } = await query;
  const rows = (questions ?? []) as Omit<QuestionWithOptions, "options">[];
  if (!rows.length) return [];
  const { data: options } = await supabase
    .from("quiz_options")
    .select("id, question_id, label, is_correct, sort_order")
    .in("question_id", rows.map((q) => q.id))
    .order("sort_order");
  const byQuestion = new Map<string, QuestionWithOptions["options"]>();
  for (const o of (options ?? []) as (QuestionWithOptions["options"][number] & { question_id: string })[]) {
    const list = byQuestion.get(o.question_id) ?? [];
    list.push({ id: o.id, label: o.label, is_correct: o.is_correct, sort_order: o.sort_order });
    byQuestion.set(o.question_id, list);
  }
  return rows.map((q) => ({ ...q, points: Number(q.points), options: byQuestion.get(q.id) ?? [] }));
}

export interface QuizDetail {
  id: string;
  title: string;
  description: string | null;
  lesson_id: string | null;
  time_limit_minutes: number | null;
  max_attempts: number | null;
  passing_score: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  question_bank_id: string | null;
  draw_count: number | null;
  show_correct_answers: "never" | "after_submit" | "after_pass";
  retry_cooldown_minutes: number;
  counts_toward_completion: boolean;
  status: "draft" | "published" | "archived";
}

export async function loadQuizEditor(courseId: string, quizId: string) {
  if (!uuid.safeParse(quizId).success) return null;
  const supabase = await createClient();
  const { data: quiz } = await supabase
    .from("quizzes")
    .select(
      "id, title, description, lesson_id, time_limit_minutes, max_attempts, passing_score, shuffle_questions, shuffle_options, question_bank_id, draw_count, show_correct_answers, retry_cooldown_minutes, counts_toward_completion, status",
    )
    .eq("id", quizId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (!quiz) return null;
  const [questions, overview, lessonsRes, attemptsRes] = await Promise.all([
    loadQuestions({ quizId }),
    loadQuizOverview(courseId),
    supabase.from("lessons").select("id, title").eq("course_id", courseId).order("sort_order"),
    supabase.from("quiz_attempts").select("id", { count: "exact", head: true }).eq("quiz_id", quizId),
  ]);
  return {
    quiz: quiz as QuizDetail,
    questions,
    banks: overview.banks,
    lessons: (lessonsRes.data ?? []) as { id: string; title: string }[],
    attemptCount: attemptsRes.count ?? 0,
  };
}

export async function loadBankEditor(courseId: string, bankId: string) {
  if (!uuid.safeParse(bankId).success) return null;
  const supabase = await createClient();
  const { data: bank } = await supabase
    .from("question_banks")
    .select("id, title, description")
    .eq("id", bankId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (!bank) return null;
  return { bank: bank as { id: string; title: string; description: string | null }, questions: await loadQuestions({ bankId }) };
}

/** Bank questions available to copy into a quiz. */
export async function loadBankQuestionsForPicker(courseId: string) {
  const supabase = await createClient();
  const [banksRes, questionsRes] = await Promise.all([
    supabase.from("question_banks").select("id, title").eq("course_id", courseId).order("created_at"),
    supabase
      .from("quiz_questions")
      .select("id, prompt, question_type, question_bank_id")
      .eq("course_id", courseId)
      .is("quiz_id", null)
      .not("question_bank_id", "is", null)
      .order("sort_order"),
  ]);
  const questions = (questionsRes.data ?? []) as { id: string; prompt: string; question_type: string; question_bank_id: string }[];
  return ((banksRes.data ?? []) as { id: string; title: string }[]).map((b) => ({
    ...b,
    questions: questions.filter((q) => q.question_bank_id === b.id),
  }));
}

export interface AssignmentListItem {
  id: string;
  title: string;
  status: "draft" | "published" | "archived";
  due_at: string | null;
  due_days_after_enrollment: number | null;
  max_points: number;
  lesson_title: string | null;
  submission_count: number;
  pending_count: number;
}

export async function loadAssignmentOverview(courseId: string): Promise<AssignmentListItem[]> {
  const supabase = await createClient();
  const [assignmentsRes, subsRes, lessonsRes] = await Promise.all([
    supabase
      .from("assignments")
      .select("id, title, status, due_at, due_days_after_enrollment, max_points, lesson_id, created_at")
      .eq("course_id", courseId)
      .order("created_at"),
    supabase.from("assignment_submissions").select("assignment_id, status").eq("course_id", courseId),
    supabase.from("lessons").select("id, title").eq("course_id", courseId),
  ]);
  const subs = (subsRes.data ?? []) as { assignment_id: string; status: string }[];
  const lessons = new Map(((lessonsRes.data ?? []) as { id: string; title: string }[]).map((l) => [l.id, l.title]));
  return ((assignmentsRes.data ?? []) as {
    id: string;
    title: string;
    status: AssignmentListItem["status"];
    due_at: string | null;
    due_days_after_enrollment: number | null;
    max_points: number;
    lesson_id: string | null;
  }[]).map((a) => ({
    id: a.id,
    title: a.title,
    status: a.status,
    due_at: a.due_at,
    due_days_after_enrollment: a.due_days_after_enrollment,
    max_points: Number(a.max_points),
    lesson_title: a.lesson_id ? (lessons.get(a.lesson_id) ?? null) : null,
    submission_count: subs.filter((s) => s.assignment_id === a.id).length,
    pending_count: subs.filter((s) => s.assignment_id === a.id && (s.status === "submitted" || s.status === "under_review")).length,
  }));
}

export interface AssignmentDetail {
  id: string;
  title: string;
  instructions: string | null;
  lesson_id: string | null;
  max_points: number;
  passing_points: number | null;
  due_at: string | null;
  due_days_after_enrollment: number | null;
  allow_late_submissions: boolean;
  late_penalty_percent: number;
  submission_types: ("text" | "file" | "link")[];
  allowed_file_types: string[];
  max_file_size_mb: number;
  max_files: number;
  rubric: RubricCriterion[];
  grading_criteria: string | null;
  counts_toward_completion: boolean;
  status: "draft" | "published" | "archived";
  supporting_media_ids: string[];
}

export async function loadAssignmentEditor(courseId: string, assignmentId: string) {
  if (!uuid.safeParse(assignmentId).success) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("assignments")
    .select(
      "id, title, instructions, lesson_id, max_points, passing_points, due_at, due_days_after_enrollment, allow_late_submissions, late_penalty_percent, submission_types, allowed_file_types, max_file_size_mb, max_files, rubric, grading_criteria, counts_toward_completion, status, supporting_media_ids",
    )
    .eq("id", assignmentId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (!data) return null;
  const assignment = data as AssignmentDetail;
  const [lessonsRes, filesRes, subsRes] = await Promise.all([
    supabase.from("lessons").select("id, title").eq("course_id", courseId).order("sort_order"),
    assignment.supporting_media_ids?.length
      ? supabase.from("media_files").select("id, file_name, mime_type, size_bytes, status").in("id", assignment.supporting_media_ids)
      : Promise.resolve({ data: [] }),
    supabase.from("assignment_submissions").select("id", { count: "exact", head: true }).eq("assignment_id", assignmentId),
  ]);
  return {
    assignment: {
      ...assignment,
      max_points: Number(assignment.max_points),
      passing_points: assignment.passing_points === null ? null : Number(assignment.passing_points),
      rubric: Array.isArray(assignment.rubric) ? assignment.rubric : [],
      supporting_media_ids: assignment.supporting_media_ids ?? [],
    },
    lessons: (lessonsRes.data ?? []) as { id: string; title: string }[],
    files: ((filesRes.data ?? []) as { id: string; file_name: string; mime_type: string; size_bytes: number; status: string }[]).map((f) => ({
      ...f,
      size_bytes: Number(f.size_bytes),
    })),
    submissionCount: subsRes.count ?? 0,
  };
}
