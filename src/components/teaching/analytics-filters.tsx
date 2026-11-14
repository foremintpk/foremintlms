"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useTrackedTransition } from "@/hooks/use-tracked-transition";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { RANGES } from "./analytics-ranges";

function Filters({ courses }: { courses: { id: string; title: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTrackedTransition({ progress: true });

  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };

  return (
    <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center">
      <Select value={params.get("range") ?? "30d"} onValueChange={(v) => update("range", v === "30d" ? null : v)}>
        <SelectTrigger className="h-9 w-full sm:w-44" aria-label="Date range">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RANGES.map((r) => (
            <SelectItem key={r.value} value={r.value}>
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={params.get("course") ?? "all"} onValueChange={(v) => update("course", v === "all" ? null : v)}>
        <SelectTrigger className="h-9 w-full sm:w-72" aria-label="Course">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All my courses</SelectItem>
          {courses.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {pending ? <Spinner className="size-4 text-muted-foreground" /> : null}
    </div>
  );
}

/** Date range and course filters (one row, above the charts). */
export function AnalyticsFilters(props: { courses: { id: string; title: string }[] }) {
  return (
    <Suspense fallback={<div className="mb-6 h-9" />}>
      <Filters {...props} />
    </Suspense>
  );
}
