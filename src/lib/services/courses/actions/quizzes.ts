"use server";

import { z } from "zod";
import { ok, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { assertCourseEditor } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { questionSchema, quizSettingsSchema, type QuestionInput } from "@/lib/validation/course";
import { must, refreshBuilder, throwDbError } from "@/lib/services/courses/action-helpers";

const uuid = z.uuid();

export async function createQuiz(input: { courseId: string; title: string; lessonId?: string | null }): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const courseId = uuid.parse(input.courseId);
    const title = z.string().trim().min(1, "Name the quiz").max(200).parse(input.title);
    const { user } = await assertCourseEditor(courseId);
    const supabase = await createClient();
    const created = must<{ id: string }>(
      await supabase
        .from("quizzes")
        .insert({ course_id: courseId, title, lesson_id: input.lessonId ?? null, created_by: user.id, status: "draft" })
        .select("id")
        .single(),
      "create quiz",
    );
    refreshBuilder(courseId);
    return ok({ id: created.id }, "Quiz created");
  });
}

export async function saveQuizSettings(input: z.input<typeof quizSettingsSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const parsed = quizSettingsSchema.parse(input);
    await assertCourseEditor(parsed.courseId);
    const supabase = await createClient();

    if (parsed.question_bank_id) {
      const { data: bank } = await supabase.from("question_banks").select("id").eq("id", parsed.question_bank_id).eq("course_id", parsed.courseId).maybeSingle();
      if (!bank) throw new UserFacingError("Choose a question bank from this course.");
      if (parsed.draw_count) {
        const { count } = await supabase.from("quiz_questions").select("id", { count: "exact", head: true }).eq("question_bank_id", parsed.question_bank_id);
        if ((count ?? 0) < parsed.draw_count) {
          throw new UserFacingError(`The bank has ${count ?? 0} questions — lower the number to draw or add more questions.`);
        }
      }
    }
    if (parsed.status === "published") {
      const usesBank = Boolean(parsed.question_bank_id && parsed.draw_count);
      if (!usesBank) {
        const { count } = await supabase.from("quiz_questions").select("id", { count: "exact", head: true }).eq("quiz_id", parsed.quizId);
        if ((count ?? 0) === 0) throw new UserFacingError("Add at least one question before publishing the quiz.");
      }
    }
    if (parsed.lesson_id) {
      const { data: lesson } = await supabase.from("lessons").select("id").eq("id", parsed.lesson_id).eq("course_id", parsed.courseId).maybeSingle();
      if (!lesson) throw new UserFacingError("Choose a lesson from this course.");
    }

    const { error } = await supabase
      .from("quizzes")
      .update({
        title: parsed.title,
        description: parsed.description,
        lesson_id: parsed.lesson_id,
        time_limit_minutes: parsed.time_limit_minutes,
        max_attempts: parsed.max_attempts,
        passing_score: parsed.passing_score,
        shuffle_questions: parsed.shuffle_questions,
        shuffle_options: parsed.shuffle_options,
        question_bank_id: parsed.draw_count ? parsed.question_bank_id : null,
        draw_count: parsed.draw_count,
        show_correct_answers: parsed.show_correct_answers,
        retry_cooldown_minutes: parsed.retry_cooldown_minutes,
        counts_toward_completion: parsed.counts_toward_completion,
        status: parsed.status,
      })
      .eq("id", parsed.quizId)
      .eq("course_id", parsed.courseId);
    throwDbError(error, "save quiz");
    refreshBuilder(parsed.courseId);
    return ok(null, parsed.status === "published" ? "Quiz published" : "Quiz saved");
  });
}

/** Archive rather than delete when students have attempts, so their results remain. */
export async function deleteQuiz(input: { courseId: string; quizId: string }): Promise<ActionResult<{ archived: boolean }>> {
  return runAction<{ archived: boolean }>(async () => {
    const courseId = uuid.parse(input.courseId);
    const quizId = uuid.parse(input.quizId);
    await assertCourseEditor(courseId);
    const supabase = await createClient();
    const { count } = await supabase.from("quiz_attempts").select("id", { count: "exact", head: true }).eq("quiz_id", quizId);
    if ((count ?? 0) > 0) {
      const { error } = await supabase.from("quizzes").update({ status: "archived" }).eq("id", quizId).eq("course_id", courseId);
      throwDbError(error, "archive quiz");
      refreshBuilder(courseId);
      return ok({ archived: true }, "Quiz archived — students' results are kept");
    }
    const { error } = await supabase.from("quizzes").delete().eq("id", quizId).eq("course_id", courseId);
    throwDbError(error, "delete quiz");
    refreshBuilder(courseId);
    return ok({ archived: false }, "Quiz deleted");
  });
}

