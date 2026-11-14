import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowUp, Link2, Pencil, Plus, RefreshCw, Star, Trash2 } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/app-shell/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { ConfirmAction } from "@/components/common/confirm-action";
import { LocalTime } from "@/components/common/local-time";
import { ActionButton } from "@/components/billing/action-button";
import { PlanFormDialog } from "@/components/billing/plan-form";
import { ProductSettingsForm } from "@/components/billing/product-settings-form";
import { WhopStatusBanner } from "@/components/billing/whop-status-banner";
import { WhopSyncBadge } from "@/components/billing/whop-sync-badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { requireAdmin } from "@/lib/auth/guards";
import { getProductWithPlans } from "@/lib/services/billing/queries";
import { getSetting } from "@/lib/settings";
import { planAccessLabel, planAvailability, planPriceLabel, remainingStock } from "@/lib/domain/pricing";
import { formatMoney } from "@/lib/format";
import { appUrl } from "@/lib/env";
import {
  createPlanAction,
  deletePlanAction,
  movePlanAction,
  setPlanVisibilityAction,
  syncPlanAction,
  syncProductAction,
  updatePlanAction,
  updateProductAction,
} from "../actions";

export const instant = false;

export const metadata: Metadata = { title: "Product pricing" };

const AVAILABILITY_LABEL: Record<string, string> = {
  archived: "Archived",
  not_started: "Not started yet",
  ended: "Offer ended",
  sold_out: "Sold out",
};

