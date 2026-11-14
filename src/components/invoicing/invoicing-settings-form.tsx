"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAction } from "@/hooks/use-action";
import { saveInvoicingSettings } from "@/app/admin/billing/actions";
import type { InvoicingSettingsInput } from "@/lib/validation/invoicing";

export function InvoicingSettingsForm({ initial }: { initial: InvoicingSettingsInput }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const set = <K extends keyof InvoicingSettingsInput>(k: K, value: InvoicingSettingsInput[K]) => setV((p) => ({ ...p, [k]: value }));
  const { run, pending, fieldErrors } = useAction(saveInvoicingSettings, { onSuccess: () => router.refresh() });
  const err = (k: string) => (fieldErrors[k]?.length ? <FieldError>{fieldErrors[k][0]}</FieldError> : null);
  const num = (k: keyof InvoicingSettingsInput, id: string, label: string, hint?: string) => (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} type="number" min={0} value={String(v[k] ?? "")} onChange={(e) => set(k, e.target.value as never)} />
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
      {err(k)}
    </Field>
  );
  const policy = (k: "refundFullPolicy" | "refundPartialPolicy" | "disputePolicy", id: string, label: string, options: { value: string; label: string }[], hint: string) => (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select value={String(v[k])} onValueChange={(x) => set(k, x as never)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldDescription>{hint}</FieldDescription>
    </Field>
  );

  return (
    <form
      className="grid gap-8"
      onSubmit={(e) => {
        e.preventDefault();
        void run(v);
      }}
    >
      <section className="grid gap-4 rounded-2xl border bg-card p-5 shadow-card sm:grid-cols-2">
        <h2 className="text-base font-semibold sm:col-span-2">Invoices</h2>
        <Field>
          <FieldLabel htmlFor="numberPrefix">Invoice number prefix</FieldLabel>
          <Input id="numberPrefix" value={v.numberPrefix} onChange={(e) => set("numberPrefix", e.target.value)} maxLength={16} />
          <FieldDescription>Numbers look like {v.numberPrefix || "FMA-INV"}-2026-001001. Whop keeps its own invoice numbering too.</FieldDescription>
          {err("numberPrefix")}
        </Field>
        {num("defaultDueDays", "defaultDueDays", "Default days until due", "0 means due on receipt.")}
        <Field>
          <FieldLabel htmlFor="delivery">Who emails the payment link</FieldLabel>
          <Select value={v.delivery} onValueChange={(x) => set("delivery", x as "foremint" | "whop")}>
            <SelectTrigger id="delivery" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="foremint">Foremint (branded email via Resend)</SelectItem>
              <SelectItem value="whop">Whop (Whop&rsquo;s invoice email and reminders)</SelectItem>
            </SelectContent>
          </Select>
          <FieldDescription>One channel only, so customers never get the same invoice twice. Payment links are always sent by Foremint.</FieldDescription>
        </Field>
        {num("paymentReminderDays", "paymentReminderDays", "Payment reminder (days before due)", "One reminder per invoice; 0 turns it off.")}
        <Field>
          <FieldLabel htmlFor="defaultCollectionMethod">Default payment method</FieldLabel>
          <Select value={v.defaultCollectionMethod} onValueChange={(x) => set("defaultCollectionMethod", x as "payment_link" | "whop_invoice")}>
            <SelectTrigger id="defaultCollectionMethod" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="payment_link">Direct payment link (client pays straight away)</SelectItem>
              <SelectItem value="whop_invoice">Official Whop invoice (numbered, with PDF)</SelectItem>
            </SelectContent>
          </Select>
          <FieldDescription>Can be changed on each invoice. Whop invoices need a verified Whop business account.</FieldDescription>
        </Field>
        <div className="flex items-start justify-between gap-4 rounded-xl border p-4 sm:col-span-2">
          <Label htmlFor="allowLifetime" className="grid gap-1 font-normal">
            <span className="text-sm font-medium">Allow lifetime access</span>
            <span className="text-xs text-muted-foreground">Offer &ldquo;Lifetime&rdquo; on one-time invoices.</span>
          </Label>
          <Switch id="allowLifetime" checked={Boolean(v.allowLifetime)} onCheckedChange={(c) => set("allowLifetime", c)} />
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border bg-card p-5 shadow-card sm:grid-cols-2">
        <h2 className="text-base font-semibold sm:col-span-2">Access and team</h2>
        {num("invitationTtlDays", "invitationTtlDays", "Invitation link lifetime (days)", "For employee invitations and account activation links.")}
        {num("packageExpiryReminderDays", "packageExpiryReminderDays", "Package ending reminder (days before)", "Emails the company contact or customer once.")}
        {num("defaultGraceDays", "defaultGraceDays", "Default grace period (days)", "Access kept after a failed renewal.")}
      </section>

      <section className="grid gap-4 rounded-2xl border bg-card p-5 shadow-card sm:grid-cols-2">
        <h2 className="text-base font-semibold sm:col-span-2">Refunds and disputes</h2>
        {policy(
          "refundFullPolicy",
          "refundFullPolicy",
          "After a full refund",
          [
            { value: "revoke", label: "Revoke access" },
            { value: "suspend", label: "Suspend access" },
            { value: "keep", label: "Keep access" },
          ],
          "Applies to the whole package (all company members).",
        )}
        {policy(
          "refundPartialPolicy",
          "refundPartialPolicy",
          "After a partial refund",
          [
            { value: "keep", label: "Keep access" },
            { value: "suspend", label: "Suspend access" },
            { value: "revoke", label: "Revoke access" },
          ],
          "Partial refunds are often goodwill credits.",
        )}
        {policy(
          "disputePolicy",
          "disputePolicy",
          "While a payment is disputed",
          [
            { value: "suspend", label: "Suspend access" },
            { value: "keep", label: "Keep access" },
          ],
          "A lost chargeback always revokes access; a won dispute restores it.",
        )}
      </section>

      <div>
        <Button type="submit" disabled={pending}>
          Save invoice settings
        </Button>
      </div>
    </form>
  );
}
