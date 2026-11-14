import type { Metadata } from "next";
import Link from "next/link";
import { Building2, CalendarClock, FileDown, Users } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { LocalTime } from "@/components/common/local-time";
import { StatCard } from "@/components/common/stat-card";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { InvitationActions, InviteMemberDialog, RemoveMemberButton } from "@/components/invoicing/company-team";
import { InvoiceStatusBadge, PackageStatusBadge } from "@/components/invoicing/invoice-status-badge";
import { requireUser } from "@/lib/auth/guards";
import { getCompanyPortal } from "@/lib/services/invoicing/company-portal";
import { billingIntervalLabel, formatMinor, remainingDays } from "@/lib/domain/invoicing";
import { formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { inviteCompanyMemberAction, removeCompanyMemberAction, resendCompanyInviteAction, revokeCompanyInviteAction } from "./actions";

export const instant = false;

export const metadata: Metadata = { title: "My company" };

export default async function CompanyPage({ searchParams }: PageProps<"/learn/company">) {
  const user = await requireUser("/learn/company");
  const sp = await searchParams;
  const portal = await getCompanyPortal(user.id, typeof sp.company === "string" ? sp.company : null);

  if (!portal) {
    return (
      <>
        <PageHeader title="My company" />
        <EmptyState icon={Building2} title="You're not part of a company" description="If your employer bought Foremint Academy access, ask them to invite you, then open the link in the email." />
      </>
    );
  }

  const { me, memberships, company, live, packages, courses, team, billing } = portal;
  const nowMs = new Date().getTime();
  const endsAt = live.length ? (live.some((p) => !p.expires_at) ? null : live.map((p) => p.expires_at!).sort().at(-1)!) : null;
  const left = remainingDays(endsAt);
  const suspended = company.status === "suspended";
  const seatsLeft = company.seat_limit && team ? Math.max(0, company.seat_limit - team.activeCount - team.invitations.filter((i) => i.status === "pending" && new Date(i.expires_at).getTime() > nowMs).length) : null;
  const inviteBlocked = suspended ? "Your company's access is paused" : !portal.contactInvitesAllowed ? "Foremint Academy handles invitations for your company" : live.length === 0 ? "Your company has no active package" : null;

  return (
    <>
      <PageHeader
        title={company.name}
        description={me.isPrimaryContact ? "You're the company contact. Invite colleagues; each person gets their own login and progress." : me.canInviteMembers ? "You can invite and manage your colleagues." : "Courses available to you through your company."}
        actions={
          me.canInviteMembers ? (
            <InviteMemberDialog companyId={company.id} invite={inviteCompanyMemberAction} allowManager={false} seatsLeft={seatsLeft} disabledReason={inviteBlocked} />
          ) : null
        }
      >
        {memberships.length > 1 ? (
          <nav aria-label="Companies" className="flex flex-wrap gap-2">
            {memberships.map((m) => (
              <Link key={m.companyId} href={`/learn/company?company=${m.companyId}`} aria-current={m.companyId === me.companyId ? "page" : undefined} className={cn("rounded-full border px-3 py-1 text-xs font-medium", m.companyId === me.companyId ? "border-primary bg-brand-soft text-primary" : "text-muted-foreground hover:text-foreground")}>
                {m.companyName}
              </Link>
            ))}
          </nav>
        ) : null}
      </PageHeader>

      {suspended ? <p className="mb-6 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">Your company&rsquo;s access is paused. Contact your company contact or Foremint Academy.</p> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Access"
          value={live.length ? (endsAt ? <LocalTime value={endsAt} format="date" /> : "No end date") : "Ended"}
          hint={live.length ? (endsAt ? `${left} day${left === 1 ? "" : "s"} left` : live.some((p) => p.entitlement_type === "subscription") ? "Renews while the subscription is active" : "Lifetime access") : "Ask your company contact about renewing"}
          icon={CalendarClock}
          tone={live.length ? (left !== null && left <= 14 ? "warning" : "success") : "default"}
        />
        <StatCard label="Courses" value={formatNumber(courses.length)} hint={live.some((p) => p.includes_future_courses) ? "Including new releases" : "In your company's package"} />
        {team ? <StatCard label="Team members" value={formatNumber(team.activeCount)} hint={company.seat_limit ? `${company.seat_limit} seats` : "Unlimited seats"} icon={Users} /> : <StatCard label="Your role" value="Member" hint={`Contact: ${company.primary_contact_name || company.primary_contact_email}`} icon={Users} />}
      </div>

      <section className="mt-8">
        <SectionHeader title="Company courses" description="Your progress is your own; your colleagues don't see it." />
        {courses.length === 0 ? (
          <p className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">No courses are currently available through your company.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {courses.map((c) => (
              <li key={c.id}>
                <Link href={`/learn/courses/${c.slug}`} className="block h-full rounded-2xl border bg-card p-4 shadow-card transition-colors hover:border-primary/40">
                  <p className="font-medium">{c.title}</p>
                  {c.short_description ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.short_description}</p> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {me.canInviteMembers && packages.length ? (
        <section className="mt-8">
          <SectionHeader title="Packages" />
          <ul className="space-y-3">
            {packages.map((p) => (
              <li key={p.id} className="flex flex-col gap-2 rounded-2xl border bg-card p-4 text-sm shadow-card sm:flex-row sm:items-center sm:justify-between">
                <span>
                  <span className="block font-medium">{p.description}</span>
                  <span className="text-xs text-muted-foreground">
                    <LocalTime value={p.starts_at} format="date" /> – {p.expires_at ? <LocalTime value={p.expires_at} format="date" /> : p.entitlement_type === "subscription" ? "while subscribed" : "no end date"}
                    {p.subscription_status && me.canViewBilling ? ` · subscription ${p.subscription_status.replace(/_/g, " ")}` : ""}
                  </span>
                </span>
                <PackageStatusBadge status={p.status} expiresAt={p.expires_at} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {team ? (
        <section className="mt-8 space-y-6">
          <div>
            <SectionHeader title="Team members" />
            <div className="overflow-x-auto rounded-2xl border bg-card">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Joined</th>
                    <th className="px-4 py-3 font-medium">Progress</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {team.members.map((m) => {
                    const isContact = company.primary_contact_user_id === m.user_id;
                    const canRemove = !isContact && !m.can_invite_members && m.user_id !== user.id;
                    return (
                      <tr key={m.id}>
                        <td className="px-4 py-3">
                          <p className="font-medium">{m.name || m.email}</p>
                          <p className="text-xs text-muted-foreground">{m.email}</p>
                        </td>
                        <td className="px-4 py-3 text-xs">{isContact ? "Company contact" : m.can_invite_members ? "Team manager" : "Member"}</td>
                        <td className="px-4 py-3 text-xs">
                          <LocalTime value={m.joined_at} format="date" />
                        </td>
                        <td className="px-4 py-3 text-xs">{m.avgProgress === null ? "Not started" : `${formatPercent(m.avgProgress)} average`}</td>
                        <td className="px-4 py-3 text-right">{canRemove ? <RemoveMemberButton companyId={company.id} memberId={m.id} name={m.name || m.email} remove={removeCompanyMemberAction} requireReason={false} /> : null}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <SectionHeader title="Invitations" />
            {team.invitations.length === 0 ? (
              <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">No pending invitations.</p>
            ) : (
              <ul className="divide-y rounded-2xl border bg-card text-sm">
                {team.invitations.map((i) => {
                  const expired = i.status === "expired" || new Date(i.expires_at).getTime() <= nowMs;
                  return (
                    <li key={i.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{i.email}</span>
                        <span className="text-xs text-muted-foreground">
                          Sent {i.send_count}× · {expired ? "expired" : <>expires <LocalTime value={i.expires_at} format="date" /></>}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <StatusBadge status={expired ? "expired" : "pending"} label={expired ? "Expired" : "Pending"} />
                        <InvitationActions companyId={company.id} invitationId={i.id} email={i.email} resend={resendCompanyInviteAction} revoke={revokeCompanyInviteAction} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      ) : null}

      {billing && billing.length ? (
        <section className="mt-8">
          <SectionHeader title="Invoices" description="Payments are processed by Whop; Whop emails its own receipts." />
          <ul className="divide-y rounded-2xl border bg-card text-sm">
            {billing.map((b) => (
              <li key={b.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  <span className="block font-medium">{b.invoice_description}</span>
                  <span className="text-xs text-muted-foreground">
                    {b.invoice_number} · {formatMinor(b.amount_minor, b.currency)}
                    {b.billing_type === "recurring" ? ` ${billingIntervalLabel(b.billing_interval_days).toLowerCase()}` : ""}
                    {b.paid_at ? <> · paid <LocalTime value={b.paid_at} format="date" /></> : null}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <InvoiceStatusBadge status={b.status} />
                  <Button asChild size="xs" variant="outline">
                    <a href={`/api/billing/custom-invoices/${b.id}/summary?download=1`}>
                      <FileDown aria-hidden />
                      Service summary
                    </a>
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
