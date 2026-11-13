import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildQueryString } from "@/lib/list-params";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Server-rendered pagination that preserves the current filters. */
export function PaginationBar({
  basePath,
  searchParams,
  page,
  pageSize,
  total,
}: {
  basePath: string;
  searchParams: Record<string, string | string[] | undefined>;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const link = (p: number) => `${basePath}${buildQueryString(searchParams, { page: p === 1 ? null : p })}`;
  const btn =
    "inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-sm font-medium transition-colors hover:bg-muted aria-disabled:pointer-events-none aria-disabled:opacity-40";

  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
      <p>
        Showing <span className="font-medium text-foreground tabular-nums">{formatNumber(start)}</span>–
        <span className="font-medium text-foreground tabular-nums">{formatNumber(end)}</span> of{" "}
        <span className="font-medium text-foreground tabular-nums">{formatNumber(total)}</span>
      </p>
      <div className="flex items-center gap-2">
        <Link href={link(page - 1)} aria-disabled={page <= 1} className={cn(btn)} scroll={false}>
          <ChevronLeft className="size-4" /> Previous
        </Link>
        <span className="tabular-nums max-sm:hidden">
          Page {page} of {pages}
        </span>
        <Link href={link(page + 1)} aria-disabled={page >= pages} className={cn(btn)} scroll={false}>
          Next <ChevronRight className="size-4" />
        </Link>
      </div>
    </nav>
  );
}
