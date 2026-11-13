import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy, Mail, Phone } from "lucide-react";
import { ContactForm } from "@/components/site/forms";
import { Container, PageIntro } from "@/components/site/primitives";
import { appUrl } from "@/lib/env";
import { getPublicSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with Foremint Academy about courses, billing, team training or teaching with us.",
  alternates: { canonical: appUrl("/contact") },
};

export default async function ContactPage() {
  const settings = await getPublicSettings();
  return (
    <>
      <PageIntro title="Talk to us" description="Questions about a course, billing, team training or teaching with us — send a message and we'll reply by email." />
      <Container className="grid gap-12 py-12 sm:py-16 lg:grid-cols-[1fr_340px]">
        <div className="rounded-3xl border bg-card p-6 sm:p-8">
          <ContactForm />
        </div>
        <aside className="grid content-start gap-4">
          <div className="rounded-2xl border bg-card p-5">
            <LifeBuoy className="size-5 text-primary" aria-hidden />
            <p className="mt-3 font-semibold">Already a student?</p>
            <p className="mt-1 text-sm text-muted-foreground">Open a support ticket from your dashboard so we can see your account and courses.</p>
            <Link href="/learn/support" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
              Go to support
            </Link>
          </div>
          {settings.supportEmail ? (
            <div className="rounded-2xl border bg-card p-5">
              <Mail className="size-5 text-primary" aria-hidden />
              <p className="mt-3 font-semibold">Email</p>
              <a href={`mailto:${settings.supportEmail}`} className="mt-1 block text-sm text-primary hover:underline">
                {settings.supportEmail}
              </a>
            </div>
          ) : null}
          {settings.phone ? (
            <div className="rounded-2xl border bg-card p-5">
              <Phone className="size-5 text-primary" aria-hidden />
              <p className="mt-3 font-semibold">Phone</p>
              <a href={`tel:${settings.phone.replace(/[^+\d]/g, "")}`} className="mt-1 block text-sm text-primary hover:underline">
                {settings.phone}
              </a>
            </div>
          ) : null}
          {settings.businessAddress ? (
            <div className="rounded-2xl border bg-card p-5">
              <p className="font-semibold">{settings.legalEntityName || settings.brandName}</p>
              <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{settings.businessAddress}</p>
            </div>
          ) : null}
        </aside>
      </Container>
    </>
  );
}
