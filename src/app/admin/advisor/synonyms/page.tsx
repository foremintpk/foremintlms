import type { Metadata } from "next";
import { Replace } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { AdvisorNav } from "@/components/admin/advisor/advisor-nav";
import { SynonymForm, SynonymRow } from "@/components/admin/advisor/synonym-manager";
import { requireAdmin } from "@/lib/auth/guards";
import { listSynonyms } from "@/lib/services/advisor/admin";

export const instant = false;
export const metadata: Metadata = { title: "Advisor synonyms" };

export default async function AdvisorSynonymsPage() {
  await requireAdmin("/admin/advisor/synonyms");
  const synonyms = await listSynonyms();
  return (
    <>
      <PageHeader
        title="Course advisor"
        description="Synonyms are applied to every message (and every keyword) before matching, so one keyword covers many ways of saying it — “iPhone” and “Apple” both become “ios”."
      />
      <AdvisorNav active="synonyms" />
      <section className="mb-6 rounded-2xl border bg-card p-5 shadow-card">
        <h2 className="mb-3 text-base font-semibold">Add a synonym</h2>
        <SynonymForm />
        <p className="mt-3 text-xs text-muted-foreground">Whole words or phrases only (“site” doesn&apos;t change “website”). Longer terms are replaced first.</p>
      </section>
      {synonyms.length === 0 ? (
        <EmptyState icon={Replace} title="No synonyms yet" description="Add words visitors use for the same thing, like “e-commerce” → “ecommerce”." />
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {synonyms.map((s) => (
            <SynonymRow key={s.id} synonym={{ id: s.id, term: s.term, replacement: s.replacement, is_active: s.is_active }} />
          ))}
        </ul>
      )}
    </>
  );
}
