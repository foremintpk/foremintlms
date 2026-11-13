import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { videoProviderStatuses } from "@/lib/services/video";
import {
  courseReadiness,
  listCategoryOptions,
  loadBuilderContext,
  loadCurriculum,
  loadInstructorAssignments,
  loadLessonEditor,
  type BuilderArea,
} from "@/lib/services/courses/builder";
import {
  loadAssignmentEditor,
  loadAssignmentOverview,
  loadBankEditor,
  loadBankQuestionsForPicker,
  loadQuizEditor,
  loadQuizOverview,
} from "@/lib/services/courses/authoring";
import { createClient } from "@/lib/supabase/server";
import { BuilderShell } from "../builder-shell";
import { CourseDetailsForm } from "../course-details-form";
import { CurriculumEditor } from "../curriculum-editor";
import { LessonEditor } from "../lesson-editor";
import { QuizOverview } from "../quiz-overview";
import { QuizSettingsForm } from "../quiz-settings-form";
import { QuestionList } from "../question-list";
import { AssignmentOverview } from "../assignment-overview";
import { AssignmentEditor } from "../assignment-editor";
import { ReviewPanel } from "../review-panel";
import { InstructorsManager } from "../instructors-manager";
import { ReadOnlyNotice } from "../form-bits";

type Params = { area: BuilderArea; courseId: string };

