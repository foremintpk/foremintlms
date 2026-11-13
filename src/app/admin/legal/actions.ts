"use server";

import { z } from "zod";
import { assertAdmin } from "@/lib/auth/guards";
import { ok, runAction, UserFacingError, type ActionResult } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import { sanitizeRichText, stripHtml } from "@/lib/sanitize";
import { hasOpenDraft, nextVersionNumber, planPublish, type LegalVersionLike } from "@/lib/services/admin/legal";
import { renderLegalBody } from "@/lib/services/admin/legal-render";
import { PUBLIC_TAGS, refreshPublic } from "@/lib/services/admin/revalidate";

async function loadVersions(documentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("legal_document_versions")
    .select("id, version, status, body")
    .eq("document_id", documentId)
    .order("version", { ascending: false });
  if (error) throw error;
  return (data ?? []) as (LegalVersionLike & { body: string })[];
}

export async function createLegalDraft(input: { documentId: string }): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const { documentId } = z.object({ documentId: z.uuid() }).parse(input);
    const versions = await loadVersions(documentId);
    if (hasOpenDraft(versions)) throw new UserFacingError("There is already a draft. Edit or delete it first.");
    const base = versions.find((v) => v.status === "published") ?? versions[0];
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("legal_document_versions")
      .insert({
        document_id: documentId,
        version: nextVersionNumber(versions),
        body: base?.body ?? "",
        status: "draft",
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) throw error;
    await audit({ actor: user, action: "legal.draft_created", entityType: "legal_document", entityId: documentId, metadata: { versionId: data.id } });
    return ok({ id: data.id as string }, "Draft created");
  });
}

const draftSchema = z.object({
  versionId: z.uuid(),
  body: z.string().max(400000),
  change_summary: z.string().trim().max(1000).default(""),
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose an effective date"),
});

export async function saveLegalDraft(input: z.input<typeof draftSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = draftSchema.parse(input);
    const supabase = await createClient();
    const { data: row } = await supabase.from("legal_document_versions").select("status, document_id").eq("id", data.versionId).maybeSingle();
    if (!row) throw new UserFacingError("This version no longer exists.");
    if (row.status !== "draft") throw new UserFacingError("Published versions can't be edited. Create a new draft instead.");
    const body = sanitizeRichText(data.body);
    if (!stripHtml(body)) throw new UserFacingError("The document is empty.");
    const { error } = await supabase
      .from("legal_document_versions")
      .update({ body, change_summary: data.change_summary || null, effective_date: data.effective_date })
      .eq("id", data.versionId);
    if (error) throw error;
    await audit({ actor: user, action: "legal.draft_saved", entityType: "legal_document", entityId: row.document_id as string, metadata: { versionId: data.versionId } });
    return ok(null, "Draft saved");
  });
}

export async function previewLegal(input: { body: string }): Promise<ActionResult<{ html: string; missing: string[] }>> {
  return runAction(async () => {
    await assertAdmin();
    const { body } = z.object({ body: z.string().max(400000) }).parse(input);
    return ok(await renderLegalBody(sanitizeRichText(body)));
  });
}

export async function publishLegalVersion(input: { versionId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const { versionId } = z.object({ versionId: z.uuid() }).parse(input);
    const supabase = await createClient();
    const { data: row } = await supabase
      .from("legal_document_versions")
      .select("document_id, version, change_summary, body, legal_documents!legal_document_versions_document_id_fkey(slug, title)")
      .eq("id", versionId)
      .maybeSingle();
    if (!row) throw new UserFacingError("This version no longer exists.");
    if (!stripHtml(row.body as string)) throw new UserFacingError("The document is empty.");
    const documentId = row.document_id as string;
    const versions = await loadVersions(documentId);
    let plan;
    try {
      plan = planPublish(versions, versionId);
    } catch (err) {
      throw new UserFacingError((err as Error).message);
    }
    if (plan.supersedeIds.length) {
      const { error } = await supabase.from("legal_document_versions").update({ status: "superseded" }).in("id", plan.supersedeIds);
      if (error) throw error;
    }
    const { error: pubError } = await supabase
      .from("legal_document_versions")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", plan.publishId);
    if (pubError) throw pubError;
    const { error: docError } = await supabase.from("legal_documents").update({ current_version_id: plan.publishId }).eq("id", documentId);
    if (docError) throw docError;
    const doc = (Array.isArray(row.legal_documents) ? row.legal_documents[0] : row.legal_documents) as { slug: string; title: string } | null;
    await audit({
      actor: user,
      action: "legal.published",
      entityType: "legal_document",
      entityId: documentId,
      summary: `${doc?.title ?? "Legal document"} version ${row.version}`,
      metadata: { versionId, superseded: plan.supersedeIds, changeSummary: row.change_summary },
    });
    refreshPublic(PUBLIC_TAGS.legal, `legal:${doc?.slug ?? ""}`);
    return ok(null, `Version ${row.version} published`);
  });
}

export async function deleteLegalDraft(input: { versionId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const { versionId } = z.object({ versionId: z.uuid() }).parse(input);
    const supabase = await createClient();
    const { data: row } = await supabase.from("legal_document_versions").select("status, document_id").eq("id", versionId).maybeSingle();
    if (!row) throw new UserFacingError("This version no longer exists.");
    if (row.status !== "draft") throw new UserFacingError("Only drafts can be deleted; published versions are kept as history.");
    const { error } = await supabase.from("legal_document_versions").delete().eq("id", versionId);
    if (error) throw error;
    await audit({ actor: user, action: "legal.draft_deleted", entityType: "legal_document", entityId: row.document_id as string, metadata: { versionId } });
    return ok(null, "Draft deleted");
  });
}