export async function saveQuestion(input: QuestionInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const parsed = questionSchema.parse(input);
    await assertCourseEditor(parsed.courseId);
    const supabase = await createClient();
    const options = parsed.question_type === "short_answer" ? [] : parsed.options;
    const { data, error } = await supabase.rpc("save_quiz_question", {
      p_question: {
        id: parsed.questionId ?? null,
        course_id: parsed.courseId,
        quiz_id: parsed.quizId,
        question_bank_id: parsed.quizId ? null : parsed.bankId,
        question_type: parsed.question_type,
        prompt: parsed.prompt,
        explanation: parsed.explanation,
        points: parsed.points,
        accepted_answers: parsed.question_type === "short_answer" ? parsed.accepted_answers : [],
        case_sensitive: parsed.case_sensitive,
        requires_manual_review: parsed.question_type === "short_answer" ? parsed.requires_manual_review : false,
      },
      p_options: options.map((o) => ({ id: o.id ?? null, label: o.label, is_correct: o.is_correct })),
    });
    throwDbError(error, "save question");
    const saved = data as { question_id: string; option_ids: string[] } | null;
    if (!saved?.question_id) throw new Error("save_quiz_question returned no id");
    // Remove options the teacher dropped from this question. Runs as the
    // signed-in editor, so RLS ("quiz_options: course editors") applies.
    let removeDropped = supabase.from("quiz_options").delete().eq("question_id", saved.question_id);
    if (saved.option_ids.length > 0) {
      removeDropped = removeDropped.not("id", "in", `(${saved.option_ids.join(",")})`);
    }
    const { error: removeError } = await removeDropped;
    throwDbError(removeError, "remove answer options");
    refreshBuilder(parsed.courseId);
    return ok({ id: saved.question_id }, parsed.questionId ? "Question saved" : "Question added");
  });
}

export async function deleteQuestion(input: { courseId: string; questionId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const courseId = uuid.parse(input.courseId);
    const questionId = uuid.parse(input.questionId);
    await assertCourseEditor(courseId);
    const supabase = await createClient();
    const { count } = await supabase.from("quiz_answers").select("id", { count: "exact", head: true }).eq("question_id", questionId);
    if ((count ?? 0) > 0) {
      throw new UserFacingError("Students have answered this question, so it can't be deleted. Edit it, or archive the quiz and create a new one.");
    }
    const { error } = await supabase.from("quiz_questions").delete().eq("id", questionId).eq("course_id", courseId);
    throwDbError(error, "delete question");
    refreshBuilder(courseId);
    return ok(null, "Question deleted");
  });
}

export async function reorderQuestions(input: { courseId: string; quizId: string; questionIds: string[] }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const courseId = uuid.parse(input.courseId);
    const quizId = uuid.parse(input.quizId);
    const ids = z.array(uuid).max(500).parse(input.questionIds);
    await assertCourseEditor(courseId);
    const supabase = await createClient();
    const { error } = await supabase.rpc("reorder_quiz_questions", { p_quiz: quizId, p_question_ids: ids });
    throwDbError(error, "reorder questions");
    refreshBuilder(courseId);
    return ok(null);
  });
}

export async function saveQuestionBank(input: {
  courseId: string;
  bankId?: string;
  title: string;
  description?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const courseId = uuid.parse(input.courseId);
    const title = z.string().trim().min(1, "Name the bank").max(200).parse(input.title);
    const description = z.string().trim().max(2000).nullish().parse(input.description) || null;
    const { user } = await assertCourseEditor(courseId);
    const supabase = await createClient();
    if (input.bankId) {
      const { error } = await supabase
        .from("question_banks")
        .update({ title, description })
        .eq("id", uuid.parse(input.bankId))
        .eq("course_id", courseId);
      throwDbError(error, "update bank");
      refreshBuilder(courseId);
      return ok({ id: input.bankId }, "Question bank saved");
    }
    const created = must<{ id: string }>(
      await supabase.from("question_banks").insert({ course_id: courseId, title, description, created_by: user.id }).select("id").single(),
      "create bank",
    );
    refreshBuilder(courseId);
    return ok({ id: created.id }, "Question bank created");
  });
}

export async function deleteQuestionBank(input: { courseId: string; bankId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const courseId = uuid.parse(input.courseId);
    const bankId = uuid.parse(input.bankId);
    await assertCourseEditor(courseId);
    const supabase = await createClient();
    const { count } = await supabase.from("quizzes").select("id", { count: "exact", head: true }).eq("question_bank_id", bankId).neq("status", "archived");
    if ((count ?? 0) > 0) throw new UserFacingError("Quizzes draw questions from this bank. Switch them to another bank first.");
    const { error } = await supabase.from("question_banks").delete().eq("id", bankId).eq("course_id", courseId);
    throwDbError(error, "delete bank");
    refreshBuilder(courseId);
    return ok(null, "Question bank deleted");
  });
}

export async function copyQuestionsFromBank(input: { courseId: string; quizId: string; questionIds: string[] }): Promise<ActionResult<{ copied: number }>> {
  return runAction(async () => {
    const courseId = uuid.parse(input.courseId);
    const quizId = uuid.parse(input.quizId);
    const ids = z.array(uuid).min(1, "Choose at least one question").max(200).parse(input.questionIds);
    await assertCourseEditor(courseId);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("copy_bank_questions_to_quiz", { p_quiz: quizId, p_question_ids: ids });
    throwDbError(error, "copy questions");
    refreshBuilder(courseId);
    const copied = Number(data ?? 0);
    return ok({ copied }, `${copied} question${copied === 1 ? "" : "s"} added`);
  });
}
