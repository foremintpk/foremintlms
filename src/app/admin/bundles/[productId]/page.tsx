import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { CompositionEditor } from "@/components/billing/group-product-forms";
import { buttonVariants } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/guards";
import { getProductWithPlans, listAllCourses } from "@/lib/services/billing/queries";
import { updateCompositionAction } from "../actions";

export const instant = false;

export const metadata: Metadata = { title: "Included courses" };

export default async function BundleCompositionPage({ params }: PageProps<"/admin/bundles/[productId]">) {
  await requireAdmin("/admin/bundles");
  const { productId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(productId)) notFound();
  const [data, courses] = await Promise.all([getProductWithPlans(productId), listAllCourses()]);
  if (!data) notFound();
  if (data.product.kind === "course") redirect(`/admin/pricing/${productId}`);
  const kind = data.product.kind as "bundle" | "membership";

  return (
    <>
      <PageHeader
        back={{ href: "/admin/bundles", label: "Bundles & memberships" }}
        title={data.product.name}
        description={kind === "bundle" ? "Choose the courses this bundle unlocks." : "Choose what this membership unlocks."}
        actions={
          <Link href={`/admin/pricing/${productId}`} className={buttonVariants({ variant: "outline" })}>
            Plans & pricing
          </Link>
        }
      />
      <div className="max-w-2xl rounded-2xl border bg-card p-5 sm:p-6">
        <CompositionEditor
          product={{ id: data.product.id, kind, grants_all_courses: data.product.grants_all_courses }}
          courses={courses}
          initialCourseIds={data.courses.map((c) => c.id)}
          bundle={data.bundle ? { headline: data.bundle.headline, highlights: data.bundle.highlights ?? [] } : null}
          save={updateCompositionAction}
        />
      </div>
    </>
  );
}
