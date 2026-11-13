import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { CertificateLookupForm } from "@/components/site/forms";
import { Container } from "@/components/site/primitives";
import { appUrl } from "@/lib/env";

export const metadata: Metadata = {
  title: "Verify a certificate",
  description: "Check that a Foremint Academy certificate is genuine using its certificate number.",
  alternates: { canonical: appUrl("/certificates/verify") },
};

export default function VerifyCertificatePage() {
  return (
    <Container className="max-w-2xl py-16 sm:py-24">
      <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-primary">
        <ShieldCheck className="size-6" aria-hidden />
      </span>
      <h1 className="mt-6 text-[2.2rem] leading-[1.05] font-bold tracking-[-0.03em] sm:text-[2.8rem]">Verify a certificate</h1>
      <p className="mt-3 text-lg text-muted-foreground">
        Enter the number printed on the certificate. We&apos;ll confirm whether it was issued by Foremint Academy and for which course.
      </p>
      <div className="mt-8 rounded-3xl border bg-card p-6">
        <CertificateLookupForm />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Only the recipient&apos;s name, the course and the dates are shown. No other personal details are shared.</p>
    </Container>
  );
}
