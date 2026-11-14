import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Layers, Package } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/app-shell/page-header";
import { ListToolbar } from "@/components/common/list-toolbar";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { ActionButton } from "@/components/billing/action-button";
import { WhopStatusBanner } from "@/components/billing/whop-status-banner";
import { WhopSyncBadge } from "@/components/billing/whop-sync-badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { requireAdmin } from "@/lib/auth/guards";
import { getPricingOverview } from "@/lib/services/billing/queries";
import { planPriceLabel } from "@/lib/domain/pricing";
import { cn } from "@/lib/utils";
import { ensureCourseProductAction } from "./actions";

export const instant = false;

export const metadata: Metadata = { title: "Pricing & plans" };

export default async function AdminPricingPage({ searchParams }: PageProps<"/admin/pricing">) {
  await requireAdmin("/admin/pricing");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
  const focusCourse = typeof params.course === "string" ? params.course : null;
  const overview = await getPricingOverview(q);

  if (focusCourse) {
    const match = overview.courses.find((c) => c.id === focusCourse);
    if (match?.product) redirect(`/admin/pricing/${match.product.id}`);
  }
  const focus = focusCourse ? overview.courses.find((c) => c.id === focusCourse) ?? null : null;

  return (
    <>
      <PageHeader
        title="Pricing & plans"
        description="Each course is sold through a product with one or more plans: one-time access, lifetime, or a subscription. Paid plans are sold through Whop."
        actions={
          <Link href="/admin/bundles" className={buttonVariants({ variant: "outline" })}>
            <Layers className="size-4" /> Bundles & memberships
          </Link>
        }
      />
      <WhopStatusBanner />

      {focus && !focus.product ? (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-primary/30 bg-brand-soft/50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Set up pricing for {focus.title}</p>
            <p className="text-sm text-muted-foreground">This creates the course&apos;s product. You&apos;ll add plans next.</p>
          </div>
          <ActionButton action={ensureCourseProductAction} input={{ courseId: focus.id }} variant="default" size="default" successHref="/admin/pricing/{productId}">
            Set up pricing
          </ActionButton>
        </div>
      ) : null}

      <SectionHeader title="Courses" description="Open a course to manage its plans." />
      <ListToolbar searchPlaceholder="Search courses" />
      {overview.courses.length === 0 ? (
        <EmptyState icon={Package} title={q ? "No courses match your search" : "No courses yet"} description={q ? "Try a different search." : "Create a course first, then set up its pricing here."} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Course</th>
                <th className="px-4 py-3 font-medium">Course status</th>
                <th className="px-4 py-3 font-medium">Plans</th>
                <th className="px-4 py-3 font-medium">Whop</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {overview.courses.map((c) => {
                const livePlans = c.product?.plans.filter((p) => p.visibility !== "archived") ?? [];
                return (
                  <tr key={c.id} className={cn(focusCourse === c.id && "bg-brand-soft/40")}>
                    <td className="px-4 py-3 font-medium">{c.title}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.product ? (livePlans.length ? livePlans.map((p) => planPriceLabel(p)).join(", ") : "No plans yet") : "Not set up"}
                    </td>
                    <td className="px-4 py-3">{c.product ? <WhopSyncBadge whopId={c.product.whop_product_id} error={c.product.whop_sync_error} /> : null}</td>
                    <td className="px-4 py-3 text-right">
                      {c.product ? (
                        <Link href={`/admin/pricing/${c.product.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                          Manage pricing <ArrowRight className="size-3.5" />
                        </Link>
                      ) : (
                        <ActionButton action={ensureCourseProductAction} input={{ courseId: c.id }} successHref="/admin/pricing/{productId}">
                          Set up pricing
                        </ActionButton>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {overview.groups.length ? (
        <section className="mt-10">
          <SectionHeader title="Bundles & memberships" description="Products that unlock several courses or the whole catalogue." />
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {overview.groups.map((g) => (
              <li key={g.id}>
                <Link href={`/admin/pricing/${g.id}`} className="flex h-full flex-col gap-2 rounded-2xl border bg-card p-4 transition-colors hover:border-primary/40">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{g.name}</span>
                    <StatusBadge status={g.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {g.kind === "membership" ? (g.grants_all_courses ? "Membership — all courses" : `Membership — ${g.courseCount} courses`) : `Bundle — ${g.courseCount} courses`}
                  </p>
                  <p className="text-sm text-muted-foreground">{g.plans.filter((p) => p.visibility !== "archived").map((p) => planPriceLabel(p)).join(", ") || "No plans yet"}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
