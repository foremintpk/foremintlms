"use server";

import { z } from "zod";
import { assertAdmin } from "@/lib/auth/guards";
import { ok, runAction, type ActionResult } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import { PUBLIC_TAGS, refreshPublic } from "@/lib/services/admin/revalidate";

const testimonialSchema = z
  .object({
    id: z.uuid().optional(),
    person_name: z.string().trim().min(1, "Enter the person's name").max(120),
    person_role: z.string().trim().max(160).default(""),
    company: z.string().trim().max(160).default(""),
    avatar_url: z.string().trim().max(500).default(""),
    quote: z.string().trim().min(1, "Enter the testimonial").max(2000),
    rating: z.union([z.literal(""), z.coerce.number().int().min(1).max(5)]).default(""),
    category_id: z.union([z.literal(""), z.uuid()]).default(""),
    course_id: z.union([z.literal(""), z.uuid()]).default(""),
    consent_confirmed: z.boolean(),
    is_featured: z.boolean(),
    status: z.enum(["draft", "published", "archived"]),
    sort_order: z.coerce.number().int().min(0).max(10000).default(0),
  })
  .refine((t) => t.status !== "published" || t.consent_confirmed, {
    path: ["consent_confirmed"],
    message: "Confirm you have permission before publishing",
  });

export async function saveTestimonial(input: z.input<typeof testimonialSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = testimonialSchema.parse(input);
    const supabase = await createClient();
    const row = {
      person_name: data.person_name,
      person_role: data.person_role || null,
      company: data.company || null,
      avatar_url: data.avatar_url || null,
      quote: data.quote,
      rating: data.rating === "" ? null : data.rating,
      category_id: data.category_id || null,
      course_id: data.course_id || null,
      consent_confirmed: data.consent_confirmed,
      is_featured: data.is_featured,
      status: data.status,
      sort_order: data.sort_order,
    };
    if (data.id) {
      const { error } = await supabase.from("testimonials").update(row).eq("id", data.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("testimonials").insert({ ...row, created_by: user.id });
      if (error) throw error;
    }
    await audit({
      actor: user,
      action: data.id ? "testimonial.updated" : "testimonial.created",
      entityType: "testimonial",
      entityId: data.id ?? null,
      summary: data.person_name,
      metadata: { status: data.status, consent_confirmed: data.consent_confirmed },
    });
    refreshPublic(PUBLIC_TAGS.testimonials);
    return ok(null, data.id ? "Testimonial saved" : "Testimonial added");
  });
}

export async function deleteTestimonial(input: { id: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const { id } = z.object({ id: z.uuid() }).parse(input);
    const supabase = await createClient();
    const { error } = await supabase.from("testimonials").delete().eq("id", id);
    if (error) throw error;
    await audit({ actor: user, action: "testimonial.deleted", entityType: "testimonial", entityId: id });
    refreshPublic(PUBLIC_TAGS.testimonials);
    return ok(null, "Testimonial deleted");
  });
}
