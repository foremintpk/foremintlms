"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/common/status-badge";
import { useAction } from "@/hooks/use-action";
import { durationLabel, type DurationKey } from "@/lib/domain/commerce";
import { formatMinor, minorToMajorString, parseAmountToMinor } from "@/lib/domain/invoicing";
import type { PricingMatrixRow, SelectorPriceCell } from "@/lib/services/commerce/admin";
import { offerPlanInSelectorAction, removeSelectorPriceAction, setCourseFeaturedAction, setSelectorPriceAction } from "@/app/admin/pricing/public/actions";
import { cn } from "@/lib/utils";

/** Course × access-period grid of selector prices with inline editing. */
export function PriceMatrix({ rows, durations, currency }: { rows: PricingMatrixRow[]; durations: DurationKey[]; currency: string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full text-sm" style={{ minWidth: `${360 + durations.length * 150}px` }} data-testid="price-matrix">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Course</th>
            {durations.map((d) => (
              <th key={d} className="px-3 py-3 font-medium">
                {durationLabel(d)}
              </th>
            ))}
            <th className="px-4 py-3 font-medium">Featured</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => {
            const sellable = row.status === "published" && row.visibility === "public" && !row.isFree;
            return (
              <tr key={row.courseId} className="align-top" data-testid="price-row" data-course-id={row.courseId}>
                <td className="max-w-[300px] px-4 py-3">
                  <p className="font-medium">{row.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={row.status} />
                    {row.visibility !== "public" ? <StatusBadge status={row.visibility} /> : null}
                    {row.isFree ? <StatusBadge status="free" label="Free course" tone="info" /> : null}
                    {!sellable ? <span className="text-xs text-muted-foreground">Not shown publicly</span> : null}
                  </div>
                  {row.productId ? (
                    <Link href={`/admin/pricing/${row.productId}`} className="mt-1 inline-block text-xs text-primary hover:underline">
                      All plans
                    </Link>
                  ) : null}
                </td>
                {durations.map((d) => (
                  <td key={d} className="px-3 py-3">
                    {row.isFree ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <PriceCellEditor courseId={row.courseId} courseTitle={row.title} duration={d} currency={currency} cell={row.cells[d] ?? null} candidate={row.candidates[d] ?? null} />
                    )}
                  </td>
                ))}
                <td className="px-4 py-3">
                  <FeaturedToggle courseId={row.courseId} featured={row.isFeatured} title={row.title} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FeaturedToggle({ courseId, featured, title }: { courseId: string; featured: boolean; title: string }) {
  const router = useRouter();
  const { run, pending } = useAction(setCourseFeaturedAction, { onSuccess: () => router.refresh() });
  return <Switch checked={featured} disabled={pending} onCheckedChange={(v) => void run({ courseId, featured: v })} aria-label={`Feature ${title}`} />;
}

function PriceCellEditor({
  courseId,
  courseTitle,
  duration,
  currency,
  cell,
  candidate,
}: {
  courseId: string;
  courseTitle: string;
  duration: DurationKey;
  currency: string;
  cell: SelectorPriceCell | null;
  candidate: SelectorPriceCell | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState(cell ? minorToMajorString(cell.priceMinor, currency) : candidate ? minorToMajorString(candidate.priceMinor, currency) : "");
  const [compareAt, setCompareAt] = useState(cell?.compareAtMinor ? minorToMajorString(cell.compareAtMinor, currency) : "");
  const [label, setLabel] = useState(cell?.promoLabel ?? "");
  const [localError, setLocalError] = useState<string | null>(null);
  const done = () => {
    setOpen(false);
    router.refresh();
  };
  const save = useAction(setSelectorPriceAction, { onSuccess: done });
  const remove = useAction(removeSelectorPriceAction, { onSuccess: done });
  const offer = useAction(offerPlanInSelectorAction, { onSuccess: done });
  const fieldError = save.fieldErrors.priceMinor?.[0] ?? save.fieldErrors.compareAtMinor?.[0] ?? save.fieldErrors.promoLabel?.[0] ?? null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    const priceMinor = parseAmountToMinor(price, currency);
    if (priceMinor === null) return setLocalError("Enter a price like 20 or 19.99");
    const compareMinor = compareAt.trim() ? parseAmountToMinor(compareAt, currency) : null;
    if (compareAt.trim() && compareMinor === null) return setLocalError("Enter the original price like 30 or 29.99");
    void save.run({ courseId, duration, priceMinor, compareAtMinor: compareMinor, promoLabel: label.trim() || null });
  }

  return (
    <div className="grid gap-1.5">
      {cell ? (
        <div>
          <p className="font-semibold tabular-nums" data-testid="matrix-price">
            {formatMinor(cell.priceMinor, currency)}
            {cell.compareAtMinor ? <span className="ml-1.5 text-xs font-normal text-muted-foreground line-through">{formatMinor(cell.compareAtMinor, currency)}</span> : null}
          </p>
          {cell.promoLabel ? <p className="text-xs text-primary">{cell.promoLabel}</p> : null}
        </div>
      ) : candidate ? (
        <div className="text-xs text-muted-foreground">
          {formatMinor(candidate.priceMinor, currency)} plan exists, not offered
          <Button type="button" size="xs" variant="outline" className="mt-1 w-full" disabled={offer.pending} onClick={() => void offer.run({ planId: candidate.planId })}>
            Offer in selector
          </Button>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">Not offered</span>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" size="xs" variant={cell ? "ghost" : "outline"} className={cn("justify-start", !cell && "w-full")} aria-label={`${cell ? "Edit" : "Set"} ${durationLabel(duration)} price for ${courseTitle}`}>
            {cell ? <Pencil className="size-3" aria-hidden /> : <Plus className="size-3" aria-hidden />}
            {cell ? "Edit" : "Set price"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="start">
          <form className="grid gap-3" onSubmit={submit}>
            <p className="text-sm font-semibold">
              {courseTitle} · {durationLabel(duration)}
            </p>
            <label className="grid gap-1 text-xs font-medium">
              Price ({currency.toUpperCase()})
              <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="20.00" autoFocus data-testid="matrix-price-input" />
            </label>
            <label className="grid gap-1 text-xs font-medium">
              Original price (optional, shown struck through)
              <Input value={compareAt} onChange={(e) => setCompareAt(e.target.value)} inputMode="decimal" placeholder="—" />
            </label>
            <label className="grid gap-1 text-xs font-medium">
              Promotional label (optional)
              <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} placeholder="Launch offer" />
            </label>
            {localError || fieldError || (save.error && !Object.keys(save.fieldErrors).length) ? (
              <p className="text-xs text-destructive" role="alert">
                {localError ?? fieldError ?? save.error}
              </p>
            ) : null}
            <p className="text-[0.7rem] text-muted-foreground">This plan is also sold on the course page. Saving updates its Whop variant.</p>
            <div className="flex items-center justify-between gap-2">
              {cell ? (
                <Button type="button" size="sm" variant="ghost" disabled={remove.pending} onClick={() => void remove.run({ planId: cell.planId })}>
                  Stop offering
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" size="sm" disabled={save.pending} data-testid="matrix-save">
                {save.pending ? "Saving…" : "Save price"}
              </Button>
            </div>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}
