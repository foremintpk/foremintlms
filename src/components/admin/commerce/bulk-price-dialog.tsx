"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAction } from "@/hooks/use-action";
import { durationLabel, type DurationKey } from "@/lib/domain/commerce";
import { parseAmountToMinor } from "@/lib/domain/invoicing";
import { setPeriodPricesAction } from "@/app/admin/pricing/public/actions";
import { cn } from "@/lib/utils";

/**
 * Price an access period for every paid course in one go — e.g. add a
 * 30-day or 40-day option at a fixed price, or at a percentage of each
 * course's 90-day price. Results are ordinary per-course prices.
 */
export function BulkPriceDialog({ durations, currency }: { durations: DurationKey[]; currency: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [duration, setDuration] = useState<DurationKey>(durations[0] ?? "30");
  const [mode, setMode] = useState<"fixed" | "percent">("percent");
  const [price, setPrice] = useState("");
  const [percent, setPercent] = useState("60");
  const [source, setSource] = useState<DurationKey>(durations.find((d) => d !== durations[0]) ?? durations[0] ?? "90");
  const [rounding, setRounding] = useState<"exact" | "whole" | "ninety_nine">("whole");
  const [overwrite, setOverwrite] = useState(false);
  const { run, pending, fieldErrors } = useAction(setPeriodPricesAction, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });
  const err = (k: string) => (fieldErrors[k]?.[0] ? <FieldError>{fieldErrors[k][0]}</FieldError> : null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={durations.length === 0} data-testid="bulk-price-open">
          <Wand2 aria-hidden /> Set prices for a period
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Set prices for an access period</DialogTitle>
          <DialogDescription>Fill in one period for every paid course. You can still change any course&apos;s price afterwards.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run({
              duration,
              mode,
              priceMinor: mode === "fixed" ? (parseAmountToMinor(price, currency) ?? undefined) : undefined,
              percent: mode === "percent" ? Number(percent) : undefined,
              sourceDuration: mode === "percent" ? source : undefined,
              rounding,
              overwrite,
            });
          }}
        >
          <Field>
            <FieldLabel>Access period to price</FieldLabel>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {durations.map((d) => (
                  <SelectItem key={d} value={d}>
                    {durationLabel(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>To add a new period (for example 40 days), add it under Selector settings first.</FieldDescription>
            {err("duration")}
          </Field>

          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="How to set the prices">
            {([
              ["percent", "Based on another period", "e.g. 60% of the 90-day price"],
              ["fixed", "Same price for all", "One price for every course"],
            ] as const).map(([value, title, hint]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={mode === value}
                onClick={() => setMode(value)}
                className={cn("rounded-xl border p-3 text-left text-sm transition-colors", mode === value ? "border-primary bg-brand-soft/60" : "hover:bg-muted")}
              >
                <span className="block font-semibold">{title}</span>
                <span className="text-xs text-muted-foreground">{hint}</span>
              </button>
            ))}
          </div>

          {mode === "fixed" ? (
            <Field>
              <FieldLabel htmlFor="bulk-price">Price ({currency.toUpperCase()})</FieldLabel>
              <Input id="bulk-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="20.00" />
              {err("priceMinor")}
            </Field>
          ) : (
            <div className="grid grid-cols-[120px_1fr] gap-3">
              <Field>
                <FieldLabel htmlFor="bulk-percent">Percent</FieldLabel>
                <Input id="bulk-percent" inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value.replace(/[^\d.]/g, ""))} />
                {err("percent")}
              </Field>
              <Field>
                <FieldLabel>Of each course&apos;s price for</FieldLabel>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {durations
                      .filter((d) => d !== duration)
                      .map((d) => (
                        <SelectItem key={d} value={d}>
                          {durationLabel(d)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {err("sourceDuration")}
              </Field>
            </div>
          )}

          <Field>
            <FieldLabel>Rounding</FieldLabel>
            <Select value={rounding} onValueChange={(v) => setRounding(v as typeof rounding)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whole">Whole amounts (29.00)</SelectItem>
                <SelectItem value="ninety_nine">Ending in .99 (28.99)</SelectItem>
                <SelectItem value="exact">Exact (29.40)</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={overwrite} onCheckedChange={(v) => setOverwrite(v === true)} className="mt-0.5" />
            <span>
              Replace prices already set for this period
              <span className="block text-xs text-muted-foreground">Off: only courses without a price for this period are filled in.</span>
            </span>
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending} data-testid="bulk-price-submit">
              {pending ? "Setting prices…" : `Set ${durationLabel(duration).toLowerCase()} prices`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
