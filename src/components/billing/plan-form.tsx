"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAction, type ClientActionResult } from "@/hooks/use-action";
import type { PlanRow } from "@/lib/services/payments/types";

type PlanType = "free" | "one_time" | "recurring";

const ACCESS_PRESETS = [
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "6 months" },
  { value: "365", label: "1 year" },
  { value: "lifetime", label: "Lifetime" },
  { value: "custom", label: "Custom number of days" },
];

const BILLING_PRESETS = [
  { value: "30", label: "Monthly" },
  { value: "90", label: "Every 3 months" },
  { value: "365", label: "Yearly" },
  { value: "custom", label: "Custom interval" },
];

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function centsToInput(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? "" : (cents / 100).toFixed(2);
}

function inputToCents(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value.replace(/,/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

function presetFor(days: number | null | undefined, presets: { value: string }[], emptyValue: string) {
  if (days === null || days === undefined) return emptyValue;
  return presets.some((p) => p.value === String(days)) ? String(days) : "custom";
}

export function PlanFormDialog({
  trigger,
  plan,
  defaultCurrency = "usd",
  submit,
  title,
}: {
  trigger: React.ReactNode;
  plan?: PlanRow;
  defaultCurrency?: string;
  submit: (input: { plan: unknown }) => Promise<ClientActionResult<unknown>>;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(plan?.name ?? "");
  const [description, setDescription] = useState(plan?.description ?? "");
  const [type, setType] = useState<PlanType>(plan?.plan_type ?? "one_time");
  const [currency, setCurrency] = useState(plan?.currency ?? defaultCurrency);
  const [price, setPrice] = useState(centsToInput(plan?.price_cents ?? null));
  const [compareAt, setCompareAt] = useState(centsToInput(plan?.compare_at_price_cents));
  const [accessPreset, setAccessPreset] = useState(presetFor(plan?.access_duration_days, ACCESS_PRESETS, plan ? "lifetime" : "lifetime"));
  const [accessDays, setAccessDays] = useState(plan?.access_duration_days ? String(plan.access_duration_days) : "");
  const [billingPreset, setBillingPreset] = useState(presetFor(plan?.billing_period_days, BILLING_PRESETS, "30"));
  const [billingDays, setBillingDays] = useState(plan?.billing_period_days ? String(plan.billing_period_days) : "");
  const [trialDays, setTrialDays] = useState(plan?.trial_days ? String(plan.trial_days) : "");
  const [graceDays, setGraceDays] = useState(String(plan?.grace_period_days ?? 3));
  const [stock, setStock] = useState(plan?.stock_limit !== null && plan?.stock_limit !== undefined ? String(plan.stock_limit) : "");
  const [from, setFrom] = useState(toLocalInput(plan?.available_from));
  const [until, setUntil] = useState(toLocalInput(plan?.available_until));
  const [promo, setPromo] = useState(plan?.promo_label ?? "");
  const [visibility, setVisibility] = useState<"public" | "hidden" | "archived">(plan?.visibility ?? "public");
  const [featured, setFeatured] = useState(plan?.is_featured ?? false);

  const { run, pending, fieldErrors, setFieldErrors } = useAction(submit, { onSuccess: () => setOpen(false) });
  const err = (key: string) => (fieldErrors[key]?.length ? <FieldError>{fieldErrors[key][0]}</FieldError> : null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const priceCents = type === "free" ? 0 : inputToCents(price);
    const compareCents = inputToCents(compareAt);
    const local: Record<string, string[]> = {};
    if (type !== "free" && (priceCents === null || Number.isNaN(priceCents))) local.price_cents = ["Enter a price, e.g. 49.00"];
    if (compareCents !== null && Number.isNaN(compareCents)) local.compare_at_price_cents = ["Enter a number, e.g. 99.00"];
    if (Object.keys(local).length) {
      setFieldErrors(local);
      return;
    }
    const intOrNull = (v: string) => (v.trim() === "" ? null : Number.parseInt(v, 10));
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      plan_type: type,
      currency: currency.trim().toLowerCase(),
      price_cents: priceCents ?? 0,
      compare_at_price_cents: compareCents,
      access_duration_days:
        type === "recurring" ? null : accessPreset === "lifetime" ? null : accessPreset === "custom" ? intOrNull(accessDays) : Number(accessPreset),
      billing_period_days: type === "recurring" ? (billingPreset === "custom" ? intOrNull(billingDays) : Number(billingPreset)) : null,
      trial_days: type === "recurring" ? intOrNull(trialDays) : null,
      grace_period_days: intOrNull(graceDays) ?? 0,
      stock_limit: intOrNull(stock),
      available_from: fromLocalInput(from),
      available_until: fromLocalInput(until),
      promo_label: promo.trim() || null,
      visibility,
      is_featured: featured,
    };
    void run({ plan: payload });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Paid plans are sold through Whop. Prices are in major units (49.00 = 49 {currency.toUpperCase()}).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-5" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="plan-name">Plan name</FieldLabel>
              <Input id="plan-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Lifetime access" required />
              <FieldDescription>Shown to buyers. Whop shows the first 30 characters.</FieldDescription>
              {err("name")}
            </Field>
            <Field>
              <FieldLabel htmlFor="plan-type">Type</FieldLabel>
              <Select value={type} onValueChange={(v) => setType(v as PlanType)} disabled={Boolean(plan && plan.units_sold > 0)}>
                <SelectTrigger id="plan-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_time">One-time payment</SelectItem>
                  <SelectItem value="recurring">Subscription</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                </SelectContent>
              </Select>
              {plan && plan.units_sold > 0 ? <FieldDescription>Type is locked because this plan has buyers.</FieldDescription> : null}
              {err("plan_type")}
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="plan-description">Description</FieldLabel>
            <Textarea id="plan-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={500} />
            {err("description")}
          </Field>

          {type !== "free" ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="plan-price">{type === "recurring" ? "Price per period" : "Price"}</FieldLabel>
                <Input id="plan-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="49.00" />
                {err("price_cents")}
              </Field>
              <Field>
                <FieldLabel htmlFor="plan-compare">Original price</FieldLabel>
                <Input id="plan-compare" inputMode="decimal" value={compareAt} onChange={(e) => setCompareAt(e.target.value)} placeholder="Optional" />
                <FieldDescription>Shown struck through.</FieldDescription>
                {err("compare_at_price_cents")}
              </Field>
              <Field>
                <FieldLabel htmlFor="plan-currency">Currency</FieldLabel>
                <Input id="plan-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} className="uppercase" />
                {err("currency")}
              </Field>
            </div>
          ) : null}

          {type === "recurring" ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="plan-interval">Billing interval</FieldLabel>
                <Select value={billingPreset} onValueChange={setBillingPreset}>
                  <SelectTrigger id="plan-interval">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BILLING_PRESETS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {billingPreset === "custom" ? (
                  <Input inputMode="numeric" value={billingDays} onChange={(e) => setBillingDays(e.target.value)} placeholder="Days, e.g. 14" aria-label="Interval in days" />
                ) : null}
                {err("billing_period_days")}
              </Field>
              <Field>
                <FieldLabel htmlFor="plan-trial">Free trial (days)</FieldLabel>
                <Input id="plan-trial" inputMode="numeric" value={trialDays} onChange={(e) => setTrialDays(e.target.value)} placeholder="None" />
                {err("trial_days")}
              </Field>
              <Field>
                <FieldLabel htmlFor="plan-grace">Grace period (days)</FieldLabel>
                <Input id="plan-grace" inputMode="numeric" value={graceDays} onChange={(e) => setGraceDays(e.target.value)} />
                <FieldDescription>Access kept after a missed renewal.</FieldDescription>
                {err("grace_period_days")}
              </Field>
            </div>
          ) : (
            <Field>
              <FieldLabel htmlFor="plan-access">Access length</FieldLabel>
              <div className="grid gap-2 sm:grid-cols-2">
                <Select value={accessPreset} onValueChange={setAccessPreset}>
                  <SelectTrigger id="plan-access">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCESS_PRESETS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {accessPreset === "custom" ? (
                  <Input inputMode="numeric" value={accessDays} onChange={(e) => setAccessDays(e.target.value)} placeholder="Days, e.g. 120" aria-label="Access in days" />
                ) : null}
              </div>
              <FieldDescription>Counted from the day the payment is confirmed.</FieldDescription>
              {err("access_duration_days")}
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="plan-from">Available from</FieldLabel>
              <Input id="plan-from" type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
              {err("available_from")}
            </Field>
            <Field>
              <FieldLabel htmlFor="plan-until">Available until</FieldLabel>
              <Input id="plan-until" type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} />
              <FieldDescription>For early-bird and limited-time offers.</FieldDescription>
              {err("available_until")}
            </Field>
            <Field>
              <FieldLabel htmlFor="plan-stock">Places available</FieldLabel>
              <Input id="plan-stock" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="Unlimited" />
              {plan && plan.units_sold > 0 ? <FieldDescription>{plan.units_sold} sold so far.</FieldDescription> : null}
              {err("stock_limit")}
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="plan-promo">Promo label</FieldLabel>
              <Input id="plan-promo" value={promo} onChange={(e) => setPromo(e.target.value)} maxLength={60} placeholder="e.g. Early-bird price" />
              {err("promo_label")}
            </Field>
            <Field>
              <FieldLabel htmlFor="plan-visibility">Visibility</FieldLabel>
              <Select value={visibility} onValueChange={(v) => setVisibility(v as typeof visibility)}>
                <SelectTrigger id="plan-visibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public — listed on the site</SelectItem>
                  <SelectItem value="hidden">Hidden — direct link only</SelectItem>
                  <SelectItem value="archived">Archived — not for sale</SelectItem>
                </SelectContent>
              </Select>
              {err("visibility")}
            </Field>
          </div>

          <label className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
            <span>
              <span className="block text-sm font-medium">Highlight this plan</span>
              <span className="block text-xs text-muted-foreground">Shown as the recommended option.</span>
            </span>
            <Switch checked={featured} onCheckedChange={setFeatured} aria-label="Highlight this plan" />
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : plan ? "Save plan" : "Create plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
