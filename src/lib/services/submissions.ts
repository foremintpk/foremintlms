import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SessionUser } from "@/lib/auth/session";
import { getCourseAccess } from "@/lib/services/access";
import { notify } from "@/lib/services/notifications";
import { fileExtension } from "@/lib/services/storage";
import { UserFacingError } from "@/lib/actions";
import { isReleased, lessonReleaseDate } from "@/lib/domain/access";
import { assignmentDueDate, canSubmitNew, isLate, type SubmissionLike } from "@/lib/services/assignments/due";

export interface AssignmentRow {
  id: string;
  course_id: string;
  lesson_id: string | null;
  title: string;
  instructions: string | null;
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
  rubric: { id?: string; criterion: string; description?: string; points: number }[];
  grading_criteria: string | null;
  status: string;
  supporting_media_ids: string[];
}

export interface SubmissionRow extends SubmissionLike {
  id: string;
  attempt_number: number;
  text_body: string | null;
  links: string[];
  file_ids: string[];
  submitted_at: string;
  is_late: boolean;
  rubric_scores: Record<string, number>;
  graded_at: string | null;
}

const ASSIGNMENT_COLUMNS =
  "id, course_id, lesson_id, title, instructions, max_points, passing_points, due_at, due_days_after_enrollment, allow_late_submissions, late_penalty_percent, submission_types, allowed_file_types, max_file_size_mb, max_files, rubric, grading_criteria, status, supporting_media_ids";

/** Load an assignment the learner may view (access + published + released). */
export async function getAssignmentForLearner(user: SessionUser, courseId: string, assignmentId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("assignments").select(ASSIGNMENT_COLUMNS).eq("id", assignmentId).eq("course_id", courseId).maybeSingle();
  const assignment = data as AssignmentRow | null;
  if (!assignment) return null;
  const { data: course } = await admin.from("courses").select("id, status").eq("id", courseId).single();
  const access = await getCourseAccess(user, { id: courseId, status: course?.status ?? "draft" });
  if (!access.hasAccess) throw new UserFacingError("You don't have access to this course.");
  if (assignment.status !== "published" && !access.isStaff) throw new UserFacingError("This assignment isn't available.");
  if (assignment.lesson_id && !access.isStaff) {
    const { data: lesson } = await admin
      .from("lessons")
      .select("release_at, release_after_days, course_modules(release_at, release_after_days)")
      .eq("id", assignment.lesson_id)
      .maybeSingle();
    const l = lesson as { release_at: string | null; release_after_days: number | null; course_modules: { release_at: string | null; release_after_days: number | null } | null } | null;
    if (l?.course_modules) {
      const release = lessonReleaseDate(l, l.course_modules, access.enrollment ? new Date(access.enrollment.enrolled_at) : null);
      if (!isReleased(release)) throw new UserFacingError("This assignment hasn't been released yet.");
    }
  }
  const due = assignmentDueDate(assignment, access.enrollment?.enrolled_at ?? null);
  return { assignment, access, due };
}

export async function listSubmissions(userId: string, assignmentId: string): Promise<SubmissionRow[]> {
  const { data } = await createAdminClient()
    .from("assignment_submissions")
    .select("id, attempt_number, status, text_body, links, file_ids, submitted_at, is_late, grade_points, rubric_scores, graded_at")
    .eq("user_id", userId)
    .eq("assignment_id", assignmentId)
    .order("attempt_number", { ascending: false });
  return (data ?? []) as SubmissionRow[];
}

export async function getFeedbackFor(submissionIds: string[]) {
  if (submissionIds.length === 0) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("assignment_feedback")
    .select("id, submission_id, author_id, body, created_at")
    .in("submission_id", submissionIds)
    .order("created_at");
  const rows = (data ?? []) as { id: string; submission_id: string; author_id: string | null; body: string; created_at: string }[];
  const authorIds = [...new Set(rows.map((r) => r.author_id).filter(Boolean))] as string[];
  const { data: names } = authorIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", authorIds)
    : { data: [] as { id: string; full_name: string }[] };
  const byId = new Map(((names ?? []) as { id: string; full_name: string }[]).map((n) => [n.id, n.full_name]));
  return rows.map((r) => ({ ...r, author_name: (r.author_id && byId.get(r.author_id)) || "Instructor" }));
}

export async function getMediaMeta(ids: string[]) {
  if (ids.length === 0) return [];
  const { data } = await createAdminClient()
    .from("media_files")
    .select("id, file_name, mime_type, size_bytes, status")
    .in("id", ids);
  return ((data ?? []) as { id: string; file_name: string; mime_type: string; size_bytes: number; status: string }[]).filter(
    (f) => f.status === "ready",
  );
}

