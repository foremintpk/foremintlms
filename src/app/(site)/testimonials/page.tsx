import type { Metadata } from "next";
import Link from "next/link";
import { TestimonialCard } from "@/components/site/people";
import { Container, PageIntro, ctaClass } from "@/components/site/primitives";
import { appUrl } from "@/lib/env";
import { getTestimonials } from "@/lib/services/public/content";

export const metadata: Metadata = {
  title: "Testimonials",
  description: "What Foremint Academy students say about their courses.",
  alternates: { canonical: appUrl("/testimonials") },
};

export default async function TestimonialsPage() {
  const testimonials = await getTestimonials();
  return (
    <>
      <PageIntro title="What learners say" description="Feedback shared by Foremint Academy students, published with their permission." />
      <Container className="py-12 sm:py-16">
        {testimonials.length ? (
          <div className="columns-1 gap-5 sm:columns-2 lg:columns-3 [&>*]:mb-5 [&>*]:break-inside-avoid">
            {testimonials.map((t) => (
              <TestimonialCard key={t.id} testimonial={t} />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed bg-card/60 px-6 py-12 text-center">
            <p className="font-heading text-xl font-semibold">No testimonials yet</p>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">
              We only publish feedback from real students who have agreed to share it. Check back after our first cohorts complete their courses.
            </p>
            <Link href="/courses" className={ctaClass("secondary", "mt-6")}>
              Browse courses
            </Link>
          </div>
        )}
      </Container>
    </>
  );
}
