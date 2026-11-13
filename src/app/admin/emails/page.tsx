import Link from "next/link";
import { AlertTriangle, ChevronRight, Lock } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { LocalTime } from "@/components/common/local-time";
import { StatusBadge } from "@/components/common/status-badge";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getResendClient, getSenderConfig } from "@/lib/services/email/resend";
import { CATEGORY_LABELS, EmailsNav } from "./_components/emails-nav";

export const instant = false;

export const metadata = { title: "Email templates" };

interface TemplateRow {
  key: string;
  name: string;
  description: string | null;
  category: string;
  subject: string;
  is_enabled: boolean;
  is_required: boolean;
  updated_at: string;
}

export default async function EmailTemplatesPage() {
  await requireAdmin("/admin/emails");
  const supabase = await createClient();
  const [{ data, error }, client, sender] = await Promise.all([
    supabase.from("email_templates").select("key, name, description, category, subject, is_enabled, is_required, updated_at").order("key"),
    getResendClient(),
    getSenderConfig(),
  ]);
  if (error) throw new Error(`Could not load templates: ${error.message}`);
  const templates = (data ?? []) as TemplateRow[];
  const groups = Object.keys(CATEGORY_LABELS)
    .map((category) => ({ category, items: templates.filter((t) => t.category === category) }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      <PageHeader title="Email templates" description="Edit the wording of every transactional email. The branded layout, logo and footer are applied automatically." />
      <EmailsNav active="templates" />
      {!client || !sender.from ? (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            Emails are being queued but not sent: {!client ? "Resend isn't connected" : "no sending address is set"}.{" "}
            <Link href="/admin/emails/sender" className="font-semibold underline underline-offset-4">
              Set up delivery
            </Link>
          </p>
        </div>
      ) : null}
      <div className="grid gap-8">
        {groups.map((group) => (
          <section key={group.category} aria-labelledby={`cat-${group.category}`}>
            <h2 id={`cat-${group.category}`} className="mb-3 text-base font-semibold">
              {CATEGORY_LABELS[group.category]}
            </h2>
            <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-card">
              {group.items.map((t) => (
                <li key={t.key}>
                  <Link
                    href={`/admin/emails/${encodeURIComponent(t.key)}`}
                    className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        {t.name}
                        {t.is_required ? <Lock className="size-3.5 text-muted-foreground" aria-label="Always sent" /> : null}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">{t.subject}</p>
                    </div>
                    <div className="hidden text-right text-xs text-muted-foreground sm:block">
                      Updated <LocalTime value={t.updated_at} format="date" />
                    </div>
                    <StatusBadge status={t.is_enabled ? "active" : "hidden"} label={t.is_required ? "Always on" : t.is_enabled ? "On" : "Off"} />
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
