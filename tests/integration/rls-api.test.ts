import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupUsers, hasSupabase, makeUser, runId, service, skipReason } from "./helpers";

/**
 * Exercises Row Level Security and Storage policies through the real
 * PostgREST / Storage APIs, exactly as the browser and server clients do.
 */
describe.skipIf(!hasSupabase)("RLS through the Supabase API", () => {
  let student: Awaited<ReturnType<typeof makeUser>>;
  let other: Awaited<ReturnType<typeof makeUser>>;
  let teacher: Awaited<ReturnType<typeof makeUser>>;
  let otherTeacher: Awaited<ReturnType<typeof makeUser>>;
  let courseId = "";
  let otherCourseId = "";
  let paidBlockId = "";
  let privatePath = "";

  beforeAll(async () => {
    const admin = service();
    [student, other, teacher, otherTeacher] = await Promise.all([
      makeUser("student"),
      makeUser("other"),
      makeUser("teacher", ["teacher"]),
      makeUser("teacher2", ["teacher"]),
    ]);
    const { data: courses, error } = await admin
      .from("courses")
      .insert([
        { slug: `it-course-${runId}`, title: "IT course", status: "published", visibility: "public" },
        { slug: `it-other-${runId}`, title: "IT other", status: "published", visibility: "public" },
      ])
      .select("id, slug");
    if (error) throw error;
    courseId = courses!.find((c) => c.slug.startsWith("it-course"))!.id;
    otherCourseId = courses!.find((c) => c.slug.startsWith("it-other"))!.id;
    await admin.from("course_instructors").insert([
      { course_id: courseId, user_id: teacher.id },
      { course_id: otherCourseId, user_id: otherTeacher.id },
    ]);
    const { data: mod } = await admin.from("course_modules").insert({ course_id: courseId, title: "M" }).select("id").single();
    const { data: lesson } = await admin.from("lessons").insert({ course_id: courseId, module_id: mod!.id, title: "Paid" }).select("id").single();
    const { data: block } = await admin
      .from("lesson_content_blocks")
      .insert({ lesson_id: lesson!.id, course_id: courseId, block_type: "rich_text", data: { html: "secret" } })
      .select("id")
      .single();
    paidBlockId = block!.id;
    await admin.from("enrollments").insert({ user_id: student.id, course_id: courseId, source: "purchase" });
    await admin.from("course_entitlements").insert({ user_id: student.id, scope: "course", course_id: courseId, source: "purchase" });

    privatePath = `courses/${courseId}/content/it-${runId}.txt`;
    await admin.storage.from("course-content").upload(privatePath, new Blob(["private"], { type: "text/plain" }));
  });

  afterAll(async () => {
    const admin = service();
    await admin.storage.from("course-content").remove([privatePath]);
    await admin.from("courses").delete().in("id", [courseId, otherCourseId]);
    await cleanupUsers();
  });

  it("lets an entitled student read paid lesson content", async () => {
    const { data } = await student.client.from("lesson_content_blocks").select("id").eq("id", paidBlockId);
    expect(data).toHaveLength(1);
  });

  it("hides paid lesson content from a student without an entitlement", async () => {
    const { data } = await other.client.from("lesson_content_blocks").select("id").eq("id", paidBlockId);
    expect(data).toHaveLength(0);
  });

  it("stops a student from granting themselves access", async () => {
    const { error } = await other.client
      .from("course_entitlements")
      .insert({ user_id: other.id, scope: "course", course_id: courseId, source: "purchase" });
    expect(error?.code).toBe("42501");
  });

  it("stops a student from reading another student's enrollments", async () => {
    const { data } = await other.client.from("enrollments").select("id").eq("user_id", student.id);
    expect(data).toHaveLength(0);
  });

  it("stops a user from assigning themselves a role", async () => {
    const { error } = await teacher.client.from("user_roles").insert({ user_id: teacher.id, role: "admin" });
    expect(error?.code).toBe("42501");
  });

  it("keeps a teacher out of another teacher's students", async () => {
    const { data } = await otherTeacher.client.from("enrollments").select("id").eq("course_id", courseId);
    expect(data).toHaveLength(0);
    const own = await teacher.client.from("enrollments").select("id").eq("course_id", courseId);
    expect(own.data).toHaveLength(1);
  });

  it("refuses direct downloads from private storage buckets", async () => {
    const { error } = await student.client.storage.from("course-content").download(privatePath);
    expect(error).not.toBeNull();
  });

  it("serves private files through short-lived signed URLs only", async () => {
    const { data } = await service().storage.from("course-content").createSignedUrl(privatePath, 30);
    const res = await fetch(data!.signedUrl);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("private");
  });

  it("never exposes integration secrets to signed-in users", async () => {
    const { error } = await student.client.from("integration_settings").select("provider");
    expect(error).not.toBeNull();
  });
});

describe.skipIf(hasSupabase)("RLS through the Supabase API", () => {
  it.skip(skipReason, () => {});
});
