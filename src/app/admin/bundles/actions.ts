"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/guards";
import { ok, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createGroupProduct, setProductCourses } from "@/lib/services/payments/catalog";

const createSchema = z
  .object({
    kind: z.enum(["bundle", "membership"]),
    name: z.string().trim().min(1, "Give it a name").max(200),
    description: z.string().trim().max(1500).nullable().optional(),
    grantsAllCourses: z.boolean().default(false),
    courseIds: z.array(z.uuid()).max(200).default([]),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "bundle" && v.courseIds.length < 2) ctx.addIssue({ code: "custom", path: ["courseIds"], message: "A bundle needs at least two courses" });
    if (v.kind === "membership" && !v.grantsAllCourses && v.courseIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["courseIds"], message: "Choose courses or grant access to all courses" });
    }
  });

export async function createGroupProductAction(input: z.input<typeof createSchema>): Promise<ActionResult<{ productId: string }>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const data = createSchema.parse(input);
    const product = await createGroupProduct(
      { kind: data.kind, name: data.name, description: data.description ?? null, grantsAllCourses: data.grantsAllCourses, courseIds: data.courseIds },
      actor.id,
    );
    await audit({
      actor,
      action: `${data.kind}.create`,
      entityType: "product",
      entityId: product.id,
      summary: `Created ${data.kind} ${data.name}`,
      metadata: { courses: data.courseIds, all: data.grantsAllCourses },
    });
    revalidatePath("/admin/bundles");
    revalidatePath("/admin/pricing");
    return ok({ productId: product.id }, data.kind === "bundle" ? "Bundle created" : "Membership created");
  });
}

const compositionSchema = z.object({
  productId: z.uuid(),
  grantsAllCourses: z.boolean().default(false),
  courseIds: z.array(z.uuid()).max(200),
  headline: z.string().trim().max(200).nullable().optional(),
  highlights: z.array(z.string().trim().min(1).max(160)).max(12).default([]),
});

export async function updateCompositionAction(input: z.input<typeof compositionSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await assertAdmin();
    const data = compositionSchema.parse(input);
    const admin = createAdminClient();
    const { data: product } = await admin.from("products").select("id, kind, name").eq("id", data.productId).single();
    if (!product) throw new UserFacingError("Product not found.");
    if (product.kind === "course") throw new UserFacingError("Course products always contain their own course.");
    if (product.kind === "bundle" && data.courseIds.length < 2) throw new UserFacingError("A bundle needs at least two courses.");
    const all = product.kind === "membership" && data.grantsAllCourses;
    if (product.kind === "membership" && !all && data.courseIds.length === 0) {
      throw new UserFacingError("Choose courses or grant access to all courses.");
    }
    await admin.from("products").update({ grants_all_courses: all }).eq("id", product.id);
    await setProductCourses(product.id, all ? [] : data.courseIds);
    if (product.kind === "bundle") {
      await admin
        .from("course_bundles")
        .upsert({ product_id: product.id, headline: data.headline || null, highlights: data.highlights }, { onConflict: "product_id" });
    }
    await audit({
      actor,
      action: "product.composition",
      entityType: "product",
      entityId: product.id,
      summary: `Updated courses in ${product.name}`,
      metadata: { courses: data.courseIds, all },
    });
    revalidatePath("/admin/bundles");
    revalidatePath(`/admin/bundles/${product.id}`);
    revalidatePath(`/admin/pricing/${product.id}`);
    return ok(null, "Included courses saved");
  });
}
