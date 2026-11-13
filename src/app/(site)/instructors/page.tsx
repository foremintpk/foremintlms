import type { Metadata } from "next";
import Link from "next/link";
import { InstructorCard } from "@/components/site/people";
import { Container, PageIntro, ctaClass } from "@/components/site/primitives";
import { appUrl } from "@/lib/env";
import { getInstructors } from "@/lib/services/public/catalog";

export const metadata: Metadata = {
  title: "Instructors",
  description: "Meet the practitioners who teach at Foremint Academy.",
  alternates: { canonical: appUrl("/instructors") },
};

export default async function InstructorsPage() {
  const instructors = await getInstructors();
  return (
    <>
      <PageIntro title="Learn from people who do the work" description="Our instructors are selected for hands-on experience in the subjects they teach." />
      <Container className="py-12 sm:py-16">
        {instructors.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {instructors.map((i) => (
              <InstructorCard key={i.user_id} instructor={i} />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed bg-card/60 px-6 py-12 text-center">
            <p className="font-heading text-xl font-semibold">Instructor profiles are coming soon</p>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">We&apos;re onboarding our first instructors. Interested in teaching with us?</p>
            <Link href="/contact" className={ctaClass("primary", "mt-6")}>
              Get in touch
            </Link>
          </div>
        )}
      </Container>
    </>
  );
}
