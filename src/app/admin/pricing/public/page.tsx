import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Info, Package } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { WhopStatusBanner } from "@/components/billing/whop-status-banner";
import { PriceMatrix } from "@/components/admin/commerce/price-matrix";
import { BulkPriceDialog } from "@/components/admin/commerce/bulk-price-dialog";
import { SelectorSettingsForm } from "@/components/admin/commerce/selector-settings-form";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/guards";
import { durationLabel } from "@/lib/domain/commerce";
import { getPricingMatrix } from "@/lib/services/commerce/admin";
import { getOrderLinkTtlHours, getSelectorSettings } from "@/lib/services/commerce/settings";

export const instant = false;

export const metadata: Metadata = { title: "Public course pricing" };

export default async function PublicCoursePricingPage() {
  await requireAdmin("/admin/pricing/public");
  const [settings, ttl, matrix] = await Promise.all([getSelectorSettings(), getOrderLinkTtlHours(), getPricingMatrix()]);
  const priced = new Set(matrix.rows.flatMap((r) => Object.keys(r.cells)));
  const missingDefault = !priced.has(settings.default_duration);
  const fallback = matrix.durations.find((d) => priced.has(d));

  return (
    <>
      <PageHeader
        title="Public course pricing"
        description="Prices visitors see on Build your learning plan, at guest checkout and in the course advisor. Each price is a one-time plan on the course, so it can also be bought on the course page."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/courses/select" target="_blank">
                <ExternalLink aria-hidden /> View the selector
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/pricing">
                <Package aria-hidden /> Pricing & plans
              </Link>
            </Button>
          </>
        }
      />
      <WhopStatusBanner />

      {missingDefault ? (
        <div className="mb-6 flex gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-4 text-sm" role="status" data-testid="default-period-warning">
          <Info className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <p>
            No course has a {durationLabel(settings.default_duration).toLowerCase()} price yet, so the selector opens on{" "}
            {fallback ? <strong>{durationLabel(fallback).toLowerCase()}</strong> : "no period"} instead. The prices that came with the starter catalogue are 90 days and
            lifetime — add {durationLabel(settings.default_duration).toLowerCase()} prices below to make it the default.
          </p>
        </div>
      ) : null}

      <section className="mb-8 rounded-2xl border bg-card p-5 sm:p-6">
        <SectionHeader title="Selector settings" description="Which access periods are sold, the default, currency and limits." />
        <SelectorSettingsForm initial={settings} linkTtlHours={ttl} />
      </section>

      <section>
        <SectionHeader
          title="Course prices"
          description={`One price per course and access period, in ${settings.currency.toUpperCase()}. A period appears on the website once courses have a price for it. Only published, public, paid courses are shown. Changes show on the site within a minute.`}
          actions={<BulkPriceDialog durations={matrix.durations} currency={matrix.currency} />}
        />
        {matrix.rows.length === 0 ? (
          <EmptyState icon={Package} title="No courses yet" description="Create and publish a course, then set its prices here." />
        ) : settings.durations.length === 0 ? (
          <EmptyState icon={Package} title="No access periods enabled" description="Enable at least one access period in the settings above." />
        ) : (
          <PriceMatrix rows={matrix.rows} durations={matrix.durations} currency={matrix.currency} />
        )}
      </section>
    </>
  );
}
