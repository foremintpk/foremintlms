import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { certificateEligibility, generateCertificateNumber, type Eligibility } from "@/lib/domain/certificates";
import { isAssignmentSatisfied, type SubmissionLike } from "@/lib/services/assignments/due";
import { notify } from "@/lib/services/notifications";
import { appUrl } from "@/lib/env";

/**
 * Certificate issuance. Eligibility always comes from the course's own rules
 * (minimum progress, required quizzes, required assignments). Certificates
 * snapshot the recipient, course and instructor names at issue time.
 */

interface CertCourse {
  id: string;
  title: string;
  slug: string;
  certificate_enabled: boolean;
  certificate_min_progress: number;
  certificate_require_quizzes: boolean;
  certificate_require_assignments: boolean;
}

export interface CertificateStatus extends Eligibility {
  progressPercent: number;
  certificate: { id: string; certificate_number: string; issued_at: string; status: string } | null;
}

/** Eligibility checklist for the course page. */
export async function evaluateCertificate(userId: string, courseId: string): Promise<CertificateStatus> {
  const admin = createAdminClient();
  const [courseRes, enrollmentRes, quizzesRes, assignmentsRes, certRes] = await Promise.all([
    admin
      .from("courses")
      .select("id, title, slug, certificate_enabled, certificate_min_progress, certificate_require_quizzes, certificate_require_assignments")
      .eq("id", courseId)
      .single(),
    admin.from("enrollments").select("progress_percent").eq("user_id", userId).eq("course_id", courseId).maybeSingle(),
    admin.from("quizzes").select("id, title").eq("course_id", courseId).eq("status", "published").eq("counts_toward_completion", true),
    admin
      .from("assignments")
      .select("id, title, passing_points")
      .eq("course_id", courseId)
      .eq("status", "published")
      .eq("counts_toward_completion", true),
    admin.from("certificates").select("id, certificate_number, issued_at, status").eq("user_id", userId).eq("course_id", courseId).maybeSingle(),
  ]);
  const course = courseRes.data as CertCourse | null;
  if (!course) return { eligible: false, missing: ["Course not found."], progressPercent: 0, certificate: null };
  const progressPercent = Number(enrollmentRes.data?.progress_percent ?? 0);
  const quizzes = (quizzesRes.data ?? []) as { id: string; title: string }[];
  const assignments = (assignmentsRes.data ?? []) as { id: string; title: string; passing_points: number | null }[];

  const [passedRes, subsRes] = await Promise.all([
    quizzes.length
      ? admin.from("quiz_attempts").select("quiz_id").eq("user_id", userId).eq("passed", true).in("quiz_id", quizzes.map((q) => q.id))
      : Promise.resolve({ data: [] as { quiz_id: string }[] }),
    assignments.length
      ? admin
          .from("assignment_submissions")
          .select("assignment_id, status, grade_points, attempt_number")
          .eq("user_id", userId)
          .in("assignment_id", assignments.map((a) => a.id))
          .order("attempt_number", { ascending: false })
      : Promise.resolve({ data: [] as (SubmissionLike & { assignment_id: string })[] }),
  ]);
  const passed = new Set(((passedRes.data ?? []) as { quiz_id: string }[]).map((r) => r.quiz_id));
  const latest = new Map<string, SubmissionLike>();
  for (const s of (subsRes.data ?? []) as (SubmissionLike & { assignment_id: string })[]) {
    if (!latest.has(s.assignment_id)) latest.set(s.assignment_id, s);
  }

  const result = certificateEligibility({
    course,
    progressPercent,
    quizzes: quizzes.map((q) => ({ id: q.id, title: q.title, passed: passed.has(q.id) })),
    assignments: assignments.map((a) => ({
      id: a.id,
      title: a.title,
      // Only an approved or passing grade counts toward the certificate.
      status: isAssignmentSatisfied(latest.get(a.id), a) ? "approved" : (latest.get(a.id)?.status ?? null),
    })),
  });
  // A graded-but-failing assignment still blocks: reflect that in the message.
  const missing = result.missing.map((m) => m);
  for (const a of assignments) {
    const sub = latest.get(a.id);
    if (sub?.status === "graded" && !isAssignmentSatisfied(sub, a) && course.certificate_require_assignments) {
      const idx = missing.findIndex((m) => m.includes(`“${a.title}”`));
      const msg = `Reach the pass mark on the assignment “${a.title}”.`;
      if (idx >= 0) missing[idx] = msg;
      else missing.push(msg);
    }
  }
  const eligible = missing.length === 0 && course.certificate_enabled;
  return {
    eligible,
    missing,
    progressPercent,
    certificate: (certRes.data as CertificateStatus["certificate"]) ?? null,
  };
}

async function instructorName(courseId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("course_instructors")
    .select("user_id, role, sort_order")
    .eq("course_id", courseId)
    .order("role")
    .order("sort_order")
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const [{ data: teacher }, { data: profile }] = await Promise.all([
    admin.from("teacher_profiles").select("public_name").eq("user_id", data.user_id).maybeSingle(),
    admin.from("profiles").select("full_name").eq("id", data.user_id).maybeSingle(),
  ]);
  return teacher?.public_name || profile?.full_name || null;
}

