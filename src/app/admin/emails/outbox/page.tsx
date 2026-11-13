import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ListToolbar } from "@/components/common/list-toolbar";
import { LocalTime } from "@/components/common/local-time";
import { PaginationBar } from "@/components/common/pagination-bar";
import { StatusBadge } from "@/components/common/status-badge";
import { requireAdmin } from "@/lib/auth/guards";
import { escapeLike, parseListParams } from "@/lib/list-params";
import { createClient } from "@/lib/supabase/server";
import { redactPayload } from "@/lib/services/email/templates";
import { EmailsNav } from "../_components/emails-nav";
import { OutboxActions } from "../_components/outbox-actions";

export const instant = false;

export const metadata = { title: "Email outbox" };

interface OutboxRow {
  id: string;
  template_key: string;
  to_email: string;
  status: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
  next_attempt_at: string;
  provider_message_id: string | null;
  payload: Record<string, unknown> | null;
}

interface DeliveryEventRow {
  outbox_id: string | null;
  event_type: string;
  occurred_at: string;
}

const STATUSES = ["pending", "sending", "sent", "failed", "skipped", "cancelled"];

export default async function EmailOutboxPage({ searchParams }: PageProps<"/admin/emails/outbox">) {
  await requireAdmin("/admin/emails/outbox");
  const raw = await searchParams;
  const params = parseListParams(raw, { pageSize: 25, filterKeys: ["status", "template"] });
  const supabase = await createClient();

  let query = supabase
    .from("email_outbox")
    .select("id, template_key, to_email, status, attempts, max_attempts, last_error, created_at, sent_at, next_attempt_at, provider_message_id, payload", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(params.from, params.to);
  if (params.filters.status) query = query.eq("status", params.filters.status);
  if (params.filters.template) query = query.eq("template_key", params.filters.template);
  if (params.q) query = query.ilike("to_email", `%${escapeLike(params.q)}%`);

  const [{ data, count, error }, templatesRes, counts] = await Promise.all([
    query,
    supabase.from("email_templates").select("key, name").order("key"),
    Promise.all(
      ["pending", "failed"].map((s) =>
        supabase.from("email_outbox").select("id", { count: "exact", head: true }).eq("status", s).then((r) => [s, r.count ?? 0] as const),
      ),
    ),
  ]);
  if (error) throw new Error(`Could not load the outbox: ${error.message}`);
  const rows = (data ?? []) as OutboxRow[];

  const ids = rows.map((r) => r.id);
  const { data: eventsData } = ids.length
    ? await supabase.from("email_delivery_events").select("outbox_id, event_type, occurred_at").in("outbox_id", ids).order("occurred_at")
    : { data: [] };
  const events = new Map<string, DeliveryEventRow[]>();
  for (const e of (eventsData ?? []) as DeliveryEventRow[]) {
    if (!e.outbox_id) continue;
    events.set(e.outbox_id, [...(events.get(e.outbox_id) ?? []), e]);
  }
  const summary = Object.fromEntries(counts);

  return (
    <>
      <PageHeader
        title="Email outbox"
        description={`Every transactional email, with retries and delivery events. ${summary.pending ?? 0} queued · ${summary.failed ?? 0} failed.`}
      />
      <EmailsNav active="outbox" />
      <ListToolbar
        searchPlaceholder="Search by recipient"
        filters={[
          { key: "status", label: "Statuses", options: STATUSES.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) })) },
          {
            key: "template",
            label: "Templates",
            options: ((templatesRes.data ?? []) as { key: string; name: string }[]).map((t) => ({ value: t.key, label: t.name })),
          },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={params.q || Object.keys(params.filters).length ? "No emails match these filters" : "No emails yet"}
          description="Emails appear here as soon as the platform queues them — sign-ups, receipts, reminders and more."
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-card">
          {rows.map((row) => {
            const rowEvents = events.get(row.id) ?? [];
            const latest = rowEvents.at(-1);
            return (
              <li key={row.id}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{row.to_email}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{row.template_key}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      <LocalTime value={row.created_at} format="datetime" />
                    </span>
                    {latest ? <StatusBadge status="info" tone="info" label={latest.event_type.replace("email.", "")} /> : null}
                    <StatusBadge status={row.status} />
                  </summary>
                  <div className="grid gap-3 border-t bg-muted/20 px-4 py-4 text-sm">
                    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <dt className="text-xs text-muted-foreground">Attempts</dt>
                        <dd>
                          {row.attempts} of {row.max_attempts}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">{row.sent_at ? "Sent" : "Next attempt"}</dt>
                        <dd>
                          <LocalTime value={row.sent_at ?? row.next_attempt_at} format="datetime" />
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-xs text-muted-foreground">Resend message ID</dt>
                        <dd className="truncate font-mono text-xs">{row.provider_message_id ?? "—"}</dd>
                      </div>
                    </dl>
                    {row.last_error ? (
                      <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-destructive">{row.last_error}</p>
                    ) : null}
                    {rowEvents.length ? (
                      <div>
                        <p className="mb-1 text-xs text-muted-foreground">Delivery events</p>
                        <ul className="grid gap-1">
                          {rowEvents.map((e, i) => (
                            <li key={i} className="flex gap-3 text-xs">
                              <span className="font-medium">{e.event_type.replace("email.", "")}</span>
                              <LocalTime value={e.occurred_at} format="datetime" className="text-muted-foreground" />
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">Data</p>
                      <pre className="max-h-48 overflow-auto rounded-lg border bg-background p-3 font-mono text-xs">
                        {JSON.stringify(redactPayload(row.template_key, row.payload ?? {}), null, 2)}
                      </pre>
                    </div>
                    <OutboxActions id={row.id} status={row.status} />
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
      <PaginationBar basePath="/admin/emails/outbox" searchParams={raw} page={params.page} pageSize={params.pageSize} total={count ?? 0} />
    </>
  );
}
