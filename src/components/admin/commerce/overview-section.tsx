import Link from "next/link";
import { Bot, ClipboardList, MailCheck, ShieldAlert, ShoppingBag } from "lucide-react";
import { SectionHeader } from "@/components/app-shell/page-header";
import { StatCard } from "@/components/common/stat-card";
import { LocalTime } from "@/components/common/local-time";
import { StatusBadge } from "@/components/common/status-badge";
import { createAdminClient } from "@/lib/supabase/admin";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/domain/commerce";
import { formatMinor } from "@/lib/domain/invoicing";
import { formatNumber } from "@/lib/format";
import { getSelectorSettings } from "@/lib/services/commerce/settings";

const STATUS_TONE: Partial<Record<OrderStatus, "success" | "warning" | "danger" | "info" | "neutral" | "brand">> = {
  fulfilled: "success",
  paid: "success",
  pending_payment: "warning",
  payment_processing: "info",
  fulfillment_pending: "warning",
  under_review: "danger",
  failed: "danger",
  refunded: "neutral",
  expired: "neutral",
  cancelled: "neutral",
};

/**
 * Admin overview: course-package orders (direct checkout and the course
 * advisor chatbot) and advisor conversations for the selected period.
 */
export async function CoursePackagesOverview({ from, to }: { from: Date; to: Date }) {
  const admin = createAdminClient();
  const settings = await getSelectorSettings();
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const [{ data: orders }, { count: sessions }, { data: recent }, { count: awaiting }, { count: review }] = await Promise.all([
    admin.from("public_course_orders").select("source, paid_at, total_minor, currency, status").gte("created_at", fromIso).lte("created_at", toIso).limit(5000),
    admin.from("course_advisor_conversation_sessions").select("id", { count: "exact", head: true }).gte("started_at", fromIso).lte("started_at", toIso),
    admin
      .from("public_course_orders")
      .select("id, order_number, learner_email, source, status, total_minor, currency, created_at, public_course_order_items(count)")
      .order("created_at", { ascending: false })
      .limit(6),
    admin.from("public_course_orders").select("id", { count: "exact", head: true }).eq("fulfillment_status", "awaiting_activation").in("status", ["paid", "fulfillment_pending"]),
    admin.from("public_course_orders").select("id", { count: "exact", head: true }).in("status", ["under_review", "fulfillment_pending"]),
  ]);

  const rows = orders ?? [];
  const website = rows.filter((o) => o.source === "website");
  const advisor = rows.filter((o) => o.source === "advisor");
  const paid = rows.filter((o) => o.paid_at && !["refunded"].includes(o.status));
  const revenue = paid.filter((o) => o.currency === settings.currency).reduce((s, o) => s + Number(o.total_minor), 0);
  const paidAdvisor = advisor.filter((o) => o.paid_at).length;

  return (
    <section className="mt-8" aria-labelledby="course-packages-overview">
      <SectionHeader
        title={<span id="course-packages-overview">Course packages &amp; chatbot</span>}
        description="Orders from Build your learning plan (direct checkout) and the course advisor chatbot, for the selected period"
        actions={
          <div className="flex gap-3 text-sm font-medium">
            <Link href="/admin/orders" className="text-primary hover:underline">
              All course orders
            </Link>
            <Link href="/admin/advisor/conversations" className="text-primary hover:underline">
              Chatbot conversations
            </Link>
          </div>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Orders placed" value={formatNumber(rows.length)} hint={`${formatNumber(website.length)} direct checkout · ${formatNumber(advisor.length)} via chatbot`} icon={ShoppingBag} href="/admin/orders" />
        <StatCard label="Paid orders" value={formatNumber(paid.length)} hint={`${formatMinor(revenue, settings.currency)} collected`} icon={ClipboardList} href="/admin/orders?payment=succeeded" />
        <StatCard label="Chatbot conversations" value={formatNumber(sessions ?? 0)} hint={`${formatNumber(advisor.length)} orders started · ${formatNumber(paidAdvisor)} paid`} icon={Bot} href="/admin/advisor" />
        <StatCard
          label="Needs follow-up"
          value={formatNumber((awaiting ?? 0) + (review ?? 0))}
          hint={`${formatNumber(awaiting ?? 0)} awaiting account activation · ${formatNumber(review ?? 0)} held or retrying`}
          icon={(review ?? 0) > 0 ? ShieldAlert : MailCheck}
          href="/admin/orders?status=under_review"
          tone={(review ?? 0) > 0 ? "warning" : "default"}
        />
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <caption className="sr-only">Latest course-package orders</caption>
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Latest orders</th>
              <th className="px-4 py-2.5 font-medium">Student</th>
              <th className="px-4 py-2.5 font-medium">Source</th>
              <th className="px-4 py-2.5 font-medium">Courses</th>
              <th className="px-4 py-2.5 font-medium">Total</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Placed</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(recent ?? []).length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  No course-package orders yet.
                </td>
              </tr>
            ) : (
              (recent ?? []).map((o) => (
                <tr key={o.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/orders/${o.id}`} className="font-mono font-medium text-primary hover:underline">
                      {o.order_number}
                    </Link>
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-2.5">{o.learner_email}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={o.source} label={o.source === "advisor" ? "Chatbot" : "Direct checkout"} tone={o.source === "advisor" ? "brand" : "neutral"} />
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{(o.public_course_order_items as unknown as { count: number }[])?.[0]?.count ?? 0}</td>
                  <td className="px-4 py-2.5 tabular-nums">{formatMinor(Number(o.total_minor), o.currency)}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={o.status} label={ORDER_STATUS_LABEL[o.status as OrderStatus] ?? o.status} tone={STATUS_TONE[o.status as OrderStatus]} />
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    <LocalTime value={o.created_at} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
