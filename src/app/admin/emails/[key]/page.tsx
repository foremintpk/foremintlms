import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { variablesFor } from "@/lib/services/email/templates";
import { CATEGORY_LABELS } from "../_components/emails-nav";
import { TemplateEditor } from "../_components/template-editor";

export const instant = false;

export const metadata = { title: "Edit email template" };

export default async function EditEmailTemplatePage({ params }: PageProps<"/admin/emails/[key]">) {
  await requireAdmin("/admin/emails");
  const { key: rawKey } = await params;
  const key = decodeURIComponent(rawKey);
  if (!/^[a-z0-9_.]+$/.test(key)) notFound();

  const supabase = await createClient();
  const { data } = await supabase
    .from("email_templates")
    .select("key, name, description, category, subject, preheader, heading, body, cta_label, is_enabled, is_required")
    .eq("key", key)
    .maybeSingle();
  if (!data) notFound();
  const t = data as {
    key: string;
    name: string;
    description: string | null;
    category: string;
    subject: string;
    preheader: string | null;
    heading: string;
    body: string;
    cta_label: string | null;
    is_enabled: boolean;
    is_required: boolean;
  };

  return (
    <>
      <PageHeader
        title={t.name}
        description={t.description ?? `${CATEGORY_LABELS[t.category] ?? "Email"} · ${t.key}`}
        back={{ href: "/admin/emails", label: "All templates" }}
        actions={t.is_required ? <StatusBadge status="active" label="Always sent" tone="brand" /> : null}
      />
      <TemplateEditor
        initial={{
          key: t.key,
          subject: t.subject,
          preheader: t.preheader ?? "",
          heading: t.heading,
          body: t.body,
          ctaLabel: t.cta_label ?? "",
          isEnabled: t.is_enabled,
          isRequired: t.is_required,
        }}
        variables={variablesFor(t.key).map(({ name, description }) => ({ name, description }))}
      />
    </>
  );
}
