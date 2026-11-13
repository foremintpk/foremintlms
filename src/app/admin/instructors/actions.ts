"use server";

import { z } from "zod";
import { assertAdmin } from "@/lib/auth/guards";
import { fail, ok, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import { createTeacherInvitation, resendInvitation, revokeInvitation } from "@/lib/services/invitations";
import { notify } from "@/lib/services/notifications";
import { appUrl } from "@/lib/env";
import { slugify } from "@/lib/format";
import { PUBLIC_TAGS, refreshPublic } from "@/lib/services/admin/revalidate";

const inviteSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  fullName: z.string().trim().max(120).default(""),
  message: z.string().trim().max(1000).default(""),
  courseIds: z.array(z.uuid()).max(50).default([]),
  role: z.enum(["teacher", "admin"]).default("teacher"),
});

export async function inviteInstructor(input: z.input<typeof inviteSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = inviteSchema.parse(input);
    await createTeacherInvitation(user, {
      email: data.email,
      fullName: data.fullName || undefined,
      message: data.message || undefined,
      courseIds: data.courseIds,
      role: data.role,
    });
    return ok(null, `Invitation sent to ${data.email}`);
  });
}

export async function resendInvite(input: { id: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const { id } = z.object({ id: z.uuid() }).parse(input);
    await resendInvitation(user, id);
    return ok(null, "Invitation resent");
  });
}

export async function revokeInvite(input: { id: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const { id } = z.object({ id: z.uuid() }).parse(input);
    await revokeInvitation(user, id);
    return ok(null, "Invitation revoked");
  });
}

export async function approveInstructor(input: { userId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const { userId } = z.object({ userId: z.uuid() }).parse(input);
    const supabase = await createClient();
    const { data: tp } = await supabase.from("teacher_profiles").select("status, public_name").eq("user_id", userId).maybeSingle();
    if (!tp) throw new UserFacingError("This person has no instructor profile yet.");
    const { error } = await supabase
      .from("teacher_profiles")
      .update({ status: "approved", approved_by: user.id, approved_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) throw error;
    const { data: role } = await supabase.from("user_roles").select("id").eq("user_id", userId).eq("role", "teacher").maybeSingle();
    if (!role) {
      const { error: roleError } = await supabase.from("user_roles").insert({ user_id: userId, role: "teacher", granted_by: user.id });
      if (roleError) throw roleError;
    }
    await notify(userId, {
      category: "system",
      type: "teacher_approved",
      title: "Your instructor account is approved",
      body: "You can now manage your assigned courses.",
      url: "/teach",
      email: { templateKey: "system.teacher_approved", idempotencyKey: `teacher-approved:${userId}:${Date.now()}`, payload: { cta_url: appUrl("/teach") } },
    });
    await audit({ actor: user, action: "instructor.approved", entityType: "teacher_profile", entityId: userId, summary: tp.public_name as string });
    refreshPublic(PUBLIC_TAGS.instructors, PUBLIC_TAGS.courses);
    return ok(null, "Instructor approved");
  });
}

export async function suspendTeaching(input: { userId: string; reason?: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = z.object({ userId: z.uuid(), reason: z.string().trim().min(3, "Give a reason").max(1000) }).parse(input);
    const supabase = await createClient();
    const { error } = await supabase.from("teacher_profiles").update({ status: "suspended" }).eq("user_id", data.userId);
    if (error) throw error;
    await audit({ actor: user, action: "instructor.teaching_suspended", entityType: "teacher_profile", entityId: data.userId, summary: data.reason, metadata: { reason: data.reason } });
    refreshPublic(PUBLIC_TAGS.instructors, PUBLIC_TAGS.courses);
    return ok(null, "Teaching access suspended");
  });
}

