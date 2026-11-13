import type { Metadata } from "next";
import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { Container, ctaClass } from "@/components/site/primitives";

// Reads the reason from the URL on each request.
export const instant = false;

export const metadata: Metadata = {
  title: "Checkout unavailable",
  robots: { index: false, follow: false },
};

const MESSAGES: Record<string, { title: string; body: string }> = {
  not_found: { title: "This plan doesn't exist", body: "The link may be out of date. Browse current plans on the pricing page." },
  archived: { title: "This plan is no longer offered", body: "Choose one of the current plans instead." },
  not_started: { title: "This offer hasn't started yet", body: "Check back when it opens, or choose another plan." },
  ended: { title: "This offer has ended", body: "The limited-time price is no longer available. Current plans are on the pricing page." },
  sold_out: { title: "This offer is sold out", body: "All places at this price have been taken. Other plans are still available." },
  course_unavailable: { title: "This course isn't open for enrollment", body: "It may be in preparation. Browse the courses that are open now." },
  payments_unavailable: { title: "Checkout is temporarily unavailable", body: "Online payments aren't switched on yet. Please try again later or contact support." },
  not_synced: { title: "This plan isn't ready for checkout", body: "Our team is finishing its setup. Please try again later or contact support." },
  provider_error: { title: "We couldn't start checkout", body: "Our payment provider didn't respond. You haven't been charged — please try again in a moment." },
  rate_limited: { title: "Too many checkout attempts", body: "Wait a few minutes before trying again." },
};

export default async function CheckoutUnavailablePage({ searchParams }: PageProps<"/checkout/unavailable">) {
  const params = await searchParams;
  const reason = typeof params.reason === "string" ? params.reason : "provider_error";
  const plan = typeof params.plan === "string" && /^[0-9a-f-]{36}$/i.test(params.plan) ? params.plan : null;
  const message = MESSAGES[reason] ?? MESSAGES.provider_error;
  const retryable = reason === "provider_error" || reason === "rate_limited";

  return (
    <Container className="max-w-2xl py-16 sm:py-24">
      <div className="rounded-3xl border bg-card p-8 shadow-card sm:p-10">
        <CircleAlert className="size-9 text-muted-foreground" aria-hidden />
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">{message.title}</h1>
        <p className="mt-2 text-muted-foreground">{message.body}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          {retryable && plan ? (
            <Link href={`/checkout/${plan}`} className={ctaClass("primary")} prefetch={false}>
              Try again
            </Link>
          ) : (
            <Link href="/pricing" className={ctaClass("primary")}>
              See pricing
            </Link>
          )}
          <Link href="/courses" className={ctaClass("secondary")}>
            Browse courses
          </Link>
          <Link href="/contact" className={ctaClass("ghost")}>
            Contact support
          </Link>
        </div>
      </div>
    </Container>
  );
}
