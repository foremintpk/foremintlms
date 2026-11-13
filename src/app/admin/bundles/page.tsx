import type { Metadata } from "next";
import Link from "next/link";
import { Layers, Package } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { CreateGroupProductDialog } from "@/components/billing/group-product-forms";
import { WhopStatusBanner } from "@/components/billing/whop-status-banner";
import { WhopSyncBadge } from "@/components/billing/whop-sync-badge";
import { buttonVariants } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/guards";
import { getPricingOverview, listAllCourses } from "@/lib/services/billing/queries";
import { planPriceLabel } from "@/lib/domain/pricing";
import { createGroupProductAction } from "./actions";

export const instant = false;

export const metadata: Metadata = { title: "Bundles & memberships" };

export default async function BundlesPage() {
  await requireAdmin("/admin/bundles");
  const [overview, courses] = await Promise.all([getPricingOverview(""), listAllCourses()]);
  const bundles = overview.groups.filter((g) => g.kind === "bundle");
  const memberships = overview.groups.filter((g) => g.kind === "membership");

  const list = (items: typeof overview.groups, kind: "bundle" | "membership") =>
    items.length === 0 ? (
      <EmptyState
        icon={kind === "bundle" ? Layers : Package}
        title={kind === "bundle" ? "No bundles yet" : "No memberships yet"}
        description={kind === "bundle" ? "Group related courses and sell them together." : "Offer access to the whole catalogue with one plan or subscription."}
      />
    ) : (
      <ul className="grid gap-3 md:grid-cols-2">
        {items.map((g) => (
          <li key={g.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-semibold">{g.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {g.kind === "membership" && g.grants_all_courses ? "All courses" : `${g.courseCount} course${g.courseCount === 1 ? "" : "s"}`}
                </p>
              </div>
              <StatusBadge status={g.status} />
            </div>
            <p className="text-sm">{g.plans.filter((p) => p.visibility !== "archived").map((p) => planPriceLabel(p)).join(", ") || "No plans yet"}</p>
            <WhopSyncBadge whopId={g.whop_product_id} error={g.whop_sync_error} />
            <div className="mt-auto flex flex-wrap gap-2 pt-1">
              <Link href={`/admin/pricing/${g.id}`} className={buttonVariants({ size: "sm" })}>
                Plans & pricing
              </Link>
              <Link href={`/admin/bundles/${g.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                Included courses
              </Link>
            </div>
          </li>
        ))}
      </ul>
    );

  return (
    <>
      <PageHeader
        title="Bundles & memberships"
        description="Sell several courses at once, or give members access to the whole catalogue."
        actions={
          <>
            <CreateGroupProductDialog kind="membership" courses={courses} create={createGroupProductAction} />
            <CreateGroupProductDialog kind="bundle" courses={courses} create={createGroupProductAction} />
          </>
        }
      />
      <WhopStatusBanner />
      <section className="mb-10">
        <SectionHeader title="Memberships" description="All-access or multi-course memberships, sold once or as a subscription." />
        {list(memberships, "membership")}
      </section>
      <section>
        <SectionHeader title="Bundles" description="Fixed sets of courses." />
        {list(bundles, "bundle")}
      </section>
    </>
  );
}
