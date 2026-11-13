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

export function CreateCouponDialog({
  plans,
  create,
  defaultCurrency,
}: {
  plans: { id: string; label: string; whop_plan_id: string | null }[];
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
  const [planIds, setPlanIds] = useState<string[]>([]);
  const [newOnly, setNewOnly] = useState(false);
  const { run, pending, fieldErrors } = useAction(create, {
    onSuccess: () => {
      setOpen(false);
      setCode("");
      setAmount("");
      setPlanIds([]);
      router.refresh();
    },
  });
  const err = (k: string) => (fieldErrors[k]?.[0] ? <FieldError>{fieldErrors[k][0]}</FieldError> : null);

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
          <DialogDescription>Buyers enter the code at Whop checkout. The discount applies to the first payment.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run({
              code: code.trim(),
              description: description.trim() || null,
              discount_type: type,
              amount: Number(amount),
              currency: type === "fixed" ? currency.trim().toLowerCase() : null,
              max_redemptions: max.trim() ? Number.parseInt(max, 10) : null,
              expires_at: expires ? new Date(expires).toISOString() : null,
              plan_ids: planIds,
              new_customers_only: newOnly,
            });
          }}
        >
          <Field>
            <FieldLabel htmlFor="coupon-code">Code</FieldLabel>
            <Input id="coupon-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="LAUNCH20" maxLength={40} className="font-mono uppercase" />
            {err("code")}
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
            <Field>
              <FieldLabel htmlFor="coupon-expires">Expires</FieldLabel>
              <Input id="coupon-expires" type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} />
              {err("expires_at")}
            </Field>
          </div>
          <Field>
            <FieldLabel>Limit to plans</FieldLabel>
            <FieldDescription>Leave empty to allow the code on every plan.</FieldDescription>
            <ul className="max-h-48 divide-y overflow-y-auto rounded-xl border">
              {plans.map((p) => (
                <li key={p.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50">
                    <Checkbox
                      checked={planIds.includes(p.id)}
                      onCheckedChange={(v) => setPlanIds(v === true ? [...planIds, p.id] : planIds.filter((id) => id !== p.id))}
                    />
                    <span className="flex-1 truncate">{p.label}</span>
                    {!p.whop_plan_id ? <span className="text-xs text-muted-foreground">Not synced</span> : null}
                  </label>
                </li>
              ))}
              {plans.length === 0 ? <li className="px-3 py-3 text-sm text-muted-foreground">No paid plans yet.</li> : null}
            </ul>
            {err("plan_ids")}
          </Field>
          <label className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
            <span className="text-sm font-medium">New customers only</span>
            <Switch checked={newOnly} onCheckedChange={setNewOnly} aria-label="New customers only" />
          </label>
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