/** Contract: issue the certificate if the learner now qualifies. Idempotent. */
export async function issueCertificateIfEligible(userId: string, courseId: string): Promise<{ issued: boolean; certificateId?: string }> {
  const admin = createAdminClient();
  const status = await evaluateCertificate(userId, courseId);
  if (status.certificate) return { issued: false, certificateId: status.certificate.id };
  if (!status.eligible) return { issued: false };

  const [{ data: enrollment }, { data: course }, { data: profile }, { data: priv }] = await Promise.all([
    admin.from("enrollments").select("id, completed_at").eq("user_id", userId).eq("course_id", courseId).maybeSingle(),
    admin.from("courses").select("title, slug").eq("id", courseId).single(),
    admin.from("profiles").select("full_name").eq("id", userId).single(),
    admin.from("profile_private").select("email").eq("user_id", userId).single(),
  ]);
  if (!enrollment || !course) return { issued: false };
  const recipient = profile?.full_name?.trim() || String(priv?.email ?? "").split("@")[0] || "Learner";
  const instructor = await instructorName(courseId);
  const issuedAt = new Date();
  const completion = enrollment.completed_at ? new Date(enrollment.completed_at) : issuedAt;

  for (let attempt = 0; attempt < 5; attempt++) {
    const number = generateCertificateNumber(issuedAt, randomBytes(8));
    const { data, error } = await admin
      .from("certificates")
      .insert({
        certificate_number: number,
        user_id: userId,
        course_id: courseId,
        enrollment_id: enrollment.id,
        recipient_name: recipient,
        course_title: course.title,
        instructor_name: instructor,
        completion_date: completion.toISOString().slice(0, 10),
        issued_at: issuedAt.toISOString(),
        metadata: { progress_percent: status.progressPercent },
      })
      .select("id")
      .single();
    if (!error && data) {
      const verifyUrl = appUrl(`/certificates/verify/${number}`);
      await notify(userId, {
        category: "learning",
        type: "certificate_issued",
        title: `Your certificate for ${course.title} is ready`,
        body: `Certificate ${number}`,
        url: "/learn/certificates",
        email: {
          templateKey: "learning.certificate_issued",
          idempotencyKey: `certificate:${data.id}`,
          payload: {
            course_title: course.title,
            certificate_number: number,
            verify_url: verifyUrl,
            cta_url: appUrl("/learn/certificates"),
            details: [
              { label: "Certificate", value: number },
              { label: "Verify at", value: verifyUrl },
            ],
          },
        },
      });
      return { issued: true, certificateId: data.id };
    }
    if (error?.code !== "23505") throw new Error(`certificate insert failed: ${error?.message}`);
    // Unique violation: either the number collided (retry) or a concurrent
    // request already issued this learner's certificate (stop).
    const { data: existing } = await admin.from("certificates").select("id").eq("user_id", userId).eq("course_id", courseId).maybeSingle();
    if (existing) return { issued: false, certificateId: existing.id };
  }
  throw new Error("Could not allocate a unique certificate number");
}

/**
 * Cron: issue certificates for learners who met the requirements but were
 * not issued one in-request (e.g. rules changed, a grade arrived later).
 */
export async function issuePendingCertificates(): Promise<number> {
  const admin = createAdminClient();
  const { data: courses } = await admin
    .from("courses")
    .select("id, certificate_min_progress")
    .eq("certificate_enabled", true)
    .in("status", ["published", "unpublished", "archived"]);
  let issued = 0;
  for (const course of (courses ?? []) as { id: string; certificate_min_progress: number }[]) {
    const [{ data: enrollments }, { data: certs }] = await Promise.all([
      admin
        .from("enrollments")
        .select("user_id")
        .eq("course_id", course.id)
        .gte("progress_percent", course.certificate_min_progress)
        .limit(500),
      admin.from("certificates").select("user_id").eq("course_id", course.id),
    ]);
    const have = new Set(((certs ?? []) as { user_id: string }[]).map((c) => c.user_id));
    for (const e of (enrollments ?? []) as { user_id: string }[]) {
      if (have.has(e.user_id)) continue;
      try {
        const r = await issueCertificateIfEligible(e.user_id, course.id);
        if (r.issued) issued++;
      } catch (err) {
        console.error("[certificates] issue failed", course.id, err);
      }
    }
  }
  return issued;
}

export interface CertificateRecord {
  id: string;
  certificate_number: string;
  user_id: string;
  course_id: string;
  recipient_name: string;
  course_title: string;
  instructor_name: string | null;
  completion_date: string;
  issued_at: string;
  status: "issued" | "revoked";
}

export async function getCertificate(id: string): Promise<CertificateRecord | null> {
  const { data } = await createAdminClient()
    .from("certificates")
    .select("id, certificate_number, user_id, course_id, recipient_name, course_title, instructor_name, completion_date, issued_at, status")
    .eq("id", id)
    .maybeSingle();
  return (data as CertificateRecord | null) ?? null;
}
