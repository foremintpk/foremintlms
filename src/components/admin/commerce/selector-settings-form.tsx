"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAction } from "@/hooks/use-action";
import { DURATION_PRESETS, durationLabel, sortDurations, type SelectorSettings } from "@/lib/domain/commerce";
import { INVOICE_CURRENCIES } from "@/lib/domain/invoicing";
import { saveSelectorSettingsAction } from "@/app/admin/pricing/public/actions";

/** Admin → Public course pricing → settings for /courses/select. */
export function SelectorSettingsForm({ initial, linkTtlHours }: { initial: SelectorSettings; linkTtlHours: number }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [durations, setDurations] = useState<string[]>(sortDurations(initial.durations));
  const [defaultDuration, setDefaultDuration] = useState(initial.default_duration);
  const [currency, setCurrency] = useState(initial.currency);
  const [maxCourses, setMaxCourses] = useState(String(initial.max_courses));
  const [ttl, setTtl] = useState(String(linkTtlHours));
  const [custom, setCustom] = useState("");
  const { run, pending, fieldErrors, error } = useAction(saveSelectorSettingsAction, { onSuccess: () => router.refresh() });
  const err = (k: string) => {
    const m = fieldErrors[k]?.[0] ?? fieldErrors[`selector.${k}`]?.[0];
    return m ? <FieldError>{m}</FieldError> : null;
  };
  const options = sortDurations([...DURATION_PRESETS, ...durations]);

  function toggle(key: string, on: boolean) {
    const next = on ? sortDurations([...durations, key]) : durations.filter((d) => d !== key);
    setDurations(next);
    if (!next.includes(defaultDuration) && next.length) setDefaultDuration(next[0]);
  }

  function addCustom() {
    const days = Number.parseInt(custom, 10);
    if (!Number.isInteger(days) || days < 1 || days > 3650) return;
    toggle(String(days), true);
    setCustom("");
  }

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        void run({
          selector: { enabled, durations, default_duration: defaultDuration, currency, max_courses: Number.parseInt(maxCourses || "0", 10) || 0 },
          linkTtlHours: Number.parseInt(ttl || "72", 10),
        });
      }}
    >
      <label className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
        <span>
          <span className="block text-sm font-medium">Sell course packages on the website</span>
          <span className="block text-xs text-muted-foreground">Build your learning plan, guest checkout and the course advisor&apos;s payment links.</span>
        </span>
        <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Sell course packages" />
      </label>

      <Field>
        <FieldLabel>Access periods offered</FieldLabel>
        <FieldDescription>Visitors pick one period for the whole package. A period appears only once at least one course has a price for it.</FieldDescription>
        <div className="flex flex-wrap gap-2">
          {options.map((key) => (
            <label key={key} className="flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-muted/50">
              <Checkbox checked={durations.includes(key)} onCheckedChange={(v) => toggle(key, v === true)} />
              {durationLabel(key)}
              {!DURATION_PRESETS.includes(key) ? (
                <button type="button" onClick={() => toggle(key, false)} className="text-muted-foreground hover:text-foreground" aria-label={`Remove ${durationLabel(key)}`}>
                  <X className="size-3.5" />
                </button>
              ) : null}
            </label>
          ))}
          <span className="flex items-center gap-1.5">
            <Input value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Custom days" className="h-9 w-32" aria-label="Custom number of days" />
            <Button type="button" variant="outline" size="sm" onClick={addCustom} disabled={!custom}>
              <Plus aria-hidden /> Add
            </Button>
          </span>
        </div>
        {err("durations")}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field>
          <FieldLabel htmlFor="sel-default">Default period</FieldLabel>
          <Select value={defaultDuration} onValueChange={setDefaultDuration}>
            <SelectTrigger id="sel-default">
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
          <FieldDescription>Falls back to the first period with prices.</FieldDescription>
          {err("default_duration")}
        </Field>
        <Field>
          <FieldLabel htmlFor="sel-currency">Currency</FieldLabel>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger id="sel-currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INVOICE_CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.code.toUpperCase()} · {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>Only prices in this currency are offered.</FieldDescription>
          {err("currency")}
        </Field>
        <Field>
          <FieldLabel htmlFor="sel-max">Courses per order</FieldLabel>
          <Input id="sel-max" inputMode="numeric" value={maxCourses} onChange={(e) => setMaxCourses(e.target.value.replace(/\D/g, ""))} />
          <FieldDescription>0 = no limit.</FieldDescription>
          {err("max_courses")}
        </Field>
        <Field>
          <FieldLabel htmlFor="sel-ttl">Payment link valid for (hours)</FieldLabel>
          <Input id="sel-ttl" inputMode="numeric" value={ttl} onChange={(e) => setTtl(e.target.value.replace(/\D/g, ""))} />
          <FieldDescription>Unpaid links close after this (1–720).</FieldDescription>
          {err("linkTtlHours")}
        </Field>
      </div>

      {error && !Object.keys(fieldErrors).length ? <p className="text-sm text-destructive">{error}</p> : null}
      <div>
        <Button type="submit" disabled={pending || durations.length === 0}>
          {pending ? "Saving…" : "Save selector settings"}
        </Button>
      </div>
    </form>
  );
}
