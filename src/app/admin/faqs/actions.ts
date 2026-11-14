"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/guards";
import { ok, runAction, type ActionResult } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import { sanitizeRichText, stripHtml } from "@/lib/sanitize";
import { PUBLIC_TAGS, refreshPublic } from "@/lib/services/admin/revalidate";
import { ADVISOR_TAG } from "@/lib/services/advisor/knowledge";

const FAQ_CATEGORIES = ["general", "courses", "billing", "certificates", "live", "technical", "instructors"] as const;

const faqSchema = z.object({
  id: z.uuid().optional(),
  question: z.string().trim().min(1, "Enter the question").max(400),
  answer: z.string().max(20000),
  category: z.enum(FAQ_CATEGORIES),
  is_published: z.boolean(),
  show_on_home: z.boolean(),
  // Course advisor: extra words that should find this answer, whether it may answer, tie-break weight.
  keywords: z.array(z.string().trim().min(1).max(60, "Keep each keyword under 60 characters")).max(20, "Use up to 20 keywords").default([]),
  advisor_enabled: z.boolean().default(true),
  advisor_priority: z.number().int().min(0, "Use 0 to 10").max(10, "Use 0 to 10").default(0),
});

export async function saveFaq(input: z.input<typeof faqSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = faqSchema.parse(input);
    const answer = sanitizeRichText(data.answer);
    if (!stripHtml(answer)) {
      return { ok: false, error: "Check the highlighted fields.", fieldErrors: { answer: ["Write an answer"] } };
    }
    const supabase = await createClient();
    const keywords = [...new Set(data.keywords.map((k) => k.toLowerCase()))];
    const row = {
      question: data.question,
      answer,
      category: data.category,
      is_published: data.is_published,
      show_on_home: data.show_on_home,
      keywords,
      advisor_enabled: data.advisor_enabled,
      advisor_priority: data.advisor_priority,
    };
    if (data.id) {
      const { error } = await supabase.from("faqs").update(row).eq("id", data.id);
      if (error) throw error;
    } else {
      const { data: last } = await supabase.from("faqs").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
      const { error } = await supabase.from("faqs").insert({ ...row, sort_order: (last?.sort_order ?? 0) + 1 });
      if (error) throw error;
    }
    await audit({ actor: user, action: data.id ? "faq.updated" : "faq.created", entityType: "faq", entityId: data.id ?? null, summary: data.question });
    refreshPublic(PUBLIC_TAGS.faqs);
    updateTag(ADVISOR_TAG);
    return ok(null, data.id ? "FAQ saved" : "FAQ added");
  });
}

export async function deleteFaq(input: { id: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const { id } = z.object({ id: z.uuid() }).parse(input);
    const supabase = await createClient();
    const { error } = await supabase.from("faqs").delete().eq("id", id);
    if (error) throw error;
    await audit({ actor: user, action: "faq.deleted", entityType: "faq", entityId: id });
    refreshPublic(PUBLIC_TAGS.faqs);
    updateTag(ADVISOR_TAG);
    return ok(null, "FAQ deleted");
  });
}

export async function reorderFaqs(input: { ids: string[] }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const { ids } = z.object({ ids: z.array(z.uuid()).min(1).max(500) }).parse(input);
    const supabase = await createClient();
    // Positions are global; each category's list keeps its relative order.
    const { data: all } = await supabase.from("faqs").select("id, sort_order").in("id", ids);
    const slots = ((all ?? []) as { id: string; sort_order: number }[]).map((r) => r.sort_order).sort((a, b) => a - b);
    const results = await Promise.all(ids.map((id, i) => supabase.from("faqs").update({ sort_order: slots[i] ?? i + 1 }).eq("id", id)));
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
    await audit({ actor: user, action: "faq.reordered", entityType: "faq", summary: `${ids.length} FAQs reordered` });
    refreshPublic(PUBLIC_TAGS.faqs);
    return ok(null, "Order saved");
  });
}
