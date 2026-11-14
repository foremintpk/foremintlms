import type { Metadata } from "next";
import { Breadcrumbs, Container } from "@/components/site/primitives";
import { CheckoutView } from "@/components/commerce/checkout-view";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Review your learning package, add a discount code and pay securely — no account needed.",
  robots: { index: false, follow: false },
};

/**
 * Guest checkout for the learning package. The cart is read in the browser
 * from /api/commerce/cart (cookie-identified, server-priced), so this page
 * itself is static.
 */
export default function CheckoutPage() {
  return (
    <Container className="max-w-6xl py-10 sm:py-14">
      <Breadcrumbs items={[{ label: "Build your learning plan", href: "/courses/select" }, { label: "Checkout" }]} />
      <h1 className="mt-5 font-heading text-[2rem] leading-tight font-bold tracking-[-0.035em] sm:text-[2.5rem]">Checkout</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">Check your courses, add a discount code, and pay now or send the payment link to whoever is paying.</p>
      <div className="mt-8">
        <CheckoutView />
      </div>
    </Container>
  );
}
