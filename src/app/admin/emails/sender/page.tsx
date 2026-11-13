import Link from "next/link";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { requireAdmin } from "@/lib/auth/guards";
import { appUrl } from "@/lib/env";
import { getSetting } from "@/lib/settings";
import { getIntegration } from "@/lib/services/integrations";
import { getResendClient, getSenderConfig } from "@/lib/services/email/resend";
import { EmailsNav } from "../_components/emails-nav";
import { ConnectionTest, SenderForm } from "../_components/sender-form";

export const instant = false;

export const metadata = { title: "Email sender & delivery" };

export default async function EmailSenderPage() {
  await requireAdmin("/admin/emails/sender");
  const [senderName, fromAddress, replyTo, client, sender, resend] = await Promise.all([
    getSetting<string>("email.sender_name", "Foremint Academy"),
    getSetting<string>("email.from_address", ""),
    getSetting<string>("email.reply_to", ""),
    getResendClient(),
    getSenderConfig(),
    getIntegration("resend"),
  ]);

  return (
    <>
      <PageHeader title="Sender & delivery" description="Who emails come from, and whether the email provider is connected." />
      <EmailsNav active="sender" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <section className="rounded-2xl border bg-card p-5 shadow-card sm:p-6">
          <h2 className="mb-4 text-base font-semibold">Sender identity</h2>
          <SenderForm initial={{ senderName, fromAddress, replyTo }} />
        </section>
        <aside className="grid content-start gap-4">
          <section className="grid gap-3 rounded-2xl border bg-card p-5 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Resend</h2>
              <StatusBadge status={client && sender.from ? "connected" : client ? "configured" : "not_configured"} label={client && sender.from ? "Ready" : client ? "Needs a sending address" : "Not connected"} />
            </div>
            <dl className="grid gap-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Sending as</dt>
                <dd className="break-all">{sender.from ?? "No address configured"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Reply-to</dt>
                <dd className="break-all">{sender.replyTo ?? "Not set"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Delivery webhook</dt>
                <dd>{resend.webhookSecret ? "Signing secret configured" : "Not configured — delivery events won't be recorded"}</dd>
              </div>
            </dl>
            <ConnectionTest />
          </section>
          <section className="grid gap-2 rounded-2xl border bg-card p-5 text-sm shadow-card">
            <h2 className="text-base font-semibold">Setup checklist</h2>
            <ol className="grid list-decimal gap-1.5 pl-5 text-muted-foreground">
              <li>Add and verify your sending domain in Resend (SPF, DKIM and a DMARC record).</li>
              <li>
                Add <code className="rounded bg-muted px-1 text-xs">RESEND_API_KEY</code> and <code className="rounded bg-muted px-1 text-xs">EMAIL_FROM</code> to the
                environment, or enter them in <Link href="/admin/integrations" className="font-medium text-primary hover:underline">Integrations</Link>.
              </li>
              <li>
                Create a Resend webhook to <code className="rounded bg-muted px-1 text-xs break-all">{appUrl("/api/webhooks/resend")}</code> and save its signing
                secret as <code className="rounded bg-muted px-1 text-xs">RESEND_WEBHOOK_SECRET</code>.
              </li>
            </ol>
          </section>
        </aside>
      </div>
    </>
  );
}
