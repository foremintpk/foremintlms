"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, PauseCircle, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmAction } from "@/components/common/confirm-action";
import { useAction } from "@/hooks/use-action";
import { createCompanyAction, setCompanySuspendedAction, updateCompanyAction } from "@/app/admin/billing/actions";

export function CreateCompanyDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", contactEmail: "", contactName: "", description: "", servicesDescription: "", seatLimit: "" });
  const { run, pending, fieldErrors } = useAction(createCompanyAction, { onSuccess: (d) => router.push(`/admin/billing/companies/${d.id}`) });
  const err = (k: string) => (fieldErrors[k]?.length ? <FieldError>{fieldErrors[k][0]}</FieldError> : null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Building2 aria-hidden />
          New company
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a company workspace</DialogTitle>
          <DialogDescription>Members get course access only once a custom invoice for this company is paid. Companies are also created automatically when a new company invoice is paid.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run({ ...f, seatLimit: f.seatLimit ? Number(f.seatLimit) : null });
          }}
        >
          <Field>
            <FieldLabel htmlFor="c-name">Company name</FieldLabel>
            <Input id="c-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={200} />
            {err("name")}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="c-contact">Primary contact email</FieldLabel>
              <Input id="c-contact" type="email" value={f.contactEmail} onChange={(e) => setF({ ...f, contactEmail: e.target.value })} />
              {err("contactEmail")}
            </Field>
            <Field>
              <FieldLabel htmlFor="c-contact-name">Contact name</FieldLabel>
              <Input id="c-contact-name" value={f.contactName} onChange={(e) => setF({ ...f, contactName: e.target.value })} maxLength={160} />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="c-desc">Description</FieldLabel>
            <Textarea id="c-desc" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="c-services">Services</FieldLabel>
            <Textarea id="c-services" rows={2} value={f.servicesDescription} onChange={(e) => setF({ ...f, servicesDescription: e.target.value })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="c-seats">Seat limit (optional)</FieldLabel>
            <Input id="c-seats" type="number" min={1} value={f.seatLimit} onChange={(e) => setF({ ...f, seatLimit: e.target.value })} placeholder="Unlimited" />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Create company
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CompanySettingsForm({
  company,
}: {
  company: { id: string; name: string; description: string | null; services_description: string | null; seat_limit: number | null; internal_notes: string | null };
}) {
  const router = useRouter();
  const [f, setF] = useState({
    name: company.name,
    description: company.description ?? "",
    servicesDescription: company.services_description ?? "",
    seatLimit: company.seat_limit ? String(company.seat_limit) : "",
    internalNotes: company.internal_notes ?? "",
    reason: "",
  });
  const { run, pending, fieldErrors } = useAction(updateCompanyAction, { onSuccess: () => router.refresh() });
  const err = (k: string) => (fieldErrors[k]?.length ? <FieldError>{fieldErrors[k][0]}</FieldError> : null);
  return (
    <form
      className="grid max-w-2xl gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run({ companyId: company.id, ...f, seatLimit: f.seatLimit ? Number(f.seatLimit) : null });
      }}
    >
      <Field>
        <FieldLabel htmlFor="s-name">Company name</FieldLabel>
        <Input id="s-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={200} />
        {err("name")}
      </Field>
      <Field>
        <FieldLabel htmlFor="s-desc">Description</FieldLabel>
        <Textarea id="s-desc" rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </Field>
      <Field>
        <FieldLabel htmlFor="s-services">Services</FieldLabel>
        <Textarea id="s-services" rows={3} value={f.servicesDescription} onChange={(e) => setF({ ...f, servicesDescription: e.target.value })} />
      </Field>
      <Field className="max-w-xs">
        <FieldLabel htmlFor="s-seats">Seat limit</FieldLabel>
        <Input id="s-seats" type="number" min={1} value={f.seatLimit} onChange={(e) => setF({ ...f, seatLimit: e.target.value })} placeholder="Unlimited" />
        <FieldDescription>Active members plus pending invitations.</FieldDescription>
        {err("seatLimit")}
      </Field>
      <Field>
        <FieldLabel htmlFor="s-notes">Internal notes</FieldLabel>
        <Textarea id="s-notes" rows={3} value={f.internalNotes} onChange={(e) => setF({ ...f, internalNotes: e.target.value })} placeholder="Visible to Foremint admins only." />
      </Field>
      <Field>
        <FieldLabel htmlFor="s-reason">Reason for the change (optional)</FieldLabel>
        <Input id="s-reason" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Recorded in the company history" />
      </Field>
      <div>
        <Button type="submit" disabled={pending}>
          Save company
        </Button>
      </div>
    </form>
  );
}

export function SuspendCompanyButton({ companyId, suspended }: { companyId: string; suspended: boolean }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={
        <Button size="sm" variant="outline" className={suspended ? undefined : "text-destructive hover:text-destructive"}>
          {suspended ? <PlayCircle aria-hidden /> : <PauseCircle aria-hidden />}
          {suspended ? "Reactivate company" : "Suspend company"}
        </Button>
      }
      title={suspended ? "Reactivate this company?" : "Suspend the whole company?"}
      description={
        suspended
          ? "Members regain access to the company's active packages."
          : "Every member loses company access immediately and nobody can be invited. Personal purchases are unaffected. You can reactivate later."
      }
      confirmLabel={suspended ? "Reactivate" : "Suspend company"}
      destructive={!suspended}
      requireReason
      action={(i) => setCompanySuspendedAction({ id: companyId, suspend: !suspended, reason: i.reason ?? "" })}
      onDone={() => router.refresh()}
    />
  );
}
