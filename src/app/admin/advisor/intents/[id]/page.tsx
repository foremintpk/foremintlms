import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { AdvisorNav } from "@/components/admin/advisor/advisor-nav";
import { DeleteIntentButton, IntentDetailsForm, KeywordsEditor, RecommendationsEditor, TestMessageBox } from "@/components/admin/advisor/intent-editor";
import { requireAdmin } from "@/lib/auth/guards";
import { getIntentDetail } from "@/lib/services/advisor/admin";

export const instant = false;
export const metadata: Metadata = { title: "Edit advisor intent" };

export default async function AdvisorIntentPage({ params }: PageProps<"/admin/advisor/intents/[id]">) {
  const { id } = await params;
  await requireAdmin(`/admin/advisor/intents/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();
  const detail = await getIntentDetail(id);
  if (!detail) notFound();
  const { intent } = detail;
  const sample = detail.keywords.find((k) => k.match_type === "phrase")?.keyword;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/advisor/intents", label: "All intents" }}
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            {intent.title}
            <StatusBadge status={intent.is_active ? "active" : "hidden"} label={intent.is_active ? "Active" : "Disabled"} />
          </span>
        }
        description={intent.description ?? "Recognised by the keywords below; replies with the text and courses you set here."}
        actions={<DeleteIntentButton id={intent.id} title={intent.title} />}
      />
      <AdvisorNav active="intents" />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-6">
          <IntentDetailsForm
            intent={{
              id: intent.id,
              intent_key: intent.intent_key,
              title: intent.title,
              description: intent.description,
              response: intent.response,
              priority: intent.priority,
              is_active: intent.is_active,
              followUp: detail.followUp,
            }}
            intentOptions={detail.intentOptions}
          />
        </div>
        <div className="grid content-start gap-6">
          <KeywordsEditor
            intentId={intent.id}
            keywords={detail.keywords.map((k) => ({ id: k.id, keyword: k.keyword, match_type: k.match_type as "keyword" | "phrase" | "pattern", weight: Number(k.weight), is_active: k.is_active }))}
          />
          <RecommendationsEditor
            intentId={intent.id}
            courses={detail.courses}
            items={detail.recommendations.map((r) => ({
              id: r.id,
              course_id: r.course_id,
              courseTitle: r.course?.title ?? "Deleted course",
              courseStatus: r.course?.status ?? null,
              role: r.role === "supporting" ? "supporting" : "primary",
              recommendation_priority: r.recommendation_priority,
              explanation: r.explanation,
              is_active: r.is_active,
            }))}
          />
          <TestMessageBox placeholder={sample ? `I want to ${sample}` : undefined} />
        </div>
      </div>
    </>
  );
}