function SubHeader({ back, title, description }: { back: { href: string; label: string }; title: string; description?: string }) {
  return (
    <div className="grid gap-1">
      <Link href={back.href} className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> {back.label}
      </Link>
      <h2 className="font-heading text-xl font-semibold">{title}</h2>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

/** Layout for every /…/courses/[id] route. */
export async function CourseBuilderLayout({ area, courseId, children }: Params & { children: React.ReactNode }) {
  const ctx = await loadBuilderContext(courseId, area);
  return (
    <BuilderShell ctx={ctx}>
      {!ctx.canEdit ? <ReadOnlyNotice /> : null}
      {children}
    </BuilderShell>
  );
}

export async function CourseDetailsPage({ area, courseId }: Params) {
  const ctx = await loadBuilderContext(courseId, area);
  const supabase = await createClient();
  const [categories, videosRes] = await Promise.all([
    listCategoryOptions(),
    supabase.from("video_assets").select("id, title, provider").eq("course_id", courseId).eq("status", "ready").order("created_at", { ascending: false }),
  ]);
  return (
    <CourseDetailsForm
      course={ctx.course}
      categories={categories}
      videos={(videosRes.data ?? []) as { id: string; title: string | null; provider: string }[]}
      canEdit={ctx.canEdit}
    />
  );
}

export async function CurriculumPage({ area, courseId }: Params) {
  const ctx = await loadBuilderContext(courseId, area);
  const modules = await loadCurriculum(courseId);
  return <CurriculumEditor courseId={courseId} courseBase={ctx.courseBase} modules={modules} canEdit={ctx.canEdit} />;
}

export async function LessonEditorPage({ area, courseId, lessonId }: Params & { lessonId: string }) {
  const ctx = await loadBuilderContext(courseId, area);
  const [data, modules, providers] = await Promise.all([loadLessonEditor(courseId, lessonId), loadCurriculum(courseId), videoProviderStatuses()]);
  if (!data) notFound();
  const liveHref = area === "admin" ? `/admin/live?course=${courseId}` : `/teach/live?course=${courseId}`;
  return (
    <div className="grid gap-4">
      <Link href={`${ctx.courseBase}/curriculum`} className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Curriculum
      </Link>
      <LessonEditor data={data} modules={modules} courseBase={ctx.courseBase} liveHref={liveHref} providers={providers} canEdit={ctx.canEdit} />
    </div>
  );
}

export async function QuizzesPage({ area, courseId }: Params) {
  const ctx = await loadBuilderContext(courseId, area);
  const { quizzes, banks } = await loadQuizOverview(courseId);
  return <QuizOverview courseId={courseId} courseBase={ctx.courseBase} quizzes={quizzes} banks={banks} canEdit={ctx.canEdit} />;
}

export async function QuizEditorPage({ area, courseId, quizId }: Params & { quizId: string }) {
  const ctx = await loadBuilderContext(courseId, area);
  const [data, bankPicker] = await Promise.all([loadQuizEditor(courseId, quizId), loadBankQuestionsForPicker(courseId)]);
  if (!data) notFound();
  const usesBank = Boolean(data.quiz.question_bank_id && data.quiz.draw_count);
  return (
    <div className="grid gap-6">
      <SubHeader back={{ href: `${ctx.courseBase}/quizzes`, label: "All quizzes" }} title={data.quiz.title} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0">
          {usesBank ? (
            <p className="mb-4 rounded-xl border bg-info-soft px-4 py-3 text-sm text-info">
              This quiz draws {data.quiz.draw_count} random questions from a bank for each attempt. The questions below are used only if you turn that off.
            </p>
          ) : null}
          <QuestionList courseId={courseId} quizId={quizId} questions={data.questions} banks={bankPicker} canEdit={ctx.canEdit} />
        </div>
        <div className="xl:sticky xl:top-20 xl:self-start">
          <QuizSettingsForm courseId={courseId} quiz={data.quiz} banks={data.banks} lessons={data.lessons} canEdit={ctx.canEdit} attemptCount={data.attemptCount} />
        </div>
      </div>
    </div>
  );
}

export async function QuestionBankPage({ area, courseId, bankId }: Params & { bankId: string }) {
  const ctx = await loadBuilderContext(courseId, area);
  const data = await loadBankEditor(courseId, bankId);
  if (!data) notFound();
  return (
    <div className="grid gap-6">
      <SubHeader
        back={{ href: `${ctx.courseBase}/quizzes`, label: "Quizzes and banks" }}
        title={data.bank.title}
        description={data.bank.description ?? "Questions in this bank can be copied into quizzes or drawn at random."}
      />
      <QuestionList courseId={courseId} bankId={bankId} questions={data.questions} canEdit={ctx.canEdit} />
    </div>
  );
}

export async function AssignmentsPage({ area, courseId }: Params) {
  const ctx = await loadBuilderContext(courseId, area);
  const assignments = await loadAssignmentOverview(courseId);
  return (
    <AssignmentOverview
      courseId={courseId}
      courseBase={ctx.courseBase}
      assignments={assignments}
      canEdit={ctx.canEdit}
      reviewHref={area === "teach" ? `/teach/reviews?course=${courseId}` : null}
    />
  );
}

export async function AssignmentEditorPage({ area, courseId, assignmentId }: Params & { assignmentId: string }) {
  const ctx = await loadBuilderContext(courseId, area);
  const data = await loadAssignmentEditor(courseId, assignmentId);
  if (!data) notFound();
  return (
    <div className="grid gap-6">
      <SubHeader back={{ href: `${ctx.courseBase}/assignments`, label: "All assignments" }} title={data.assignment.title} />
      <AssignmentEditor
        courseId={courseId}
        assignment={data.assignment}
        lessons={data.lessons}
        files={data.files}
        canEdit={ctx.canEdit}
        submissionCount={data.submissionCount}
      />
    </div>
  );
}

export async function ReviewPage({ area, courseId }: Params) {
  const ctx = await loadBuilderContext(courseId, area);
  const readiness = await courseReadiness(ctx.course);
  return <ReviewPanel course={ctx.course} readiness={readiness} isAdmin={area === "admin" && ctx.role.isAdmin} canEdit={ctx.canEdit} />;
}

export async function InstructorsPage({ courseId }: { courseId: string }) {
  await loadBuilderContext(courseId, "admin");
  const { rows, available } = await loadInstructorAssignments(courseId);
  return <InstructorsManager courseId={courseId} rows={rows} available={available} />;
}
