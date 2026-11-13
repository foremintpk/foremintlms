"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useTransition } from "react";
import { Input } from "@/components/ui/input";

function Inner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const set = (key: "from" | "to", value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };
  return (
    <div className="flex items-center gap-2 text-sm">
      <label className="sr-only" htmlFor="range-from">
        From date
      </label>
      <Input id="range-from" type="date" className="h-9 w-[9.5rem]" value={params.get("from") ?? ""} onChange={(e) => set("from", e.target.value)} />
      <span className="text-muted-foreground">to</span>
      <label className="sr-only" htmlFor="range-to">
        To date
      </label>
      <Input id="range-to" type="date" className="h-9 w-[9.5rem]" value={params.get("to") ?? ""} onChange={(e) => set("to", e.target.value)} />
    </div>
  );
}

/** Date range (from/to, inclusive) written to the URL for server-side filtering. */
export function DateRangeFilter() {
  return (
    <Suspense fallback={<div className="h-9 w-80" />}>
      <Inner />
    </Suspense>
  );
}