const profileSchema = z.object({
  userId: z.uuid(),
  public_name: z.string().trim().min(1, "Enter a public name").max(120),
  slug: z.string().trim().max(120),
  headline: z.string().trim().max(160).default(""),
  bio: z.string().trim().max(8000).default(""),
  avatar_url: z.string().trim().max(500).default(""),
  expertise: z.string().max(600).default(""),
  website_url: z.union([z.literal(""), z.url({ protocol: /^https?$/, message: "Use a full web address" })]).default(""),
  linkedin: z.union([z.literal(""), z.url({ protocol: /^https$/, message: "Use an https:// link" })]).default(""),
  x: z.union([z.literal(""), z.url({ protocol: /^https$/, message: "Use an https:// link" })]).default(""),
  youtube: z.union([z.literal(""), z.url({ protocol: /^https$/, message: "Use an https:// link" })]).default(""),
  is_public: z.boolean(),
  is_featured: z.boolean(),
  can_create_courses: z.boolean(),
  sort_order: z.coerce.number().int().min(0).max(10000),
});

export async function saveInstructorProfile(input: z.input<typeof profileSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = profileSchema.parse(input);
    const slug = slugify(data.slug || data.public_name);
    if (!slug) return fail("Check the highlighted fields.", { slug: ["Enter a slug using letters and numbers"] });
    const supabase = await createClient();
    const socials = Object.fromEntries(
      (["linkedin", "x", "youtube"] as const).filter((k) => data[k]).map((k) => [k, data[k]]),
    );
    const { error } = await supabase
      .from("teacher_profiles")
      .update({
        public_name: data.public_name,
        slug,
        headline: data.headline || null,
        bio: data.bio || null,
        avatar_url: data.avatar_url || null,
        expertise: [...new Set(data.expertise.split(",").map((e) => e.trim()).filter(Boolean))].slice(0, 15),
        website_url: data.website_url || null,
        social_links: socials,
        is_public: data.is_public,
        is_featured: data.is_featured,
        can_create_courses: data.can_create_courses,
        sort_order: data.sort_order,
      })
      .eq("user_id", data.userId);
    if (error) throw error.code === "23505" ? new UserFacingError("Another instructor already uses this slug.") : error;
    await audit({
      actor: user,
      action: "instructor.profile_updated",
      entityType: "teacher_profile",
      entityId: data.userId,
      summary: data.public_name,
      metadata: { is_public: data.is_public, is_featured: data.is_featured, can_create_courses: data.can_create_courses },
    });
    refreshPublic(PUBLIC_TAGS.instructors, PUBLIC_TAGS.courses);
    return ok(null, "Instructor profile saved");
  });
}

export async function assignCourse(input: { userId: string; courseId: string; role: "lead" | "assistant"; canEdit: boolean }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = z
      .object({ userId: z.uuid(), courseId: z.uuid(), role: z.enum(["lead", "assistant"]), canEdit: z.boolean() })
      .parse(input);
    const supabase = await createClient();
    const { error } = await supabase
      .from("course_instructors")
      .upsert({ course_id: data.courseId, user_id: data.userId, role: data.role, can_edit: data.canEdit }, { onConflict: "course_id,user_id" });
    if (error) throw error;
    await audit({ actor: user, action: "instructor.course_assigned", entityType: "course", entityId: data.courseId, metadata: { userId: data.userId, role: data.role, canEdit: data.canEdit } });
    refreshPublic(PUBLIC_TAGS.instructors, PUBLIC_TAGS.courses);
    return ok(null, "Course assignment saved");
  });
}

export async function unassignCourse(input: { userId: string; courseId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = z.object({ userId: z.uuid(), courseId: z.uuid() }).parse(input);
    const supabase = await createClient();
    const { error } = await supabase.from("course_instructors").delete().eq("course_id", data.courseId).eq("user_id", data.userId);
    if (error) throw error;
    await audit({ actor: user, action: "instructor.course_unassigned", entityType: "course", entityId: data.courseId, metadata: { userId: data.userId } });
    refreshPublic(PUBLIC_TAGS.instructors, PUBLIC_TAGS.courses);
    return ok(null, "Removed from course");
  });
}
