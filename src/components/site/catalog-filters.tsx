"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useTrackedTransition } from "@/hooks/use-tracked-transition";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Option {
  value: string;
  label: string;
}

const LEVELS: Option[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "all_levels", label: "All levels" },
];

const PRICES: Option[] = [
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
];

const SORTS: Option[] = [
  { value: "featured", label: "Featured first" },
  { value: "newest", label: "Newest" },
  { value: "title", label: "Title A–Z" },
];

function FilterSelect({
  label,
  value,
  options,
  allLabel,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  allLabel?: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-11 w-full rounded-xl bg-card sm:w-48" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {allLabel ? <SelectItem value="all">{allLabel}</SelectItem> : null}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Filters({ categories }: { categories: Option[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTrackedTransition({ progress: true });
  const [q, setQ] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (!v || v === "all" || (k === "sort" && v === "featured")) next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    const s = next.toString();
    startTransition(() => router.replace(`${pathname}${s ? `?${s}` : ""}`, { scroll: false }));
  };

  return (
    <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-center" role="search">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={q}
          aria-label="Search courses"
          placeholder="Search courses"
          className="h-11 rounded-xl bg-card pr-10 pl-10"
          onChange={(e) => {
            const value = e.target.value;
            setQ(value);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => update({ q: value.trim() || null }), 350);
          }}
        />
        {pending ? (
          <Loader2 className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Updating results" />
        ) : q ? (
          <button
            type="button"
            className="absolute top-1/2 right-3 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
            onClick={() => {
              setQ("");
              update({ q: null });
            }}
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
        <FilterSelect label="Category" value={params.get("category") ?? "all"} options={categories} allLabel="All subjects" onChange={(v) => update({ category: v })} />
        <FilterSelect label="Level" value={params.get("level") ?? "all"} options={LEVELS} allLabel="Any level" onChange={(v) => update({ level: v })} />
        <FilterSelect label="Price" value={params.get("price") ?? "all"} options={PRICES} allLabel="Any price" onChange={(v) => update({ price: v })} />
        <FilterSelect label="Sort by" value={params.get("sort") ?? "featured"} options={SORTS} onChange={(v) => update({ sort: v })} />
      </div>
    </div>
  );
}

/** Search and filters write to the URL; the server renders matching results. */
export function CatalogFilters({ categories }: { categories: Option[] }) {
  return (
    <Suspense fallback={<div className="mb-8 h-11" />}>
      <Filters categories={categories} />
    </Suspense>
  );
}
