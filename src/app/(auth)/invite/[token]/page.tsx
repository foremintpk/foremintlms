import Link from "next/link";
import { MailWarning } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { AcceptInvitationButton, AcceptInvitationNewAccountForm } from "@/components/auth/invite-forms";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/format";
import { findInvitationByToken, invitationState } from "@/lib/services/invitations";

export const instant = false;

export const metadata = { title: "Accept your invitation", robots: { index: false, follow: false } };

const STATE_COPY = {
  invalid: { title: "This invitation link isn't valid", body: "Check that you opened the full link from the invitation email." },
  expired: { title: "This invitation has expired", body: "Invitations are valid for 7 days. Ask the administrator who invited you to resend it." },
  revoked: { title: "This invitation was withdrawn", body: "Contact the academy team if you think this is a mistake." },
  accepted: { title: "This invitation has already been used", body: "Sign in with the account that accepted it." },
} as const;

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const invitation = await findInvitationByToken(token);
  const state = invitationState(invitation);

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
  const [{ data: inviter }, { data: courses }, user] = await Promise.all([
    invitation.invited_by
      ? admin.from("profiles").select("full_name").eq("id", invitation.invited_by).maybeSingle()
      : Promise.resolve({ data: null }),
    invitation.course_ids.length
      ? admin.from("courses").select("id, title").in("id", invitation.course_ids)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    getSessionUser(),
  ]);
  const roleLabel = invitation.role === "admin" ? "an administrator" : "an instructor";
  const inviterName = (inviter?.full_name as string | undefined) || "The Foremint Academy team";

  const summary = (
    <div className="mb-6 grid gap-3 rounded-2xl border bg-card p-4 text-sm shadow-card">
      <p>
        <span className="font-medium">{inviterName}</span> invited <span className="font-medium">{invitation.email}</span> to join as {roleLabel}.
      </p>
      {invitation.message ? <p className="border-l-2 border-primary/30 pl-3 text-muted-foreground">{invitation.message}</p> : null}
      {courses && courses.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">You&rsquo;ll be assigned to</p>
          <ul className="list-disc pl-5">
            {(courses as { id: string; title: string }[]).map((c) => (
              <li key={c.id}>{c.title}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">Expires {formatDate(invitation.expires_at)}.</p>
    </div>
  );

  if (user) {
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return (
        <AuthCard
          title="Switch accounts to accept"
          description={`You're signed in as ${user.email}, but this invitation is for ${invitation.email}. Sign out, then open the invitation link again.`}
        >
          {summary}
          <SignOutButton className="h-11 w-full" label="Sign out" />
        </AuthCard>
      );
    }
    return (
      <AuthCard title="Accept your invitation" description="Confirm to add this role to your account.">
        {summary}
        <AcceptInvitationButton token={token} />
        {invitation.role === "teacher" ? (
          <p className="mt-4 text-xs text-muted-foreground">An administrator reviews new instructor accounts before teaching tools unlock.</p>
        ) : null}
      </AuthCard>
    );
  }

  const { data: existing } = await admin.from("profile_private").select("user_id").eq("email", invitation.email).maybeSingle();
  if (existing) {
    return (
      <AuthCard title="Sign in to accept" description={`An account for ${invitation.email} already exists. Sign in, and you'll come straight back here.`}>
        {summary}
        <Button asChild className="h-11 w-full">
          <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}>Sign in to accept</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Set up your account" description="Create your password to accept the invitation.">
      {summary}
      <AcceptInvitationNewAccountForm token={token} email={invitation.email} defaultName={invitation.full_name ?? ""} />
    </AuthCard>
  );
}
