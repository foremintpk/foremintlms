import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BookOpen, CalendarClock, CreditCard, FilePlus2, Users } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/app-shell/page-header";
import { StatCard } from "@/components/common/stat-card";
import { LocalTime } from "@/components/common/local-time";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { InvoiceStatusBadge, PackageStatusBadge } from "@/components/invoicing/invoice-status-badge";
import { ExtendAccessDialog, PackageStatusControls } from "@/components/invoicing/package-controls";
import { InvitationActions, InviteMemberDialog, MemberAdminMenu, RemoveMemberButton } from "@/components/invoicing/company-team";
import { CompanySettingsForm, SuspendCompanyButton } from "@/components/invoicing/company-admin";
import {
  adminBulkInviteAction,
  adminInviteMemberAction,
  adminRemoveMemberAction,
  adminResendInvitationAction,
  adminRevokeInvitationAction,
  changeContactAction,
  setManagerAction,
} from "@/app/admin/billing/actions";
import { requireAdmin } from "@/lib/auth/guards";
import { getCompanyDetail } from "@/lib/services/invoicing/queries";
import { courseListText, formatMinor, type CourseSnapshotItem } from "@/lib/domain/invoicing";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export const instant = false;

export const metadata: Metadata = { title: "Company" };

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "access", label: "Course access" },
  { key: "members", label: "Members" },
  { key: "invoices", label: "Invoices" },
  { key: "payments", label: "Payments" },
  { key: "activity", label: "Activity" },
  { key: "settings", label: "Settings" },
] as const;

const AUDIT_LABEL: Record<string, string> = {
  company_created: "Company created",
  package_activated: "Package activated",
  member_invited: "Employee invited",
  invitation_resent: "Invitation re-sent",
  invitation_revoked: "Invitation withdrawn",
  invitation_accepted: "Invitation accepted",
  contact_joined: "Primary contact joined",
  member_added: "Member added",
  member_reactivated: "Member re-added",
  member_removed: "Member removed",
  manager_granted: "Team management granted",
  manager_revoked: "Team management removed",
  primary_contact_changed: "Primary contact changed",
  company_suspended: "Company suspended",
  company_reactivated: "Company reactivated",
  company_updated: "Company details updated",
  access_extended: "Access extended",
  package_suspended: "Package suspended",
  package_revoked: "Package revoked",
  package_active: "Package restored",
  package_expired: "Package expired",
};

