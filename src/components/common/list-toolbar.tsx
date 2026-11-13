"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export interface ToolbarFilter {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

function ToolbarInner({
  searchPlaceholder,
  filters,
  children,
}: {
  searchPlaceholder?: string;
  filters?: ToolbarFilter[];
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (!v || v === "all") next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {searchPlaceholder !== undefined ? (
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={q}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-9 pr-8 pl-8"
            onChange={(e) => {
              const value = e.target.value;
              setQ(value);
              if (timer.current) clearTimeout(timer.current);
              timer.current = setTimeout(() => update({ q: value.trim() || null }), 350);
            }}
          />
          {q ? (
            <button
              type="button"
              aria-label="Clear search"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setQ("");
                update({ q: null });
              }}
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}
      {filters?.map((f) => (
        <Select key={f.key} value={params.get(f.key) ?? "all"} onValueChange={(v) => update({ [f.key]: v })}>
          <SelectTrigger className="h-9 w-full sm:w-44" aria-label={f.label}>
            <SelectValue placeholder={f.label} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All {f.label.toLowerCase()}</SelectItem>
            {f.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
      <div className={cn("flex items-center gap-2 sm:ml-auto")}>
        {pending ? <Spinner className="size-4 text-muted-foreground" /> : null}
        {children}
      </div>
    </div>
  );
}

/** Search box and filter selects that write to the URL; the server page reads them. */
export function ListToolbar(props: { searchPlaceholder?: string; filters?: ToolbarFilter[]; children?: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="mb-4 h-9" />}>
      <ToolbarInner {...props} />
    </Suspense>
  );
}
