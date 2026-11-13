"use client";

import { useId, useState } from "react";
import { GripVertical, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/** Label + control + hint + error, consistently spaced. */
export function FormRow({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
  optional,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string | string[];
  children: React.ReactNode;
  className?: string;
  optional?: boolean;
}) {
  const message = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {optional ? <span className="font-normal text-muted-foreground"> (optional)</span> : null}
      </Label>
      {children}
      {message ? (
        <p role="alert" className="text-xs text-destructive">
          {message}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function SwitchRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  description?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border bg-card px-4 py-3">
      <div className="grid gap-0.5">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} className="mt-0.5" />
    </div>
  );
}

/** Editable list of short strings (outcomes, requirements, audience, tags). */
export function ListEditor({
  value,
  onChange,
  placeholder,
  max = 20,
  maxLength = 240,
  addLabel = "Add item",
  disabled,
  ariaLabel,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  max?: number;
  maxLength?: number;
  addLabel?: string;
  disabled?: boolean;
  ariaLabel: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v || value.length >= max) return;
    onChange([...value, v.slice(0, maxLength)]);
    setDraft("");
  };
  return (
    <div className="grid gap-2">
      {value.length > 0 ? (
        <ul className="grid gap-1.5" aria-label={ariaLabel}>
          {value.map((item, i) => (
            <li key={`${i}-${item}`} className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 text-sm">
              <GripVertical className="size-3.5 shrink-0 text-muted-foreground/50" aria-hidden />
              <Input
                value={item}
                maxLength={maxLength}
                disabled={disabled}
                aria-label={`${ariaLabel} ${i + 1}`}
                className="h-7 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))}
              />
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                aria-label={`Remove ${item}`}
                disabled={disabled}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {value.length < max ? (
        <div className="flex gap-2">
          <Input
            value={draft}
            placeholder={placeholder}
            maxLength={maxLength}
            disabled={disabled}
            aria-label={`New ${ariaLabel.toLowerCase()}`}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={add} disabled={disabled || !draft.trim()}>
            <Plus /> {addLabel}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">You’ve reached the limit of {max}.</p>
      )}
    </div>
  );
}

/** Integer input that reports `null` when empty. */
export function NumberField({
  id,
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder,
  disabled,
  suffix,
}: {
  id?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  disabled?: boolean;
  suffix?: string;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value ?? ""}
        placeholder={placeholder}
        disabled={disabled}
        className={suffix ? "pr-16" : undefined}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return onChange(null);
          const n = Number(raw);
          if (!Number.isNaN(n)) onChange(n);
        }}
      />
      {suffix ? (
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>
      ) : null}
    </div>
  );
}

/** ISO (UTC) ⇄ <input type="datetime-local"> in the author's local time. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function DateTimeField({
  id,
  value,
  onChange,
  disabled,
}: {
  id?: string;
  value: string | null;
  onChange: (iso: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        id={id}
        type="datetime-local"
        value={isoToLocalInput(value)}
        disabled={disabled}
        onChange={(e) => onChange(localInputToIso(e.target.value))}
        className="max-w-xs"
      />
      {value ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} disabled={disabled}>
          Clear
        </Button>
      ) : null}
    </div>
  );
}

export function ReadOnlyNotice() {
  return (
    <div className="mb-4 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
      You can view this course but not edit it. Ask an administrator for edit access.
    </div>
  );
}

/** Field error lookup for nested action fieldErrors. */
export function fieldError(errors: Record<string, string[]>, key: string): string | undefined {
  return errors[key]?.[0];
}

/**
 * Local state that resets whenever the server sends a new value (after a
 * save and refresh). Uses React's "adjust state while rendering" pattern
 * instead of an effect, so there is no extra render with stale data.
 */
export function useSyncedState<T>(value: T) {
  const [state, setState] = useState(value);
  const [previous, setPrevious] = useState(value);
  if (previous !== value) {
    setPrevious(value);
    setState(value);
  }
  return [state, setState] as const;
}
