import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/app-shell/page-header";
import { LocalTime } from "@/components/common/local-time";
import { StatusBadge } from "@/components/common/status-badge";
import { AdvisorNav } from "@/components/admin/advisor/advisor-nav";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth/guards";
import { getSessionDetail, intentTitles } from "@/lib/services/advisor/admin";

export const instant = false;
export const metadata: Metadata = { title: "Advisor conversation" };

const EVENT_LABEL: Record<string, string> = {
  cart_add: "Added to package",
  cart_remove: "Removed from package",
  coupon_applied: "Coupon applied",
  coupon_rejected: "Coupon rejected",
  order_created: "Payment link created",
  checkout_opened: "Opened checkout",
};

export default async function AdvisorConversationPage({ params }: PageProps<"/admin/advisor/conversations/[id]">) {
  const { id } = await params;
  await requireAdmin(`/admin/advisor/conversations/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();
  const [detail, titles] = await Promise.all([getSessionDetail(id), intentTitles()]);
  if (!detail) notFound();
  const { session, messages, order } = detail;
  const label = (key: string | null) => (!key ? null : key === "fallback" ? "No match (fallback)" : key === "faq" ? "FAQ" : key === "command" ? "Built-in step" : titles.get(key) ?? key);

  return (
    <>
      <PageHeader
        back={{ href: "/admin/advisor/conversations", label: "All conversations" }}
        title="Conversation"
        description={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              Started <LocalTime value={session.started_at} />
            </span>
            <StatusBadge status={session.session_status === "limited" ? "pending" : session.session_status} label={session.session_status === "limited" ? "Limit reached" : undefined} />
            <span>
              {session.message_count} messages · {session.fallback_count} fallbacks
            </span>
            {order ? (
              <Link href={`/admin/orders/${order.id}`} className="font-mono text-primary hover:underline">
                {order.order_number}
              </Link>
            ) : null}
          </span>
        }
      />
      <AdvisorNav active="conversations" />

      {messages.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">No messages were logged for this conversation.</p>
      ) : (
        <ol className="grid max-w-3xl gap-3">
          {messages.map((m) =>
            m.message_role === "event" ? (
              <li key={m.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/50 px-4 py-2.5 text-sm">
                <Badge variant="secondary">{EVENT_LABEL[m.event_type ?? ""] ?? m.event_type}</Badge>
                {m.eventCourses.length ? <span>{m.eventCourses.join(", ")}</span> : null}
                {m.orderNumber && m.order_id ? (
                  <Link href={`/admin/orders/${m.order_id}`} className="font-mono text-xs text-primary hover:underline">
                    {m.orderNumber}
                  </Link>
                ) : null}
                <span className="ml-auto text-xs text-muted-foreground">
                  <LocalTime value={m.created_at} format="time" />
                </span>
              </li>
            ) : (
              <li key={m.id} className="rounded-2xl border bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium">“{m.content ?? "—"}”</p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    <LocalTime value={m.created_at} format="time" />
                  </span>
                </div>
                <dl className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <div>
                    <dt className="inline">Matched: </dt>
                    <dd className={m.matched_intent === "fallback" ? "inline font-medium text-warning" : "inline font-medium text-foreground"}>{label(m.matched_intent) ?? "—"}</dd>
                    {m.confidence !== null ? <span> · score {Number(m.confidence)}</span> : null}
                  </div>
                  {m.faqQuestion ? (
                    <div>
                      <dt className="inline">FAQ: </dt>
                      <dd className="inline text-foreground">{m.faqQuestion}</dd>
                    </div>
                  ) : null}
                  {m.recommended.length ? (
                    <div className="sm:col-span-2">
                      <dt className="inline">Recommended: </dt>
                      <dd className="inline text-foreground">{m.recommended.join(", ")}</dd>
                    </div>
                  ) : null}
                </dl>
              </li>
            ),
          )}
        </ol>
      )}
    </>
  );
}
