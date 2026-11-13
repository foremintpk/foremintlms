"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useTransition } from "react";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

const PRESETS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
  { value: "custom", label: "Custom range" },
];

function Inner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const current = params.get("range") ?? "30d";
  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState(params.get("to") ?? "");
  const [open, setOpen] = useState(false);

  const apply = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  return (
    <div className="flex items-center gap-2">
      {pending ? <Spinner className="size-4 text-muted-foreground" /> : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div>
          <Select
            value={current}
            onValueChange={(v) => {
              if (v === "custom") setOpen(true);
              else apply({ range: v, from: null, to: null });
            }}
          >
            <SelectTrigger className="h-9 w-44" aria-label="Date range">
              <CalendarRange className="size-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {PRESETS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          </div>
        </PopoverAnchor>
        <PopoverContent align="end" className="w-72">
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (from && to && to >= from) {
                apply({ range: "custom", from, to });
                setOpen(false);
              }
            }}
          >
            <label className="grid gap-1 text-sm">
              From
              <Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} required />
            </label>
            <label className="grid gap-1 text-sm">
              To
              <Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} required />
            </label>
            <Button type="submit" size="sm" disabled={!from || !to || to < from}>
              Apply range
            </Button>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Date-range control that writes ?range= (or ?range=custom&from=&to=) to the URL. */
export function DateRangeFilter() {
  return (
    <Suspense fallback={<div className="h-9 w-44 rounded-lg border" />}>
      <Inner />
    </Suspense>
  );
}