export default async function CompanyDetailPage({ params, searchParams }: PageProps<"/admin/billing/companies/[id]">) {
  const { id } = await params;
  await requireAdmin(`/admin/billing/companies/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? "overview";
  const d = await getCompanyDetail(id);
  if (!d) notFound();
  const { company } = d;
  const nowMs = new Date().getTime();

  const activeMembers = d.members.filter((m) => m.membership_status === "active");
  const pendingInvites = d.invitations.filter((i) => i.status === "pending" && new Date(i.expires_at).getTime() > nowMs);
  const activeEnts = d.entitlements.filter((e) => e.status === "active" && (!e.expires_at || new Date(e.expires_at).getTime() > nowMs));
  const learners = activeMembers.filter((m) => m.learning && m.learning.lastActive && nowMs - new Date(m.learning.lastActive).getTime() < 30 * 86_400_000).length;
  const coursesAvailable = new Set(activeEnts.flatMap((e) => (e.includes_future_courses ? ["*"] : e.included_course_ids))).size;
  const lastPayment = d.payments.find((p) => p.paid_at);
  const subscription = d.entitlements.find((e) => e.entitlement_type === "subscription" && e.status === "active");
  const seatsLeft = company.seat_limit ? Math.max(0, company.seat_limit - activeMembers.length - pendingInvites.length) : null;
  const invoiceById = new Map(d.invoices.map((i) => [i.id, i]));

  return (
    <>
      <PageHeader
        back={{ href: "/admin/billing/companies", label: "Company accounts" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {company.name}
            {company.status === "suspended" ? (
              <StatusBadge status="suspended" label="Suspended" tone="danger" />
            ) : (
              <StatusBadge status={company.access_status} label={company.access_status === "active" ? "Access active" : company.access_status === "expired" ? "Access ended" : "No paid package"} tone={company.access_status === "active" ? "success" : company.access_status === "expired" ? "neutral" : "info"} />
            )}
          </span>
        }
        description={`Primary contact: ${company.primary_contact_name ? `${company.primary_contact_name} · ` : ""}${company.primary_contact_email}`}
        actions={
          <>
            <InviteMemberDialog companyId={company.id} invite={adminInviteMemberAction} bulkInvite={adminBulkInviteAction} allowManager seatsLeft={seatsLeft} disabledReason={company.status !== "active" ? "Reactivate the company to invite people" : null} />
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/billing/invoices/new">
                <FilePlus2 aria-hidden />
                New invoice
              </Link>
            </Button>
          </>
        }
      >
        <nav aria-label="Company sections" className="-mb-2 flex gap-1 overflow-x-auto border-b">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/admin/billing/companies/${company.id}${t.key === "overview" ? "" : `?tab=${t.key}`}`}
              aria-current={tab === t.key ? "page" : undefined}
              className={cn("-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors", tab === t.key ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
            >
              {t.label}
              {t.key === "members" ? <span className="ml-1.5 text-xs text-muted-foreground">{activeMembers.length}</span> : null}
            </Link>
          ))}
        </nav>
      </PageHeader>

      {tab === "overview" ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Members" value={formatNumber(activeMembers.length)} hint={`${pendingInvites.length} pending invitation${pendingInvites.length === 1 ? "" : "s"}${company.seat_limit ? ` · ${company.seat_limit} seats` : ""}`} icon={Users} />
            <StatCard label="Active learners (30 days)" value={formatNumber(learners)} hint="Opened a course recently" icon={BookOpen} />
            <StatCard label="Courses available" value={coursesAvailable === 1 && activeEnts.some((e) => e.includes_future_courses) ? "All" : formatNumber(coursesAvailable)} hint={activeEnts.length ? `${activeEnts.length} active package${activeEnts.length === 1 ? "" : "s"}` : "No active package"} icon={BookOpen} />
            <StatCard
              label="Package ends"
              value={activeEnts.length ? (activeEnts.some((e) => !e.expires_at) ? "No end date" : <LocalTime value={activeEnts.map((e) => e.expires_at!).sort().at(-1)!} format="date" />) : "—"}
              hint={subscription ? `Subscription ${subscription.subscription_status ?? ""}`.trim() : lastPayment?.paid_at ? <>Last payment <LocalTime value={lastPayment.paid_at} format="date" /></> : "No payments yet"}
              icon={CalendarClock}
            />
          </div>
          <section className="rounded-2xl border bg-card p-5 shadow-card">
            <SectionHeader title="About" />
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Description</dt>
                <dd className="mt-0.5 whitespace-pre-wrap">{company.description || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Services</dt>
                <dd className="mt-0.5 whitespace-pre-wrap">{company.services_description || "—"}</dd>
              </div>
              {company.primary_contact_phone ? (
                <div>
                  <dt className="text-xs text-muted-foreground">Contact phone (internal)</dt>
                  <dd className="mt-0.5">{company.primary_contact_phone}</dd>
                </div>
              ) : null}
              {company.internal_notes ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">Internal notes</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap">{company.internal_notes}</dd>
                </div>
              ) : null}
            </dl>
          </section>
        </div>
      ) : null}

      {tab === "access" ? (
        <div className="space-y-4">
          {d.entitlements.length === 0 ? (
            <p className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">No paid packages yet. Members get access once a company invoice is paid.</p>
          ) : (
            d.entitlements.map((e) => {
              const inv = invoiceById.get(e.invoice_id);
              const snapshot = ((inv?.selected_course_snapshot as unknown as CourseSnapshotItem[]) ?? []) as CourseSnapshotItem[];
              return (
                <section key={e.id} className="rounded-2xl border bg-card p-5 shadow-card">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <PackageStatusBadge status={e.status} expiresAt={e.expires_at} />
                        {inv ? (
                          <Link href={`/admin/billing/invoices/${inv.id}`} className="font-mono text-xs text-primary hover:underline">
                            {inv.invoice_number}
                          </Link>
                        ) : null}
                      </div>
                      <h3 className="mt-2 font-semibold">{inv?.invoice_description}</h3>
                      <p className="text-sm text-muted-foreground">
                        <LocalTime value={e.starts_at} format="date" /> – {e.expires_at ? <LocalTime value={e.expires_at} format="date" /> : e.entitlement_type === "subscription" ? "while subscribed" : "no end date"}
                        {e.subscription_status ? ` · subscription ${e.subscription_status.replace(/_/g, " ")}` : ""}
                      </p>
                      {e.status_reason && e.status !== "active" ? <p className="text-xs text-muted-foreground">{e.status_reason}</p> : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <ExtendAccessDialog entitlementId={e.id} currentExpiry={e.expires_at} />
                      <PackageStatusControls entitlementId={e.id} status={e.status} />
                    </div>
                  </div>
                  <p className="mt-4 text-sm">{courseListText(snapshot, e.includes_future_courses, 50)}</p>
                </section>
              );
            })
          )}
        </div>
      ) : null}

      {tab === "members" ? (
        <div className="space-y-6">
          <section className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Member</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3 font-medium">Learning</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {d.members.map((m) => {
                  const isContact = company.primary_contact_user_id === m.user_id;
                  return (
                    <tr key={m.id} className={m.membership_status !== "active" ? "text-muted-foreground" : undefined}>
                      <td className="px-4 py-3">
                        <Link href={`/admin/students/${m.user_id}`} className="font-medium hover:underline">
                          {m.name || m.email}
                        </Link>
                        <span className="block text-xs text-muted-foreground">{m.email}</span>
                      </td>
                      <td className="px-4 py-3 text-xs">{isContact ? "Primary contact" : m.can_invite_members ? "Team manager" : "Employee"}</td>
                      <td className="px-4 py-3 text-xs">
                        <LocalTime value={m.joined_at} format="date" />
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {m.learning && m.learning.courses ? (
                          <>
                            {formatPercent(m.learning.avg)} avg · {m.learning.completed}/{m.learning.courses} complete
                            {m.learning.lastActive ? (
                              <span className="block text-muted-foreground">
                                Active <LocalTime value={m.learning.lastActive} format="relative" />
                              </span>
                            ) : null}
                          </>
                        ) : (
                          "Not started"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={m.membership_status === "active" ? "active" : "removed"} label={m.membership_status === "active" ? "Active" : "Removed"} />
                      </td>
                      <td className="px-4 py-3">
                        {m.membership_status === "active" ? (
                          <div className="flex items-center justify-end gap-1">
                            <MemberAdminMenu companyId={company.id} memberId={m.id} isManager={m.can_invite_members} isContact={isContact} setManager={setManagerAction} makeContact={changeContactAction} />
                            {!isContact ? <RemoveMemberButton companyId={company.id} memberId={m.id} name={m.name || m.email} remove={adminRemoveMemberAction} requireReason /> : null}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
                {d.members.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                      No members yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>
          <section className="rounded-2xl border bg-card p-5 shadow-card">
            <SectionHeader title="Invitations" />
            {d.invitations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invitations sent.</p>
            ) : (
              <ul className="divide-y text-sm">
                {d.invitations.map((i) => {
                  const expired = i.status === "pending" && new Date(i.expires_at).getTime() <= nowMs;
                  return (
                    <li key={i.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{i.email}</span>
                        <span className="block text-xs text-muted-foreground">
                          {i.kind === "company_contact" ? "Primary contact" : i.can_invite_members ? "Team manager" : "Employee"} · invited by {i.invited_by_role === "company" ? "company contact" : i.invited_by_role === "admin" ? "Foremint admin" : "system"} · sent {i.send_count}× · expires <LocalTime value={i.expires_at} format="date" />
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <StatusBadge status={expired ? "expired" : i.status} />
                        {i.status === "pending" ? <InvitationActions companyId={company.id} invitationId={i.id} email={i.email} resend={adminResendInvitationAction} revoke={adminRevokeInvitationAction} /> : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      {tab === "invoices" ? (
        <section className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {d.invoices.map((i) => (
                <tr key={i.id}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/billing/invoices/${i.id}`} className="font-mono text-xs text-primary hover:underline">
                      {i.invoice_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{i.invoice_description}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMinor(i.amount_minor, i.currency)}
                    {i.billing_type === "recurring" ? <span className="block text-xs text-muted-foreground">recurring</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    <InvoiceStatusBadge status={i.status} />
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <LocalTime value={i.created_at} format="date" />
                  </td>
                </tr>
              ))}
              {d.invoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    No invoices linked yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      ) : null}

      {tab === "payments" ? (
        <section className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Whop payment</th>
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {d.payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/payments/${p.id}`} className="font-mono text-xs text-primary hover:underline">
                      {p.whop_payment_id}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{invoiceById.get(p.custom_invoice_id!)?.invoice_number ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMoney(p.total_cents, p.currency)}
                    {p.refunded_cents ? <span className="block text-xs text-warning">refunded {formatMoney(p.refunded_cents, p.currency)}</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-xs">{p.paid_at ? <LocalTime value={p.paid_at} format="datetime" /> : "—"}</td>
                </tr>
              ))}
              {d.payments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    <CreditCard className="mx-auto mb-2 size-5" aria-hidden />
                    No payments yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      ) : null}

      {tab === "activity" ? (
        <section className="rounded-2xl border bg-card p-5 shadow-card">
          <ol className="relative space-y-4 border-l pl-5">
            {d.audit.map((a) => (
              <li key={a.id} className="relative text-sm">
                <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-card bg-primary" aria-hidden />
                <p className="font-medium">
                  {AUDIT_LABEL[a.action] ?? a.action.replace(/_/g, " ")}
                  {a.affectedName ? <span className="font-normal text-muted-foreground"> · {a.affectedName}</span> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  <LocalTime value={a.created_at} format="datetime" /> · {a.performer_role === "system" ? "System" : `${a.performerName || "Unknown"} (${a.performer_role === "admin" ? "admin" : "company contact"})`}
                  {a.reason ? ` · ${a.reason}` : ""}
                </p>
              </li>
            ))}
            {d.audit.length === 0 ? <li className="text-sm text-muted-foreground">No activity yet.</li> : null}
          </ol>
        </section>
      ) : null}

      {tab === "settings" ? (
        <div className="space-y-6">
          <section className="rounded-2xl border bg-card p-5 shadow-card">
            <SectionHeader title="Company details" />
            <CompanySettingsForm company={company} />
          </section>
          <section className="rounded-2xl border border-destructive/20 bg-card p-5 shadow-card">
            <SectionHeader title="Suspend company" description="Pauses access for every member at once, for example during a payment dispute." />
            <SuspendCompanyButton companyId={company.id} suspended={company.status === "suspended"} />
          </section>
        </div>
      ) : null}
    </>
  );
}
