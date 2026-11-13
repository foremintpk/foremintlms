import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { LegalEditor, type LegalVersionRow } from "@/components/admin/legal/legal-editor";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { renderLegalBody } from "@/lib/services/admin/legal-render";

export const instant = false;
export const metadata = { title: "Edit legal page" };

export default async function LegalDocPage({ params, searchParams }: PageProps<"/admin/legal/[slug]">) {
  await requireAdmin("/admin/legal");
  const { slug } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: doc, error } = await supabase
    .from("legal_documents")
    .select("id, slug, title, current_version_id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!doc) notFound();
  const { data: versionsData, error: vErr } = await supabase
    .from("legal_document_versions")
    .select("id, version, status, body, change_summary, effective_date, published_at, created_at")
    .eq("document_id", doc.id)
    .order("version", { ascending: false });
  if (vErr) throw new Error(vErr.message);
  const versions = (versionsData ?? []) as LegalVersionRow[];
  const viewId = typeof sp.version === "string" ? sp.version : (doc.current_version_id as string | null);
  const viewed = versions.find((v) => v.id === viewId && v.status !== "draft") ?? versions.find((v) => v.status === "published") ?? null;
  const rendered = viewed ? await renderLegalBody(viewed.body) : null;

  return (
    <>
      <PageHeader title={doc.title as string} description={`Public page: /legal/${doc.slug}`} back={{ href: "/admin/legal", label: "Legal pages" }} />
      <LegalEditor
        documentId={doc.id as string}
        documentSlug={doc.slug as string}
        versions={versions}
        viewed={viewed ? { id: viewed.id, version: viewed.version, html: rendered!.html, missing: rendered!.missing } : null}
      />
    </>
  );
}
