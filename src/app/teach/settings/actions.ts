"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { assertTeacherOrAdmin } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { fail, ok, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PUBLIC_TAGS } from "@/lib/services/public/tags";

const https = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https:\/\/[^\s]+$/i.test(v), "Use a full https:// link");

const SOCIAL_KEYS = ["linkedin", "x", "youtube", "instagram", "github", "facebook", "tiktok"] as const;

const profileSchema = z.object({
  public_name: z.string().trim().min(1, "Add the name students will see").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens")
    .max(120),
  headline: z.string().trim().max(160).optional().default(""),
  bio: z.string().trim().max(8000).optional().default(""),
  avatar_url: https.optional().default(""),
  expertise: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  website_url: https.optional().default(""),
  social_links: z.partialRecord(z.enum(SOCIAL_KEYS), https).default({}),
  is_public: z.boolean(),
});

export async function updateInstructorProfileAction(input: unknown): Promise<ActionResult<{ slug: string }>> {
  return runAction(async () => {
    const user = await assertTeacherOrAdmin();
    const values = profileSchema.parse(input);
    const admin = createAdminClient();

    const { data: current } = await admin.from("teacher_profiles").select("slug, status").eq("user_id", user.id).maybeSingle();
    if (!current) throw new UserFacingError("You don't have an instructor profile yet. Ask an administrator to set one up.");

    if (values.slug !== current.slug) {
      const { data: taken } = await admin.from("teacher_profiles").select("user_id").eq("slug", values.slug).neq("user_id", user.id).maybeSingle();
      if (taken) return fail("That profile address is already taken.", { slug: ["Choose a different address"] });
    }

    const socialLinks = Object.fromEntries(Object.entries(values.social_links).filter(([, v]) => typeof v === "string" && v.length > 0));

    // The owner update runs under RLS; a trigger blocks approval/featured changes.
    const supabase = await createClient();
    const { error } = await supabase
      .from("teacher_profiles")
      .update({
        public_name: values.public_name,
        slug: values.slug,
        headline: values.headline || null,
        bio: values.bio || null,
        avatar_url: values.avatar_url || null,
        expertise: [...new Set(values.expertise)],
        website_url: values.website_url || null,
        social_links: socialLinks,
        is_public: values.is_public,
      })
      .eq("user_id", user.id);
    if (error) {
      if (error.code === "23505") return fail("That profile address is already taken.", { slug: ["Choose a different address"] });
      throw new Error(`teacher profile update failed: ${error.message}`);
    }

    await audit({
      actor: user,
      action: "teacher_profile.updated",
      entityType: "teacher_profile",
      entityId: user.id,
      metadata: { slug: values.slug, is_public: values.is_public },
    });
    updateTag(PUBLIC_TAGS.instructors);
    updateTag(PUBLIC_TAGS.courses);
    refresh();
    return ok({ slug: values.slug }, "Instructor profile saved");
  });
}