export interface SubmitInput {
  assignmentId: string;
  courseId: string;
  textBody?: string | null;
  links?: string[];
  fileIds?: string[];
}

/** Create a submission after enforcing every rule on the server. */
export async function submitAssignment(user: SessionUser, input: SubmitInput) {
  const ctx = await getAssignmentForLearner(user, input.courseId, input.assignmentId);
  if (!ctx) throw new UserFacingError("Assignment not found.");
  const { assignment, access, due } = ctx;
  if (access.isStaff && !access.enrollment) throw new UserFacingError("Preview mode: staff can't submit.");
  if (assignment.status !== "published") throw new UserFacingError("This assignment isn't open for submissions.");

  const previous = await listSubmissions(user.id, assignment.id);
  const gate = canSubmitNew(previous[0]);
  if (!gate.allowed) throw new UserFacingError(gate.reason ?? "You can't submit right now.");

  const now = new Date();
  const late = isLate(due, now);
  if (late && !assignment.allow_late_submissions) throw new UserFacingError("The deadline has passed and late submissions aren't accepted.");

  const types = new Set(assignment.submission_types);
  const text = (input.textBody ?? "").trim();
  const links = [...new Set((input.links ?? []).map((l) => l.trim()).filter(Boolean))];
  const fileIds = [...new Set(input.fileIds ?? [])];

  if (text && !types.has("text")) throw new UserFacingError("This assignment doesn't accept written answers.");
  if (links.length && !types.has("link")) throw new UserFacingError("This assignment doesn't accept links.");
  if (fileIds.length && !types.has("file")) throw new UserFacingError("This assignment doesn't accept files.");
  if (!text && links.length === 0 && fileIds.length === 0) throw new UserFacingError("Add your work before submitting.");
  if (text.length > 50_000) throw new UserFacingError("Your written answer is too long.");
  if (links.length > 10) throw new UserFacingError("Add up to 10 links.");
  for (const link of links) {
    try {
      const u = new URL(link);
      if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
    } catch {
      throw new UserFacingError(`“${link.slice(0, 60)}” isn't a valid web link.`);
    }
  }
  if (fileIds.length > assignment.max_files) throw new UserFacingError(`Attach up to ${assignment.max_files} files.`);

  const admin = createAdminClient();
  if (fileIds.length) {
    const { data: files } = await admin
      .from("media_files")
      .select("id, file_name, size_bytes, uploaded_by, purpose, status, course_id, storage_path")
      .in("id", fileIds);
    const rows = (files ?? []) as {
      id: string;
      file_name: string;
      size_bytes: number;
      uploaded_by: string;
      purpose: string;
      status: string;
      course_id: string | null;
      storage_path: string;
    }[];
    if (rows.length !== fileIds.length) throw new UserFacingError("One of your files couldn't be found. Upload it again.");
    const allowed = new Set(assignment.allowed_file_types.map((e) => e.toLowerCase()));
    for (const f of rows) {
      if (f.uploaded_by !== user.id || f.purpose !== "submission" || f.status !== "ready" || f.course_id !== assignment.course_id) {
        throw new UserFacingError("One of your files can't be used for this assignment.");
      }
      if (!f.storage_path.startsWith(`${user.id}/${assignment.id}/`)) throw new UserFacingError("One of your files belongs to another assignment.");
      if (!allowed.has(fileExtension(f.file_name))) throw new UserFacingError(`“${f.file_name}” isn't an accepted file type.`);
      if (Number(f.size_bytes) > assignment.max_file_size_mb * 1024 * 1024) {
        throw new UserFacingError(`“${f.file_name}” is larger than ${assignment.max_file_size_mb} MB.`);
      }
    }
  }

  const { data: created, error } = await admin
    .from("assignment_submissions")
    .insert({
      assignment_id: assignment.id,
      user_id: user.id,
      course_id: assignment.course_id,
      attempt_number: (previous[0]?.attempt_number ?? 0) + 1,
      status: "submitted",
      text_body: text || null,
      links,
      file_ids: fileIds,
      submitted_at: now.toISOString(),
      is_late: late,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") throw new UserFacingError("This submission was already received.");
    throw new Error(`submission insert failed: ${error.message}`);
  }

  const [{ data: staff }, { data: course }] = await Promise.all([
    admin.from("course_instructors").select("user_id").eq("course_id", assignment.course_id),
    admin.from("courses").select("title").eq("id", assignment.course_id).single(),
  ]);
  await notify(((staff ?? []) as { user_id: string }[]).map((s) => s.user_id), {
    category: "learning",
    type: "assignment_submitted",
    title: `New submission: ${assignment.title}`,
    body: `${user.fullName || user.displayName} submitted work for ${course?.title ?? "your course"}${late ? " (late)" : ""}.`,
    url: "/teach/reviews",
  });
  return { submissionId: created.id, late };
}
