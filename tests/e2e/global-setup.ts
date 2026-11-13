import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { adminClient, E2E_STATE_FILE, totpCode, type E2EState } from "./fixtures";

/**
 * Seeds an isolated set of e2e users and content in the configured Supabase
 * project. Everything is tagged with the "e2e-" slug / "e2e+" email prefix and
 * removed in global-teardown, so it never mixes with real academy data.
 */
export default async function globalSetup() {
  const admin = adminClient();
  const run = Date.now().toString(36);
  const password = `E2e!${run}Pass-${Math.random().toString(36).slice(2, 10)}`;

  async function createUser(label: string, fullName: string) {
    const email = `e2e+${label}-${run}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error || !data.user) throw new Error(`createUser ${label}: ${error?.message}`);
    return { id: data.user.id, email, password };
  }

  const adminUser = await createUser("admin", "E2E Admin");
  const teacher = await createUser("teacher", "E2E Teacher");
  const otherTeacher = await createUser("teacher2", "E2E Other Teacher");
  const student = await createUser("student", "E2E Student");

  await admin.from("user_roles").insert([
    { user_id: adminUser.id, role: "admin" },
    { user_id: teacher.id, role: "teacher" },
    { user_id: otherTeacher.id, role: "teacher" },
  ]);
  await admin.from("teacher_profiles").insert([
    { user_id: teacher.id, slug: `e2e-teacher-${run}`, public_name: "E2E Teacher", status: "approved", can_create_courses: true },
    { user_id: otherTeacher.id, slug: `e2e-teacher2-${run}`, public_name: "E2E Other Teacher", status: "approved" },
  ]);

  // Enrol a TOTP factor for the admin so the MFA screen can be completed.
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signIn = await anon.auth.signInWithPassword({ email: adminUser.email, password });
  if (signIn.error) throw new Error(`admin sign-in: ${signIn.error.message}`);
  const enroll = await anon.auth.mfa.enroll({ factorType: "totp", friendlyName: "e2e" });
  if (enroll.error || !enroll.data) throw new Error(`mfa enroll: ${enroll.error?.message}`);
  const secret = enroll.data.totp.secret;
  const verify = await anon.auth.mfa.challengeAndVerify({ factorId: enroll.data.id, code: totpCode(secret) });
  if (verify.error) throw new Error(`mfa verify: ${verify.error.message}`);
  await anon.auth.signOut();

  const { data: category } = await admin
    .from("course_categories")
    .insert({ slug: `e2e-category-${run}`, name: `E2E Category ${run}`, status: "published" })
    .select("id")
    .single();

  const courseSlug = `e2e-course-${run}`;
  const otherCourseSlug = `e2e-other-course-${run}`;
  const { data: courses, error: courseError } = await admin
    .from("courses")
    .insert([
      { slug: courseSlug, title: `E2E Course ${run}`, short_description: "E2E course", status: "published", visibility: "public", category_id: category!.id, is_free: true },
      { slug: otherCourseSlug, title: `E2E Other Course ${run}`, short_description: "Other teacher's course", status: "published", visibility: "public", category_id: category!.id },
    ])
    .select("id, slug");
  if (courseError || !courses) throw new Error(`courses: ${courseError?.message}`);
  const course = courses.find((c) => c.slug === courseSlug)!;
  const other = courses.find((c) => c.slug === otherCourseSlug)!;

  await admin.from("course_instructors").insert([
    { course_id: course.id, user_id: teacher.id },
    { course_id: other.id, user_id: otherTeacher.id },
  ]);
  const { data: module } = await admin.from("course_modules").insert({ course_id: course.id, title: "Getting started" }).select("id").single();
  const { data: lesson } = await admin
    .from("lessons")
    .insert({ course_id: course.id, module_id: module!.id, title: "Welcome lesson", lesson_type: "article", completion_rule: "manual" })
    .select("id")
    .single();
  await admin.from("lesson_content_blocks").insert({
    lesson_id: lesson!.id,
    course_id: course.id,
    block_type: "rich_text",
    data: { html: "<p>Welcome to the end-to-end test course.</p>" },
  });

  const state: E2EState = {
    admin: { ...adminUser, totpSecret: secret },
    teacher,
    otherTeacher,
    student,
    courseId: course.id,
    courseSlug,
    otherCourseSlug,
    lessonId: lesson!.id,
    categoryId: category!.id,
  };
  fs.mkdirSync(path.dirname(E2E_STATE_FILE), { recursive: true });
  fs.writeFileSync(E2E_STATE_FILE, JSON.stringify(state, null, 2));
}
