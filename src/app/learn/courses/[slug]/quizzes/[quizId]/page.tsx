import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2, Clock, Hourglass, ListChecks, RotateCcw, XCircle } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/app-shell/page-header";
import { LocalTime } from "@/components/common/local-time";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QuizRunner, StartQuizButton } from "@/components/learning/quiz-runner";
import { requireUser } from "@/lib/auth/guards";
import { UserFacingError } from "@/lib/actions";
import { formatDuration } from "@/lib/format";
import { isAttemptExpired } from "@/lib/domain/quiz";
import { getCourseBySlug } from "@/lib/services/learner";
import {
  attemptAvailability,
  getAttemptForTaking,
  getAttemptResult,
  getQuizForLearner,
  listAttempts,
  submitAttempt,
} from "@/lib/services/quiz-attempts";
import { cn } from "@/lib/utils";

export const instant = false;

export const metadata: Metadata = { title: "Quiz" };

const uuidRe = /^[0-9a-f-]{36}$/i;

export default async function QuizPage({ params, searchParams }: PageProps<"/learn/courses/[slug]/quizzes/[quizId]">) {
  const { slug, quizId } = await params;
  const sp = await searchParams;
  const attemptParam = typeof sp.attempt === "string" && uuidRe.test(sp.attempt) ? sp.attempt : null;
  const resultParam = typeof sp.result === "string" && uuidRe.test(sp.result) ? sp.result : null;
  const base = `/learn/courses/${slug}/quizzes/${quizId}`;

  const user = await requireUser(base);
  const course = await getCourseBySlug(slug);
  if (!course || !uuidRe.test(quizId)) notFound();

  let ctx: Awaited<ReturnType<typeof getQuizForLearner>>;
  try {
    ctx = await getQuizForLearner(user, quizId, course.id);
  } catch (err) {
    if (err instanceof UserFacingError) redirect(`/learn/courses/${slug}`);
    throw err;
  }
  if (!ctx) notFound();
  const { quiz } = ctx;

  // --- Taking an attempt -----------------------------------------------------
  if (attemptParam) {
    let taking: Awaited<ReturnType<typeof getAttemptForTaking>>;
    try {
      taking = await getAttemptForTaking(user, attemptParam);
    } catch {
      notFound();
    }
    if (taking.attempt.quiz_id !== quiz.id) notFound();
    if (taking.attempt.status !== "in_progress") redirect(`${base}?result=${taking.attempt.id}`);
    if (isAttemptExpired(taking.attempt.expires_at)) {
      await submitAttempt(user, taking.attempt.id, []);
      redirect(`${base}?result=${taking.attempt.id}`);
    }
    return (
      <>
        <PageHeader title={quiz.title} description={`Attempt ${taking.attempt.attempt_number}`} back={{ href: base, label: "Quiz overview" }} />
        <div className="mx-auto max-w-3xl">
          <QuizRunner
            attemptId={taking.attempt.id}
            questions={taking.questions}
            initialAnswers={taking.answers}
            expiresAt={taking.attempt.expires_at}
            resultHref={`${base}?result=${taking.attempt.id}`}
          />
        </div>
      </>
    );
  }

  // --- Results ------------------------------------------------------------------
  if (resultParam) {
    let res: Awaited<ReturnType<typeof getAttemptResult>>;
    try {
      res = await getAttemptResult(user, resultParam);
    } catch {
      notFound();
    }
    if (res.attempt.quiz_id !== quiz.id) notFound();
    if (res.attempt.status === "in_progress") redirect(`${base}?attempt=${res.attempt.id}`);
    const { attempt } = res;
    const pending = attempt.status === "needs_review";
    const availability = attemptAvailability(quiz, await listAttempts(user.id, quiz.id));
    return (
      <>
        <PageHeader title={quiz.title} description={`Attempt ${attempt.attempt_number} results`} back={{ href: base, label: "Quiz overview" }} />
        <div className="mx-auto max-w-3xl space-y-8">
          <div
            className={cn(
              "flex flex-col gap-4 rounded-2xl border p-6 sm:flex-row sm:items-center",
              pending ? "bg-warning-soft/60" : attempt.passed ? "border-mint/50 bg-mint-soft" : "bg-card",
            )}
          >
            <span
              className={cn(
                "grid size-14 shrink-0 place-items-center rounded-2xl",
                pending ? "bg-warning-soft text-warning" : attempt.passed ? "bg-white/70 text-mint-strong" : "bg-destructive/10 text-destructive",
              )}
            >
              {pending ? <Hourglass className="size-7" /> : attempt.passed ? <CheckCircle2 className="size-7" /> : <XCircle className="size-7" />}
            </span>
            <div className="flex-1">
              <p className="font-heading text-2xl font-semibold">
                {pending ? "Waiting for your instructor" : attempt.passed ? "You passed" : "Not passed this time"}
              </p>
              <p className="text-sm text-muted-foreground">
                {pending
                  ? `Some answers need marking. Your current score is ${attempt.score ?? 0} of ${attempt.max_score ?? 0} points; we'll notify you when it's final.`
                  : `You scored ${Math.round(Number(attempt.percent ?? 0))}% (${attempt.score} of ${attempt.max_score} points). The pass mark is ${quiz.passing_score}%.`}
              </p>
            </div>
            {!attempt.passed && !pending && availability.allowed ? (
              <StartQuizButton quizId={quiz.id} courseId={course.id} quizHref={base} label="Try again" />
            ) : null}
          </div>

          {res.questions.length ? (
            <section>
              <SectionHeader title="Your answers" description={res.reveal ? "Correct answers are shown in green." : "Correct answers aren't shown for this quiz."} />
              <ol className="space-y-4">
                {res.questions.map((q, i) => (
                  <li key={q.id} className="rounded-2xl border bg-card p-5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium">
                        <span className="mr-2 text-muted-foreground tabular-nums">{i + 1}.</span>
                        <span className="whitespace-pre-wrap">{q.prompt}</span>
                      </p>
                      <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                        {q.pointsAwarded != null ? `${q.pointsAwarded}/${q.points}` : "Pending"}
                      </span>
                    </div>
                    {q.type === "short_answer" ? (
                      <div className="mt-3 space-y-2 text-sm">
                        <p className="rounded-lg bg-muted px-3 py-2 whitespace-pre-wrap">{q.text || <span className="text-muted-foreground">No answer</span>}</p>
                        {q.acceptedAnswers?.length ? (
                          <p className="text-mint-strong">Accepted answers: {q.acceptedAnswers.join(", ")}</p>
                        ) : null}
                      </div>
                    ) : (
                      <ul className="mt-3 space-y-1.5">
                        {q.options.map((o) => {
                          const chosen = q.selected.includes(o.id);
                          return (
                            <li
                              key={o.id}
                              className={cn(
                                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                                o.isCorrect === true && "border-mint/60 bg-mint-soft",
                                chosen && o.isCorrect === false && "border-destructive/40 bg-destructive/5",
                                chosen && o.isCorrect === null && "border-primary/50 bg-brand-soft/60",
                              )}
                            >
                              <span className="flex-1">{o.label}</span>
                              {chosen ? <span className="text-xs font-medium text-muted-foreground">Your answer</span> : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {q.feedback ? <p className="mt-3 rounded-lg bg-info-soft px-3 py-2 text-sm text-info">Instructor feedback: {q.feedback}</p> : null}
                    {q.explanation ? <p className="mt-3 text-sm text-muted-foreground">{q.explanation}</p> : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
          <Button asChild variant="outline">
            <Link href={`/learn/courses/${slug}`}>Back to the course</Link>
          </Button>
        </div>
      </>
    );
  }

  // --- Overview -----------------------------------------------------------------
  const attempts = await listAttempts(user.id, quiz.id);
  const availability = attemptAvailability(quiz, attempts);
  const finished = attempts.filter((a) => a.status !== "in_progress");
  const best = finished.reduce<number | null>((m, a) => (a.percent == null ? m : Math.max(m ?? 0, Number(a.percent))), null);
  const passed = finished.some((a) => a.passed);
  const staffPreview = ctx.access.isStaff && !ctx.access.enrollment;

  return (
    <>
      <PageHeader title={quiz.title} description={quiz.description} back={{ href: `/learn/courses/${slug}`, label: course.title }} />
      <div className="mx-auto max-w-3xl space-y-8">
        <dl className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border bg-card p-4">
            <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <ListChecks className="size-4" /> Pass mark
            </dt>
            <dd className="mt-1 font-heading text-2xl font-semibold">{quiz.passing_score}%</dd>
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="size-4" /> Time limit
            </dt>
            <dd className="mt-1 font-heading text-2xl font-semibold">{quiz.time_limit_minutes ? formatDuration(quiz.time_limit_minutes) : "None"}</dd>
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <RotateCcw className="size-4" /> Attempts
            </dt>
            <dd className="mt-1 font-heading text-2xl font-semibold tabular-nums">
              {availability.attemptsUsed}
              {quiz.max_attempts ? ` / ${quiz.max_attempts}` : ""}
            </dd>
          </div>
        </dl>

        <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            {passed ? (
              <p className="flex items-center gap-2 font-medium text-mint-strong">
                <CheckCircle2 className="size-4" /> Passed{best != null ? ` — best score ${Math.round(best)}%` : ""}
              </p>
            ) : best != null ? (
              <p className="text-muted-foreground">Best score so far: {Math.round(best)}%</p>
            ) : (
              <p className="text-muted-foreground">
                {quiz.time_limit_minutes ? "The timer starts as soon as you begin. " : ""}Your answers save automatically as you go.
              </p>
            )}
            {!availability.allowed && !availability.inProgress ? (
              <p className="mt-1 text-muted-foreground">
                {availability.reason === "max_attempts" ? (
                  "You've used all your attempts."
                ) : availability.reason === "cooldown" && availability.retryAt ? (
                  <>
                    You can try again <LocalTime value={availability.retryAt.toISOString()} format="weekday" />.
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
          {staffPreview ? (
            <p className="text-sm text-muted-foreground">Staff can&apos;t take quizzes from the student view.</p>
          ) : availability.inProgress ? (
            <Button asChild size="lg">
              <Link href={`${base}?attempt=${availability.inProgress.id}`}>Resume attempt</Link>
            </Button>
          ) : availability.allowed ? (
            <StartQuizButton quizId={quiz.id} courseId={course.id} quizHref={base} label={finished.length ? "Start a new attempt" : "Start quiz"} />
          ) : null}
        </div>

        {finished.length ? (
          <section>
            <SectionHeader title="Your attempts" />
            <div className="overflow-hidden rounded-2xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Attempt</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead className="sr-only">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {finished.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="tabular-nums">#{a.attempt_number}</TableCell>
                      <TableCell>
                        <LocalTime value={a.submitted_at} format="datetime" />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{a.percent != null ? `${Math.round(Number(a.percent))}%` : "—"}</TableCell>
                      <TableCell>
                        {a.status === "needs_review" ? (
                          <StatusBadge status="needs_review" label="Awaiting review" />
                        ) : (
                          <StatusBadge status={a.passed ? "passed" : "failed"} label={a.passed ? "Passed" : "Not passed"} />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`${base}?result=${a.id}`} className="text-sm font-medium text-primary hover:underline">
                          View
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
