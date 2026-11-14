"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, MoreHorizontal, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmAction } from "@/components/common/confirm-action";
import { useAction, type ClientActionResult } from "@/hooks/use-action";

type Result<T = null> = Promise<ClientActionResult<T>>;

export interface TeamActions {
  invite: (input: { companyId: string; email: string; fullName?: string; canInviteMembers?: boolean }) => Result;
  bulkInvite?: (input: { companyId: string; emails: string }) => Result<{ sent: number; skipped: { email: string; reason: string }[] }>;
  resend: (input: { companyId: string; invitationId: string }) => Result;
  revoke: (input: { companyId: string; invitationId: string }) => Result;
  remove: (input: { companyId: string; memberId: string; reason?: string }) => Result;
}

export function InviteMemberDialog({
  companyId,
  invite,
  bulkInvite,
  allowManager,
  seatsLeft,
  disabledReason,
}: {
  companyId: string;
  invite: TeamActions["invite"];
  bulkInvite?: TeamActions["bulkInvite"];
  allowManager: boolean;
  seatsLeft: number | null;
  disabledReason?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [manager, setManager] = useState(false);
  const [emails, setEmails] = useState("");
  const [skipped, setSkipped] = useState<{ email: string; reason: string }[]>([]);
  const single = useAction(invite, {
    onSuccess: () => {
      setEmail("");
      setFullName("");
      setManager(false);
      setOpen(false);
      router.refresh();
    },
  });
  const bulk = useAction(bulkInvite ?? (async () => ({ ok: true as const, data: { sent: 0, skipped: [] } })), {
    onSuccess: (data) => {
      setSkipped(data.skipped);
      if (!data.skipped.length) {
        setEmails("");
        setOpen(false);
      }
      router.refresh();
    },
  });

  if (disabledReason) {
    return (
      <Button size="sm" disabled title={disabledReason}>
        <UserPlus aria-hidden />
        Invite employee
      </Button>
    );
  }

  const singleForm = (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void single.run({ companyId, email, fullName: fullName || undefined, canInviteMembers: allowManager ? manager : undefined });
      }}
    >
      <Field>
        <FieldLabel htmlFor="invite-email">Work email</FieldLabel>
        <Input id="invite-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" autoComplete="off" data-testid="invite-email" />
        {single.fieldErrors.email?.length ? <FieldError>{single.fieldErrors.email[0]}</FieldError> : null}
      </Field>
      <Field>
        <FieldLabel htmlFor="invite-name">Name (optional)</FieldLabel>
        <Input id="invite-name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={160} />
      </Field>
      {allowManager ? (
        <div className="flex items-start justify-between gap-4 rounded-xl border p-3">
          <Label htmlFor="invite-manager" className="grid gap-0.5 font-normal">
            <span className="text-sm font-medium">Can manage the team</span>
            <span className="text-xs text-muted-foreground">Lets them invite and remove employees.</span>
          </Label>
          <Switch id="invite-manager" checked={manager} onCheckedChange={setManager} />
        </div>
      ) : null}
      <DialogFooter>
        <Button type="submit" disabled={single.pending} data-testid="send-invite">
          <Mail aria-hidden />
          Send invitation
        </Button>
      </DialogFooter>
    </form>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="invite-employee">
          <UserPlus aria-hidden />
          Invite employee
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite to the company</DialogTitle>
          <DialogDescription>
            Each person gets their own login and progress, with the company&rsquo;s courses until the package ends.
            {seatsLeft !== null ? ` ${seatsLeft} seat${seatsLeft === 1 ? "" : "s"} left.` : ""}
          </DialogDescription>
        </DialogHeader>
        {bulkInvite ? (
          <Tabs defaultValue="single">
            <TabsList className="mb-4">
              <TabsTrigger value="single">One person</TabsTrigger>
              <TabsTrigger value="bulk">Several people</TabsTrigger>
            </TabsList>
            <TabsContent value="single">{singleForm}</TabsContent>
            <TabsContent value="bulk">
              <form
                className="grid gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void bulk.run({ companyId, emails });
                }}
              >
                <Field>
                  <FieldLabel htmlFor="invite-emails">Email addresses</FieldLabel>
                  <Textarea id="invite-emails" rows={6} value={emails} onChange={(e) => setEmails(e.target.value)} placeholder={"one@company.com\ntwo@company.com"} />
                  <FieldDescription>One per line, or separated by commas. Up to 200 at a time.</FieldDescription>
                </Field>
                {skipped.length ? (
                  <ul className="max-h-32 overflow-y-auto rounded-xl border bg-muted/30 p-3 text-xs">
                    {skipped.map((s) => (
                      <li key={s.email}>
                        <span className="font-medium">{s.email}</span> — {s.reason}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <DialogFooter>
                  <Button type="submit" disabled={bulk.pending}>
                    <Users aria-hidden />
                    Send invitations
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>
          </Tabs>
        ) : (
          singleForm
        )}
      </DialogContent>
    </Dialog>
  );
}

export function InvitationActions({ companyId, invitationId, email, resend, revoke }: { companyId: string; invitationId: string; email: string; resend: TeamActions["resend"]; revoke: TeamActions["revoke"] }) {
  const router = useRouter();
  const r = useAction(resend, { onSuccess: () => router.refresh() });
  return (
    <div className="flex items-center justify-end gap-1.5">
      <Button size="xs" variant="outline" onClick={() => void r.run({ companyId, invitationId })} disabled={r.pending}>
        Resend
      </Button>
      <ConfirmAction
        trigger={
          <Button size="xs" variant="ghost" className="text-destructive hover:text-destructive">
            Withdraw
          </Button>
        }
        title={`Withdraw the invitation to ${email}?`}
        description="The link in their email stops working. You can invite them again later."
        confirmLabel="Withdraw invitation"
        destructive
        action={() => revoke({ companyId, invitationId })}
        onDone={() => router.refresh()}
      />
    </div>
  );
}

export function RemoveMemberButton({ companyId, memberId, name, remove, requireReason }: { companyId: string; memberId: string; name: string; remove: TeamActions["remove"]; requireReason: boolean }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={
        <Button size="xs" variant="ghost" className="text-destructive hover:text-destructive" data-testid="remove-member">
          Remove
        </Button>
      }
      title={`Remove ${name} from the company?`}
      description="Their company access ends immediately. Their account, progress and any courses they bought themselves are kept."
      confirmLabel="Remove from company"
      destructive
      requireReason={requireReason}
      action={(i) => remove({ companyId, memberId, reason: i.reason })}
      onDone={() => router.refresh()}
    />
  );
}

export function MemberAdminMenu({
  companyId,
  memberId,
  isManager,
  isContact,
  setManager,
  makeContact,
}: {
  companyId: string;
  memberId: string;
  isManager: boolean;
  isContact: boolean;
  setManager: (input: { companyId: string; memberId: string; canInvite: boolean }) => Result;
  makeContact: (input: { companyId: string; memberId: string; reason: string }) => Result;
}) {
  const router = useRouter();
  const m = useAction(setManager, { onSuccess: () => router.refresh() });
  const [contactOpen, setContactOpen] = useState(false);
  const [reason, setReason] = useState("");
  const c = useAction(makeContact, {
    onSuccess: () => {
      setContactOpen(false);
      router.refresh();
    },
  });
  if (isContact) return null;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label="Member options">
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => void m.run({ companyId, memberId, canInvite: !isManager })}>{isManager ? "Remove team management" : "Allow team management"}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setContactOpen(true)}>Make primary contact</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change the primary contact</DialogTitle>
            <DialogDescription>They receive company notices and can manage the team and see the company&rsquo;s invoices.</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void c.run({ companyId, memberId, reason });
            }}
          >
            <Field>
              <FieldLabel htmlFor="contact-reason">Reason</FieldLabel>
              <Textarea id="contact-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Recorded in the audit log" />
              {c.fieldErrors.reason?.length ? <FieldError>{c.fieldErrors.reason[0]}</FieldError> : null}
            </Field>
            <DialogFooter>
              <Button type="submit" disabled={c.pending}>
                Make primary contact
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
