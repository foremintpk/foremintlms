"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAction, type ClientActionResult } from "@/hooks/use-action";
import { parseAmountToMinor } from "@/lib/domain/invoicing";

type AppliesTo = "all" | "plans" | "packages";

const WHERE: Record<AppliesTo, { label: string; help: string }> = {
  packages: {
    label: "Course packages",
    help: "Build your learning plan, guest checkout and the course advisor. Foremint applies the discount before the exact total is sent to Whop; the code is never created on Whop.",
  },
  plans: { label: "Single plans (Whop checkout)", help: "Created as a Whop promo code. Buyers enter it on Whop's checkout page when buying a single plan." },
  all: { label: "Both", help: "Works on course packages and as a Whop promo code on single-plan checkouts." },
};

export function CreateCouponDialog({
  plans,
  courses,
  create,
  defaultCurrency,
}: {
  plans: { id: string; label: string; whop_plan_id: string | null }[];
  courses: { id: string; title: string }[];
  create: (input: unknown) => Promise<ClientActionResult<{ couponId: string }>>;
  defaultCurrency: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [max, setMax] = useState("");
  const [expires, setExpires] = useState("");
  const [starts, setStarts] = useState("");
  const [planIds, setPlanIds] = useState<string[]>([]);
  const [newOnly, setNewOnly] = useState(false);
  const [appliesTo, setAppliesTo] = useState<AppliesTo>("packages");
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [minSpend, setMinSpend] = useState("");
  const [perCustomer, setPerCustomer] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const { run, pending, fieldErrors } = useAction(create, {
    onSuccess: () => {
      setOpen(false);
      setCode("");
      setAmount("");
      setPlanIds([]);
      setCourseIds([]);
      setMinSpend("");
      setPerCustomer("");
      setStarts("");
      router.refresh();
    },
  });
  const err = (k: string) => (fieldErrors[k]?.[0] ? <FieldError>{fieldErrors[k][0]}</FieldError> : null);
  const packages = appliesTo !== "plans";
  const whop = appliesTo !== "packages";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> New coupon
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New coupon</DialogTitle>
          <DialogDescription>One code can discount course packages, single-plan Whop checkouts, or both.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setLocalError(null);
            const minCents = packages && minSpend.trim() ? parseAmountToMinor(minSpend, currency || defaultCurrency) : null;
            if (packages && minSpend.trim() && minCents === null) {
              setLocalError("Enter the minimum spend like 50 or 49.99");
              return;
            }
            void run({
              code: code.trim(),
              description: description.trim() || null,
              discount_type: type,
              amount: Number(amount),
              currency: type === "fixed" ? currency.trim().toLowerCase() : null,
              max_redemptions: max.trim() ? Number.parseInt(max, 10) : null,
              expires_at: expires ? new Date(expires).toISOString() : null,
              starts_at: !whop && starts ? new Date(starts).toISOString() : null,
              plan_ids: whop ? planIds : [],
              new_customers_only: newOnly,
              applies_to: appliesTo,
              course_ids: packages ? courseIds : [],
              min_subtotal_cents: minCents,
              max_redemptions_per_customer: packages && perCustomer.trim() ? Number.parseInt(perCustomer, 10) : null,
            });
          }}
        >
          <Field>
            <FieldLabel htmlFor="coupon-code">Code</FieldLabel>
            <Input id="coupon-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="LAUNCH20" maxLength={40} className="font-mono uppercase" />
            {err("code")}
          </Field>
          <Field>
            <FieldLabel htmlFor="coupon-where">Where it works</FieldLabel>
            <Select value={appliesTo} onValueChange={(v) => setAppliesTo(v as AppliesTo)}>
              <SelectTrigger id="coupon-where">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(WHERE) as AppliesTo[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {WHERE[k].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>{WHERE[appliesTo].help}</FieldDescription>
            {err("applies_to")}
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="coupon-type">Discount</FieldLabel>
              <Select value={type} onValueChange={(v) => setType(v as "percent" | "fixed")}>
                <SelectTrigger id="coupon-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percentage</SelectItem>
                  <SelectItem value="fixed">Fixed amount</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="coupon-amount">{type === "percent" ? "Percent off" : "Amount off"}</FieldLabel>
              <Input id="coupon-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={type === "percent" ? "20" : "10.00"} />
              {err("amount")}
            </Field>
            {type === "fixed" ? (
              <Field>
                <FieldLabel htmlFor="coupon-currency">Currency</FieldLabel>
                <Input id="coupon-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} className="uppercase" />
                {err("currency")}
              </Field>
            ) : null}
          </div>
          <Field>
            <FieldLabel htmlFor="coupon-description">Internal note</FieldLabel>
            <Input id="coupon-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} placeholder="Launch week promotion" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="coupon-max">Uses allowed</FieldLabel>
              <Input id="coupon-max" inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} placeholder="Unlimited" />
              {err("max_redemptions")}
            </Field>
            {packages ? (
              <Field>
                <FieldLabel htmlFor="coupon-per-customer">Uses per student email</FieldLabel>
                <Input id="coupon-per-customer" inputMode="numeric" value={perCustomer} onChange={(e) => setPerCustomer(e.target.value.replace(/\D/g, ""))} placeholder="Unlimited" />
                {err("max_redemptions_per_customer")}
              </Field>
            ) : null}
            {!whop ? (
              <Field>
                <FieldLabel htmlFor="coupon-starts">Starts</FieldLabel>
                <Input id="coupon-starts" type="datetime-local" value={starts} onChange={(e) => setStarts(e.target.value)} />
                {err("starts_at")}
              </Field>
            ) : null}
            <Field>
              <FieldLabel htmlFor="coupon-expires">Expires</FieldLabel>
              <Input id="coupon-expires" type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} />
              {err("expires_at")}
            </Field>
            {packages ? (
              <Field>
                <FieldLabel htmlFor="coupon-min">Minimum package total</FieldLabel>
                <Input id="coupon-min" inputMode="decimal" value={minSpend} onChange={(e) => setMinSpend(e.target.value)} placeholder="None" />
                {err("min_subtotal_cents")}
              </Field>
            ) : null}
          </div>
          {packages ? (
            <Field>
              <FieldLabel>Limit to courses</FieldLabel>
              <FieldDescription>Course packages only. Leave empty to discount every course; otherwise only these courses are discounted.</FieldDescription>
              <ul className="max-h-48 divide-y overflow-y-auto rounded-xl border">
                {courses.map((c) => (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50">
                      <Checkbox checked={courseIds.includes(c.id)} onCheckedChange={(v) => setCourseIds(v === true ? [...courseIds, c.id] : courseIds.filter((id) => id !== c.id))} />
                      <span className="flex-1 truncate">{c.title}</span>
                    </label>
                  </li>
                ))}
                {courses.length === 0 ? <li className="px-3 py-3 text-sm text-muted-foreground">No published courses yet.</li> : null}
              </ul>
              {err("course_ids")}
            </Field>
          ) : null}
          {whop ? (
            <Field>
              <FieldLabel>Limit to plans</FieldLabel>
              <FieldDescription>Leave empty to allow the code on every plan.</FieldDescription>
              <ul className="max-h-48 divide-y overflow-y-auto rounded-xl border">
                {plans.map((p) => (
                  <li key={p.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50">
                      <Checkbox checked={planIds.includes(p.id)} onCheckedChange={(v) => setPlanIds(v === true ? [...planIds, p.id] : planIds.filter((id) => id !== p.id))} />
                      <span className="flex-1 truncate">{p.label}</span>
                      {!p.whop_plan_id ? <span className="text-xs text-muted-foreground">Not synced</span> : null}
                    </label>
                  </li>
                ))}
                {plans.length === 0 ? <li className="px-3 py-3 text-sm text-muted-foreground">No paid plans yet.</li> : null}
              </ul>
              {err("plan_ids")}
            </Field>
          ) : null}
          <label className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
            <span className="text-sm font-medium">New customers only</span>
            <Switch checked={newOnly} onCheckedChange={setNewOnly} aria-label="New customers only" />
          </label>
          {localError ? <p className="text-sm text-destructive">{localError}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create coupon"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
