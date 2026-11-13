import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, CircleAlert, Clock } from "lucide-react";
import { Container, ctaClass } from "@/components/site/primitives";
import { CheckoutStatusPoller } from "@/components/billing/checkout-status-poller";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Reads the session and the learner's own checkout: render per request.
export const instant = false;

export const metadata: Metadata = {
  title: "Confirming your purchase",
  robots: { index: false, follow: false },
};

type Search = { session?: string; status?: string };

export default async function CheckoutSuccessPage({ searchParams }: PageProps<"/checkout/success">) {
  const params = (await searchParams) as Search;
  const sessionId = typeof params.session === "string" ? params.session : "";
  const user = await requireUser(`/checkout/success${sessionId ? `?session=${encodeURIComponent(sessionId)}` : ""}`);

  // RLS: a learner can only read their own checkout sessions.
  const supabase = await createClient();
  const { data: session } = /^[0-9a-f-]{36}$/i.test(sessionId)
    ? await supabase.from("checkout_sessions").select("id, status, product_id, metadata, created_at").eq("id", sessionId).maybeSingle()
    : { data: null };

  let productName: string | null = null;
  let courseSlug: string | null = null;
  let hasAccess = false;
  if (session) {
    const admin = createAdminClient();
    const [{ data: product }, { count }] = await Promise.all([
      admin.from("products").select("name, kind, course_id").eq("id", session.product_id).maybeSingle(),
      admin
        .from("course_entitlements")
        .select("id", { count: "exact", head: true })
        .eq("checkout_session_id", session.id)
        .eq("user_id", user.id)
        .eq("status", "active"),
    ]);
    productName = (product?.name as string | undefined) ?? null;
    hasAccess = (count ?? 0) > 0 || session.status === "completed";
    const courseIds = ((session.metadata as { course_ids?: string[] } | null)?.course_ids ?? []).filter(Boolean);
    if (courseIds.length) {
      const { data: course } = await admin.from("courses").select("slug").in("id", courseIds).eq("status", "published").limit(1).maybeSingle();
      courseSlug = (course?.slug as string | undefined) ?? null;
    }
  }

  // Whop appends `status` to the return URL; it is shown as a hint only — it never grants access.
  const providerSaysFailed = params.status === "failed" || params.status === "canceled";
  const learnHref = courseSlug ? `/learn/courses/${courseSlug}` : "/learn/courses";

  return (
    <Container className="max-w-2xl py-16 sm:py-24">
      <div className="rounded-3xl border bg-card p-8 shadow-card sm:p-10">
        {!session ? (
          <>
            <CircleAlert className="size-9 text-muted-foreground" aria-hidden />
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">We couldn&apos;t find that checkout</h1>
            <p className="mt-2 text-muted-foreground">
              If you completed a payment, your access will appear in My courses once it&apos;s confirmed, and a receipt will be emailed to you.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/learn/courses" className={ctaClass("primary")}>
                Go to My courses
              </Link>
              <Link href="/learn/billing" className={ctaClass("secondary")}>
                View billing
              </Link>
            </div>
          </>
        ) : hasAccess ? (
          <>
            <CheckCircle2 className="size-9 text-success" aria-hidden />
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">You&apos;re in</h1>
            <p className="mt-2 text-muted-foreground">
              Your payment{productName ? ` for ${productName}` : ""} is confirmed and your access is ready. A confirmation email is on its way.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={learnHref} className={ctaClass("primary")}>
                Start learning
              </Link>
              <Link href="/learn/billing" className={ctaClass("secondary")}>
                View receipt
              </Link>
            </div>
          </>
        ) : providerSaysFailed || session.status === "failed" ? (
          <>
            <CircleAlert className="size-9 text-destructive" aria-hidden />
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">The payment didn&apos;t go through</h1>
            <p className="mt-2 text-muted-foreground">
              No access was granted{productName ? ` for ${productName}` : ""}. You can try again, or contact support if you were charged.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/pricing" className={ctaClass("primary")}>
                Try again
              </Link>
              <Link href="/learn/support/new" className={ctaClass("secondary")}>
                Contact support
              </Link>
            </div>
          </>
        ) : (
          <>
            <Clock className="size-9 text-primary" aria-hidden />
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">Confirming your purchase</h1>
            <p className="mt-2 text-muted-foreground">
              Thanks{productName ? ` for buying ${productName}` : ""}. Access is unlocked as soon as our payment provider confirms the payment — usually
              within a few seconds.
            </p>
            <div className="mt-6">
              <CheckoutStatusPoller />
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/learn/billing" className={ctaClass("secondary")}>
                View billing
              </Link>
            </div>
          </>
        )}
      </div>
    </Container>
  );
}
