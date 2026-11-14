import Link from "next/link";
import { Building2, MailWarning } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { AcceptJoinButton, JoinNewAccountForm } from "@/components/auth/join-forms";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/format";
import { courseListText, type CourseSnapshotItem } from "@/lib/domain/invoicing";
import { accessInvitationState, findAccessInvitationByToken } from "@/lib/services/invoicing/invitations";
import { courseTitlesText, orderAccessSummary } from "@/lib/domain/commerce";
import { loadOrder, loadOrderItems } from "@/lib/services/commerce/store";

export const instant = false;

export const metadata = { title: "Join Foremint Academy", robots: { index: false, follow: false } };

const STATE_COPY = {
  invalid: { title: "This link isn't valid", body: "Check that you opened the full link from the email." },
  expired: { title: "This invitation has expired", body: "Ask the person who invited you to send a new one." },
  revoked: { title: "This invitation was withdrawn", body: "Contact your company contact or Foremint Academy if you think this is a mistake." },
  accepted: { title: "This invitation has already been used", body: "Sign in with the account that accepted it." },
} as const;

export default async function JoinPage({ params }: PageProps<"/join/[token]">) {
  const { token } = await params;
  const invitation = await findAccessInvitationByToken(token);
  const state = accessInvitationState(invitation);

  if (!invitation || state !== "valid") {
    const copy = STATE_COPY[state === "valid" ? "invalid" : state];
    return (
      <AuthCard title={copy.title} description={copy.body}>
        <div className="mb-6 grid size-12 place-items-center rounded-2xl bg-warning-soft text-warning">
          <MailWarning className="size-6" />
        </div>
        <Button asChild variant="outline" className="h-11 w-full">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </AuthCard>
    );
  }

  const admin = createAdminClient();
  const isOrder = invitation.kind === "order_activation";
  const isPurchase = invitation.kind === "purchase_activation" || isOrder;
  const [{ data: company }, { data: invoice }, user, { data: existing }, order, orderItems] = await Promise.all([
    invitation.company_id ? admin.from("companies").select("name").eq("id", invitation.company_id).maybeSingle() : Promise.resolve({ data: null }),
    invitation.invoice_id
      ? admin.from("custom_invoices").select("invoice_description, selected_course_snapshot, includes_future_courses").eq("id", invitation.invoice_id).maybeSingle()
      : invitation.company_id
        ? admin
            .from("custom_invoices")
            .select("invoice_description, selected_course_snapshot, includes_future_courses")
            .eq("company_id", invitation.company_id)
            .eq("status", "paid")
            .order("paid_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    getSessionUser(),
    admin.from("profile_private").select("user_id").eq("email", invitation.email).maybeSingle(),
    isOrder && invitation.public_order_id ? loadOrder(invitation.public_order_id) : Promise.resolve(null),
    isOrder && invitation.public_order_id ? loadOrderItems(invitation.public_order_id) : Promise.resolve([]),
  ]);
  const courses = isOrder
    ? courseTitlesText(orderItems.map((i) => i.course_title_snapshot), 8)
    : invoice
      ? courseListText((invoice.selected_course_snapshot as unknown as CourseSnapshotItem[]) ?? [], invoice.includes_future_courses, 8)
      : null;
  const heading = isPurchase ? "Your courses are ready" : `Join ${company?.name ?? "your company"}`;
  const cta = isPurchase ? "Activate my courses" : "Join company";

  const summary = (
    <div className="mb-6 grid gap-3 rounded-2xl border bg-card p-4 text-sm shadow-card">
      {!isPurchase ? (
        <p className="flex items-center gap-2 font-medium">
          <Building2 className="size-4 text-primary" aria-hidden />
          {company?.name}
        </p>
      ) : (
        <p className="font-medium">{isOrder ? `Course package ${order?.order_number ?? ""}` : invoice?.invoice_description}</p>
      )}
      {isOrder && order ? <p className="text-muted-foreground">{orderAccessSummary(order.duration_days, order.paid_at ? new Date(order.paid_at) : null)}</p> : null}
      {courses ? (
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Courses:</span> {courses}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        For {invitation.email} · link expires {formatDate(invitation.expires_at)}. You get your own login and your own progress.
      </p>
    </div>
  );

  if (user) {
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return (
        <AuthCard title="Switch accounts to continue" description={`You're signed in as ${user.email}, but this invitation is for ${invitation.email}. Sign out, then open the link again.`}>
          {summary}
          <SignOutButton className="h-11 w-full" label="Sign out" />
        </AuthCard>
      );
    }
    return (
      <AuthCard title={heading} description="Your existing account, progress and courses are kept.">
        {summary}
        <AcceptJoinButton token={token} label={cta} />
      </AuthCard>
    );
  }

  if (existing) {
    return (
      <AuthCard title="Sign in to continue" description={`An account for ${invitation.email} already exists. Sign in and you'll come straight back here.`}>
        {summary}
        <Button asChild className="h-11 w-full">
          <Link href={`/login?next=${encodeURIComponent(`/join/${token}`)}`}>Sign in to continue</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={heading} description="Create your password to finish setting up your account.">
      {summary}
      <JoinNewAccountForm token={token} email={invitation.email} defaultName={invitation.full_name ?? ""} submitLabel={isPurchase ? "Create account and start learning" : "Create account and join"} />
    </AuthCard>
  );
}
