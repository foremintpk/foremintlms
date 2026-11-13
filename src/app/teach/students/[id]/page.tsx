import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Activity, MessageSquare } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/app-shell/page-header";
import { LocalTime } from "@/components/common/local-time";
import { StatusBadge } from "@/components/common/status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireTeacher } from "@/lib/auth/guards";
import { initials } from "@/lib/format";
import { getStudentDetail } from "@/lib/services/teacher-analytics";

export const instant = false;
export const metadata = { title: "Student" };

export default async function TeachStudentPage({ params }: PageProps<"/teach/students/[id]">) {
  const { id } = await params;
  const user = await requireTeacher(`/teach/students/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();
  const student = await getStudentDetail(user, id);
  // Not enrolled in any of this instructor's courses → not visible.
  if (!student) notFound();

  return (
    <>
      <PageHeader
        back={{ href: "/teach/students", label: "Students" }}
        title={
          <span className="flex items-center gap-3">
            <Avatar className="size-11">
              {student.avatar_url ? <AvatarImage src={student.avatar_url} alt="" /> : null}
              <AvatarFallback className="bg-brand-soft text-sm text-primary">{initials(student.full_name)}</AvatarFallback>
            </Avatar>
            {student.full_name}
          </span>
        }
        description={[student.headline, student.email, `Time zone: ${student.timezone}`].filter(Boolean).join(" · ")}
        actions={
          <Button asChild>
            <Link href={`/teach/messages?to=${student.id}`}>
              <MessageSquare /> Message
            </Link>
          </Button>
        }
      />

      <div className="grid gap-8 xl:grid-cols-[1.6fr_1fr]">
        <div className="grid content-start gap-6">
          {student.courses.map((c) => (
            <section key={c.course.id} className="rounded-2xl border bg-card p-5 shadow-card">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/teach/courses/${c.course.id}`} className="font-heading text-base font-semibold hover:text-primary">
                    {c.course.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    Enrolled <LocalTime value={c.enrollment.enrolled_at} format="date" />
                    {c.enrollment.last_accessed_at ? (
                      <>
                        {" "}
                        · last active <LocalTime value={c.enrollment.last_accessed_at} format="relative" />
                      </>
                    ) : null}
                    {c.enrollment.completed_at ? (
                      <>
                        {" "}
                        · completed <LocalTime value={c.enrollment.completed_at} format="date" />
                      </>
                    ) : null}
                  </p>
                </div>
                <StatusBadge status={c.enrollment.status} />
              </div>

              <div className="mb-5">
                <div className="mb-1.5 flex justify-between text-sm">
                  <span>
                    {c.lessonsCompleted} of {c.lessonsTotal} lessons completed
                  </span>
                  <span className="font-medium tabular-nums">{Math.round(c.enrollment.progress_percent)}%</span>
                </div>
                <Progress value={c.enrollment.progress_percent} className="h-2 [&>[data-slot=progress-indicator]]:bg-mint-strong" aria-label="Course progress" />
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-medium">Quizzes</p>
                  {c.quizzes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">This course has no quizzes.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Quiz</TableHead>
                          <TableHead className="text-right">Best</TableHead>
                          <TableHead className="text-right">Result</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {c.quizzes.map((q) => (
                          <TableRow key={q.quiz_id}>
                            <TableCell className="max-w-44 truncate text-sm">
                              {q.title}
                              <span className="block text-xs text-muted-foreground">
                                {q.attempts} attempt{q.attempts === 1 ? "" : "s"}
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums">{q.best_percent === null ? "—" : `${q.best_percent}%`}</TableCell>
                            <TableCell className="text-right">
                              {q.awaiting_review ? (
                                <StatusBadge status="needs_review" label="Needs review" />
                              ) : q.attempts === 0 ? (
                                <span className="text-xs text-muted-foreground">Not taken</span>
                              ) : q.passed ? (
                                <StatusBadge status="passed" />
                              ) : (
                                <StatusBadge status="failed" label="Not passed" tone="neutral" />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">Assignments</p>
                  {c.assignments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No submissions yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Assignment</TableHead>
                          <TableHead className="text-right">Grade</TableHead>
                          <TableHead className="text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {c.assignments.map((a) => (
                          <TableRow key={a.submission_id}>
                            <TableCell className="max-w-44 truncate text-sm">
                              <Link href={`/teach/reviews/submissions/${a.submission_id}`} className="hover:text-primary">
                                {a.title}
                              </Link>
                              {a.is_late ? <span className="block text-xs text-warning">Late</span> : null}
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums">
                              {a.grade_points === null ? "—" : `${a.grade_points} / ${a.max_points}`}
                            </TableCell>
                            <TableCell className="text-right">
                              <StatusBadge status={a.status} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </section>
          ))}
        </div>

        <section>
          <SectionHeader title="Recent activity" />
          {student.activity.length === 0 ? (
            <p className="flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              <Activity className="size-4" /> No learning activity yet.
            </p>
          ) : (
            <ol className="relative grid gap-4 border-l pl-5">
              {student.activity.map((a, i) => (
                <li key={`${a.at}-${i}`} className="relative">
                  <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-card bg-primary" aria-hidden />
                  <p className="text-sm">{a.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.course_title} · <LocalTime value={a.at} format="relative" />
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}
