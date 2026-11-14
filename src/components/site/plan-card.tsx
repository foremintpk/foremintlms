import Link from "next/link";
import { Check } from "lucide-react";
import { formatDate, formatMoney } from "@/lib/format";
import type { PublicPlan, PublicProduct } from "@/lib/services/public/types";
import { cn } from "@/lib/utils";
import { EnrollFreeButton } from "./forms";
import { ctaClass } from "./primitives";

function unavailableMessage(plan: PublicPlan): string {
  switch (plan.unavailableReason) {
    case "not_started":
      return plan.available_from ? `Available from ${formatDate(plan.available_from)}` : "Not available yet";
    case "ended":
      return "This offer has ended";
    case "sold_out":
      return "Sold out";
    default:
      return "Not available";
  }
}

function ctaLabel(plan: PublicPlan): string {
  if (plan.plan_type === "free") return "Enroll for free";
  if (plan.plan_type === "recurring") return plan.trial_days ? "Start free trial" : "Subscribe";
  return "Buy now";
}

/**
 * A purchasable plan. Paid plans hand off to the checkout route, which signs
 * the visitor in if needed and redirects to Whop; access is only granted once
 * the payment is confirmed server-side.
 */
export function PlanCard({
  plan,
  course,
  highlight = false,
  className,
}: {
  plan: PublicPlan;
  /** Set for a course's own product so free plans enroll directly. */
  course?: { id: string; slug: string } | null;
  highlight?: boolean;
  className?: string;
}) {
  const showLowStock = plan.available && plan.remaining !== null && plan.remaining <= 25;
  return (
    <div
      className={cn(
        "relative flex h-full flex-col rounded-2xl border bg-card p-5",
        highlight && "border-primary/40 ring-1 ring-primary/20",
        !plan.available && "opacity-75",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">{plan.name}</p>
        {plan.promo_label ? (
          <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-primary">{plan.promo_label}</span>
        ) : null}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <p className="font-heading text-3xl font-bold tracking-tight">{plan.priceLabel}</p>
        {plan.compare_at_price_cents && plan.compare_at_price_cents > plan.price_cents ? (
          <p className="text-sm text-muted-foreground line-through">
            <span className="sr-only">Originally </span>
            {formatMoney(plan.compare_at_price_cents, plan.currency, { compact: true })}
          </p>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{plan.accessLabel}</p>
      {plan.description ? <p className="mt-4 text-sm text-foreground/80">{plan.description}</p> : null}
      {plan.available && plan.available_until ? (
        <p className="mt-3 text-xs font-medium text-warning">Offer ends {formatDate(plan.available_until)}</p>
      ) : null}
      {showLowStock ? (
        <p className="mt-3 text-xs font-medium text-warning">
          {plan.remaining === 0 ? "Sold out" : `${plan.remaining} ${plan.remaining === 1 ? "place" : "places"} left`}
        </p>
      ) : null}
      <div className="mt-auto pt-5">
        {!plan.available ? (
          <p className="rounded-xl border border-dashed px-4 py-2.5 text-center text-sm text-muted-foreground">{unavailableMessage(plan)}</p>
        ) : plan.plan_type === "free" && course ? (
          <EnrollFreeButton courseId={course.id} slug={course.slug} />
        ) : (
          <Link href={`/checkout/${plan.id}`} className={ctaClass(highlight ? "primary" : "secondary", "w-full")} prefetch={false}>
            {ctaLabel(plan)}
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * A bundle or membership with its plans and included courses.
 *
 * Laid out as three rows (header, inclusions, plans) on the parent grid's
 * subgrid, so offers side by side line up row for row: their plan boxes start
 * at the same height and stretch to the same size whatever each list holds.
 * Outside a grid it falls back to a plain three-row stack.
 */
export function ProductOffer({ product, className }: { product: PublicProduct; className?: string }) {
  return (
    <div
      className={cn(
        "row-span-3 grid grid-rows-subgrid gap-y-5 rounded-3xl border bg-card p-6 sm:p-7",
        product.is_featured && "border-primary/30 bg-[linear-gradient(180deg,var(--brand-soft),var(--card)_45%)]",
        className,
      )}
    >
      <div>
        <p className="text-sm font-medium text-primary">{product.kind === "membership" ? "Membership" : "Bundle"}</p>
        <h3 className="mt-1 text-2xl font-semibold tracking-tight">{product.name}</h3>
        {product.headline || product.description ? (
          <p className="mt-2 text-muted-foreground">{product.headline ?? product.description}</p>
        ) : null}
      </div>
      <ul className="space-y-2.5 text-sm">
        {product.grants_all_courses ? (
          <li className="flex gap-2.5">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            Every published course, including new releases
          </li>
        ) : null}
        {product.highlights.map((h) => (
          <li key={h} className="flex gap-2.5">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            {h}
          </li>
        ))}
        {!product.grants_all_courses
          ? product.courses.slice(0, 6).map((c) => (
              <li key={c.id} className="flex gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <Link href={`/courses/${c.slug}`} className="hover:underline">
                  {c.title}
                </Link>
              </li>
            ))
          : null}
        {!product.grants_all_courses && product.courses.length > 6 ? (
          <li className="pl-6.5 text-muted-foreground">and {product.courses.length - 6} more courses</li>
        ) : null}
      </ul>
      <div className={cn("mt-1 grid gap-3", product.plans.length > 1 && "sm:grid-cols-2")}>
        {product.plans.map((plan, i) => (
          <PlanCard key={plan.id} plan={plan} highlight={plan.is_featured || (i === 0 && product.plans.length === 1)} />
        ))}
      </div>
    </div>
  );
}