export default async function ProductPricingPage({ params }: PageProps<"/admin/pricing/[productId]">) {
  await requireAdmin("/admin/pricing");
  const { productId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(productId)) notFound();
  const data = await getProductWithPlans(productId);
  if (!data) notFound();
  const { product, plans, courses } = data;
  const defaultCurrency = await getSetting<string>("billing.default_currency", "usd");
  const kindLabel = product.kind === "course" ? "Course product" : product.kind === "bundle" ? "Bundle" : "Membership";

  return (
    <>
      <PageHeader
        back={{ href: product.kind === "course" ? "/admin/pricing" : "/admin/bundles", label: product.kind === "course" ? "Pricing & plans" : "Bundles & memberships" }}
        title={product.name}
        description={
          product.kind === "membership" && product.grants_all_courses
            ? "Membership — unlocks every published course."
            : `${kindLabel} — unlocks ${courses.length === 1 ? courses[0].title : `${courses.length} courses`}.`
        }
        actions={
          <>
            {product.kind !== "course" ? (
              <Link href={`/admin/bundles/${product.id}`} className={buttonVariants({ variant: "outline" })}>
                Edit included courses
              </Link>
            ) : null}
            <ActionButton action={syncProductAction} input={{ productId: product.id }} size="default" pendingLabel="Syncing…">
              <RefreshCw className="size-4" /> Sync to Whop
            </ActionButton>
          </>
        }
      />
      <WhopStatusBanner />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0">
          <SectionHeader
            title="Plans"
            description="Learners pick one plan at checkout. Public plans are listed on the site; hidden plans work from their direct link."
            actions={
              <PlanFormDialog
                title="New plan"
                defaultCurrency={defaultCurrency}
                submit={createPlanAction.bind(null, product.id)}
                trigger={
                  <Button>
                    <Plus className="size-4" /> Add plan
                  </Button>
                }
              />
            }
          />
          {plans.length === 0 ? (
            <EmptyState
              icon={Plus}
              title="No plans yet"
              description="Add a plan to start selling: for example 90-day access, lifetime access, or a monthly subscription."
            />
          ) : (
            <ul className="space-y-3">
              {plans.map((plan, index) => {
                const availability = planAvailability(plan);
                const left = remainingStock(plan);
                return (
                  <li key={plan.id} className="rounded-2xl border bg-card p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{plan.name}</h3>
                          {plan.is_featured ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                              <Star className="size-3.5" aria-hidden /> Highlighted
                            </span>
                          ) : null}
                          <StatusBadge status={plan.visibility === "public" ? "published" : plan.visibility} label={plan.visibility === "public" ? "Public" : undefined} />
                          {!availability.available && plan.visibility !== "archived" ? (
                            <StatusBadge status="warning" tone="warning" label={AVAILABILITY_LABEL[availability.reason ?? ""] ?? "Unavailable"} />
                          ) : null}
                        </div>
                        <p className="text-sm">
                          <span className="font-heading text-lg font-semibold">{planPriceLabel(plan)}</span>
                          {plan.compare_at_price_cents ? (
                            <span className="ml-2 text-muted-foreground line-through">{formatMoney(plan.compare_at_price_cents, plan.currency)}</span>
                          ) : null}
                          {plan.promo_label ? <span className="ml-2 rounded-full bg-mint-soft px-2 py-0.5 text-xs font-medium text-mint-strong">{plan.promo_label}</span> : null}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {planAccessLabel(plan)}
                          {plan.plan_type === "recurring" && plan.grace_period_days ? ` — ${plan.grace_period_days}-day grace period` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {plan.units_sold} sold{left !== null ? ` — ${left} left of ${plan.stock_limit}` : ""}
                          {plan.available_from ? (
                            <>
                              {" — from "}
                              <LocalTime value={plan.available_from} format="datetime" />
                            </>
                          ) : null}
                          {plan.available_until ? (
                            <>
                              {" — until "}
                              <LocalTime value={plan.available_until} format="datetime" />
                            </>
                          ) : null}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <WhopSyncBadge whopId={plan.whop_plan_id} error={plan.whop_sync_error} notNeeded={plan.plan_type === "free"} />
                      </div>
                    </div>
                    {plan.visibility === "hidden" ? (
                      <p className="mt-3 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 font-mono text-xs break-all">
                        <Link2 className="size-3.5 shrink-0" aria-hidden />
                        {appUrl(`/checkout/${plan.id}`)}
                      </p>
                    ) : null}
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
                      <PlanFormDialog
                        title={`Edit ${plan.name}`}
                        plan={plan}
                        submit={updatePlanAction.bind(null, plan.id)}
                        trigger={
                          <Button variant="outline" size="sm">
                            <Pencil className="size-3.5" /> Edit
                          </Button>
                        }
                      />
                      {plan.plan_type !== "free" ? (
                        <ActionButton action={syncPlanAction} input={{ planId: plan.id }} pendingLabel="Syncing…">
                          <RefreshCw className="size-3.5" /> Sync
                        </ActionButton>
                      ) : null}
                      {plan.visibility === "archived" ? (
                        <ActionButton action={setPlanVisibilityAction} input={{ planId: plan.id, visibility: "hidden" as const }}>
                          Restore as hidden
                        </ActionButton>
                      ) : (
                        <ActionButton action={setPlanVisibilityAction} input={{ planId: plan.id, visibility: "archived" as const }}>
                          Archive
                        </ActionButton>
                      )}
                      <div className="ml-auto flex items-center gap-1">
                        <ActionButton action={movePlanAction} input={{ planId: plan.id, direction: "up" as const }} size="icon-sm" variant="ghost" disabled={index === 0} title="Move up">
                          <ArrowUp className="size-4" />
                          <span className="sr-only">Move up</span>
                        </ActionButton>
                        <ActionButton action={movePlanAction} input={{ planId: plan.id, direction: "down" as const }} size="icon-sm" variant="ghost" disabled={index === plans.length - 1} title="Move down">
                          <ArrowDown className="size-4" />
                          <span className="sr-only">Move down</span>
                        </ActionButton>
                        {plan.units_sold === 0 && !plan.whop_plan_id ? (
                          <ConfirmAction
                            title={`Delete ${plan.name}?`}
                            description="This plan has never been offered at checkout, so it can be removed completely."
                            confirmLabel="Delete plan"
                            destructive
                            action={deletePlanAction.bind(null, plan.id)}
                            trigger={
                              <Button variant="ghost" size="icon-sm" title="Delete plan">
                                <Trash2 className="size-4" />
                                <span className="sr-only">Delete plan</span>
                              </Button>
                            }
                          />
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="space-y-6">
          <div className="rounded-2xl border bg-card p-5">
            <h2 className="mb-4 font-semibold">Product</h2>
            <ProductSettingsForm
              product={{ id: product.id, name: product.name, description: product.description, status: product.status, is_featured: product.is_featured }}
              save={updateProductAction}
            />
          </div>
          <div className="space-y-2 rounded-2xl border bg-card p-5 text-sm">
            <h2 className="font-semibold">Whop</h2>
            <WhopSyncBadge whopId={product.whop_product_id} error={product.whop_sync_error} />
            {product.whop_product_id ? <p className="font-mono text-xs text-muted-foreground">{product.whop_product_id}</p> : null}
            {product.whop_synced_at ? (
              <p className="text-xs text-muted-foreground">
                Last synced <LocalTime value={product.whop_synced_at} format="relative" />
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Plans are kept hidden on Whop&apos;s own storefront, so every purchase starts from Foremint checkout and is matched to the learner automatically.
            </p>
          </div>
          {courses.length ? (
            <div className="rounded-2xl border bg-card p-5">
              <h2 className="mb-3 font-semibold">Included courses</h2>
              <ul className="space-y-2 text-sm">
                {courses.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{c.title}</span>
                    <StatusBadge status={c.status} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
}
