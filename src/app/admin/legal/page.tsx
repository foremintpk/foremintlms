import Link from "next/link";
import { AlertTriangle, Scale } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { getPublicSettings } from "@/lib/settings";

export const instant = false;
export const metadata = { title: "Legal pages" };

interface DocRow {
  id: string;
  slug: string;
  title: string;
  current_version_id: string | null;
  legal_document_versions: { id: string; version: number; status: string; effective_date: string; published_at: string | null }[];
}

export default async function LegalAdminPage() {
  await requireAdmin("/admin/legal");
  const supabase = await createClient();
  const [{ data, error }, settings] = await Promise.all([
    supabase
      .from("legal_documents")
      .select("id, slug, title, current_version_id, legal_document_versions!legal_document_versions_document_id_fkey(id, version, status, effective_date, published_at)")
      .order("slug"),
    getPublicSettings(),
  ]);
  if (error) throw new Error(error.message);
  const docs = (data ?? []) as unknown as DocRow[];
  const missingEntity = [
    !settings.legalEntityName && "legal entity name",
    !settings.businessAddress && "business address",
    !settings.jurisdiction && "governing law / jurisdiction",
    !settings.supportEmail && "support email",
  ].filter(Boolean) as string[];

  return (
    <>
      <PageHeader title="Legal pages" description="Terms, privacy, refund and cookie policies, with full version history." />
      <div className="mb-6 rounded-2xl border border-warning/30 bg-warning-soft p-4 text-sm text-warning">
        <p className="flex items-start gap-2 font-medium">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          These documents are drafts prepared for legal review.
        </p>
        <p className="mt-1 pl-6">
          Have a qualified lawyer review them against your operating entity, Whop’s terms and the consumer laws of every country you sell to before relying on them.
        </p>
        {missingEntity.length ? (
          <p className="mt-2 pl-6">
            Still missing: {missingEntity.join(", ")}.{" "}
            <Link href="/admin/settings#legal" className="font-semibold underline underline-offset-4">
              Add legal entity details
            </Link>
          </p>
        ) : null}
      </div>
      {docs.length === 0 ? (
        <EmptyState icon={Scale} title="No legal documents" description="The legal seed migration hasn't been applied." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {docs.map((d) => {
            const current = d.legal_document_versions.find((v) => v.id === d.current_version_id);
            const draft = d.legal_document_versions.find((v) => v.status === "draft");
            return (
              <li key={d.id}>
                <Link
                  href={`/admin/legal/${d.slug}`}
                  className="flex h-full flex-col gap-3 rounded-2xl border bg-card p-5 shadow-card transition-colors hover:border-primary/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-semibold">{d.title}</h2>
                    {draft ? <StatusBadge status="draft" label={`Draft v${draft.version}`} /> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {current
                      ? `Version ${current.version} · effective ${formatDate(current.effective_date)}${current.published_at ? ` · published ${formatDate(current.published_at)}` : ""}`
                      : "Not published yet"}
                  </p>
                  <p className="text-xs text-muted-foreground">/legal/{d.slug} · {d.legal_document_versions.length} version{d.legal_document_versions.length === 1 ? "" : "s"}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
