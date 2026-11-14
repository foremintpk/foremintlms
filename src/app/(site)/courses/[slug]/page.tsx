import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Award, BarChart2, CheckCircle2, Clock, Globe, Lock, PlayCircle } from "lucide-react";
import { CourseCard } from "@/components/site/course-card";
import { CourseOutline } from "@/components/site/course-outline";
import { EnrollFreeButton } from "@/components/site/forms";
import { PersonAvatar } from "@/components/site/people";
import { PlanCard, ProductOffer } from "@/components/site/plan-card";
import { AddToPlanButton } from "@/components/commerce/add-to-plan-button";
import { selectorOfferForCourse } from "@/lib/services/commerce/catalog";
import { Breadcrumbs, Container, JsonLd, MediaImage, RatingStars, ctaClass } from "@/components/site/primitives";
import { RichContent } from "@/components/common/rich-content";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionUser } from "@/lib/auth/session";
import { appUrl } from "@/lib/env";
import { formatDate, formatDuration } from "@/lib/format";
import { getCourseAccess } from "@/lib/services/access";
import { getCourseBySlug, getCoursePricing, getCourseReviews, getRelatedCourses } from "@/lib/services/public/catalog";
import { LEVEL_LABEL } from "@/lib/services/public/shape";
import type { CourseDetail, PublicProduct } from "@/lib/services/public/types";
import { getPublicSettings } from "@/lib/settings";

// Detail pages depend on the URL slug; render on request (data is cached).
export const instant = false;

const LANGUAGE_LABEL: Record<string, string> = { en: "English", es: "Spanish", fr: "French", de: "German", ar: "Arabic", ur: "Urdu", hi: "Hindi" };

export async function generateMetadata({ params }: PageProps<"/courses/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course) return { title: "Course not found", robots: { index: false } };
  const title = course.seo_title ?? course.title;
  const description = course.seo_description ?? course.short_description ?? `Learn ${course.title} with Foremint Academy.`;
  const url = appUrl(`/courses/${course.slug}`);
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: course.visibility === "unlisted" ? { index: false, follow: true } : undefined,
    openGraph: { title, description, url, type: "website" },
    twitter: { title, description },
  };
}

/** Personalised call to action; reads the session so it streams separately. */
async function CourseCta({ course, hasFreePlan, hasPaidPlans }: { course: CourseDetail; hasFreePlan: boolean; hasPaidPlans: boolean }) {
  const user = await getSessionUser();
  if (user && user.accountStatus === "active") {
    const access = await getCourseAccess(user, { id: course.id, status: course.status });
    if (access.hasAccess) {
      return (
        <div className="grid gap-2">
          <Link href={`/learn/courses/${course.slug}`} className={ctaClass("primary", "w-full")}>
            <PlayCircle className="size-4" aria-hidden />
            {access.enrollment && access.enrollment.progress_percent > 0 ? "Continue learning" : "Start learning"}
          </Link>
          <p className="text-center text-xs text-muted-foreground">
            {access.isStaff ? "You're on this course's teaching team." : access.expiresAt ? `Your access runs until ${formatDate(access.expiresAt)}.` : "You have full access to this course."}
          </p>
        </div>
      );
    }
    if (access.reason === "expired" || access.reason === "revoked") {
      return (
        <div className="grid gap-2">
          <p className="rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">Your access to this course has ended. Your progress is saved — renew below to continue.</p>
          {hasPaidPlans ? (
            <a href="#pricing" className={ctaClass("primary", "w-full")}>
              See renewal options
            </a>
          ) : null}
        </div>
      );
    }
  }
  if (course.is_free || hasFreePlan) {
    return user ? (
      <EnrollFreeButton courseId={course.id} slug={course.slug} />
    ) : (
      <Link href={`/register?next=${encodeURIComponent(`/courses/${course.slug}`)}`} className={ctaClass("primary", "w-full")}>
        Create a free account to enroll
      </Link>
    );
  }
  if (hasPaidPlans) {
    return (
      <a href="#pricing" className={ctaClass("primary", "w-full")}>
        Choose a plan
      </a>
    );
  }
  return <p className="rounded-xl border border-dashed px-4 py-3 text-center text-sm text-muted-foreground">Enrollment for this course opens soon.</p>;
}

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t py-10 first:border-t-0 first:pt-0">
      <h2 className="mb-5 text-2xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function lowestOffer(own: PublicProduct | null) {
  const plans = (own?.plans ?? []).filter((p) => p.available && p.plan_type !== "free");
  if (!plans.length) return null;
  return [...plans].sort((a, b) => a.price_cents - b.price_cents)[0];
}

export default async function CoursePage({ params }: PageProps<"/courses/[slug]">) {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course) notFound();

  const [pricing, reviews, related, settings, packageOffer] = await Promise.all([
    getCoursePricing(course.id),
    course.rating ? getCourseReviews(course.id, 6) : Promise.resolve([]),
    getRelatedCourses(course.id, course.category?.id ?? null, 3),
    getPublicSettings(),
    selectorOfferForCourse(course.id),
  ]);
  const ownPlans = pricing.own?.plans ?? [];
  const hasFreePlan = ownPlans.some((p) => p.plan_type === "free" && p.available);
  const hasPaidPlans = ownPlans.some((p) => p.plan_type !== "free") || pricing.included.length > 0;
  const lowest = lowestOffer(pricing.own);
  const duration = course.estimated_duration_minutes ?? (course.totalLessonMinutes || null);
  const url = appUrl(`/courses/${course.slug}`);

  const facts = [
    { icon: BarChart2, label: LEVEL_LABEL[course.level] },
    course.lessonCount ? { icon: PlayCircle, label: `${course.lessonCount} ${course.lessonCount === 1 ? "lesson" : "lessons"}` } : null,
    duration ? { icon: Clock, label: formatDuration(duration) } : null,
    { icon: Globe, label: LANGUAGE_LABEL[course.language] ?? course.language.toUpperCase() },
    course.certificate_enabled ? { icon: Award, label: "Certificate of completion" } : null,
  ].filter((f): f is { icon: typeof Clock; label: string } => Boolean(f));

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Course",
            name: course.title,
            description: course.short_description ?? course.seo_description ?? course.title,
            url,
            inLanguage: course.language,
            educationalLevel: LEVEL_LABEL[course.level],
            provider: { "@type": "Organization", name: settings.brandName, sameAs: appUrl("/") },
            ...(course.thumbnail_url ? { image: course.thumbnail_url.startsWith("/") ? appUrl(course.thumbnail_url) : course.thumbnail_url } : {}),
            ...(course.instructors.length ? { instructor: course.instructors.map((i) => ({ "@type": "Person", name: i.public_name })) } : {}),
            ...(course.rating ? { aggregateRating: { "@type": "AggregateRating", ratingValue: course.rating.average, reviewCount: course.rating.count, bestRating: 5 } } : {}),
            ...(course.is_free
              ? { offers: { "@type": "Offer", price: 0, priceCurrency: "USD", category: "Free", url } }
              : lowest
                ? { offers: { "@type": "Offer", price: (lowest.price_cents / 100).toFixed(2), priceCurrency: lowest.currency.toUpperCase(), category: "Paid", url } }
                : {}),
            hasCourseInstance: { "@type": "CourseInstance", courseMode: "Online", courseWorkload: duration ? `PT${duration}M` : undefined },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Courses", item: appUrl("/courses") },
              ...(course.category ? [{ "@type": "ListItem", position: 2, name: course.category.name, item: appUrl(`/categories/${course.category.slug}`) }] : []),
              { "@type": "ListItem", position: course.category ? 3 : 2, name: course.title, item: url },
            ],
          },
        ]}
      />

      <div className="relative">
        <div aria-hidden className="absolute inset-x-0 -top-[4.25rem] h-[528px] bg-[linear-gradient(180deg,var(--brand-soft),transparent)]" />
        <Container className="relative grid gap-10 pt-8 pb-16 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-x-14 lg:gap-y-0 lg:pt-10">
          <div className="lg:col-start-1 lg:row-start-1 lg:pb-12">
            <Breadcrumbs
              items={[
                { label: "Courses", href: "/courses" },
                ...(course.category ? [{ label: course.category.name, href: `/categories/${course.category.slug}` }] : []),
                { label: course.title },
              ]}
            />
            <h1 className="mt-6 text-[2.2rem] leading-[1.04] font-bold tracking-[-0.035em] sm:text-[3rem]">{course.title}</h1>
            {course.short_description ? <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{course.short_description}</p> : null}
            {course.rating ? <RatingStars value={course.rating.average} count={course.rating.count} className="mt-4" /> : null}
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-foreground/80">
              {facts.map((f) => (
                <li key={f.label} className="inline-flex items-center gap-1.5">
                  <f.icon className="size-4 text-muted-foreground" aria-hidden />
                  {f.label}
                </li>
              ))}
            </ul>
            {course.instructors.length ? (
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <div className="flex -space-x-2">
                  {course.instructors.slice(0, 3).map((i) => (
                    <PersonAvatar key={i.user_id} name={i.public_name} src={i.avatar_url} className="size-9 ring-2 ring-background" />
                  ))}
                </div>
                <p className="text-sm">
                  Taught by{" "}
                  {course.instructors.map((i, idx) => (
                    <span key={i.user_id}>
                      {idx > 0 ? (idx === course.instructors.length - 1 ? " and " : ", ") : null}
                      <Link href={`/instructors/${i.slug}`} className="font-semibold hover:text-primary hover:underline">
                        {i.public_name}
                      </Link>
                    </span>
                  ))}
                </p>
              </div>
            ) : null}
          </div>

          <aside className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <div className="overflow-hidden rounded-3xl border bg-card shadow-card lg:sticky lg:top-24">
              <div className="relative aspect-[16/10] bg-muted">
                <MediaImage src={course.banner_url ?? course.thumbnail_url ?? course.category?.image_url} alt="" priority sizes="380px" />
              </div>
              <div className="p-5">
                {course.is_free ? (
                  <p className="font-heading text-3xl font-bold">Free</p>
                ) : lowest ? (
                  <>
                    <p className="font-heading text-3xl font-bold">
                      {ownPlans.filter((p) => p.available && p.plan_type !== "free").length > 1 ? `From ${lowest.priceLabel}` : lowest.priceLabel}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{lowest.accessLabel}</p>
                  </>
                ) : pricing.included.length ? (
                  <p className="text-sm text-muted-foreground">Available with {pricing.included.map((p) => p.name).join(", ")}</p>
                ) : null}
                <div className="mt-4">
                  <Suspense fallback={<Skeleton className="h-11 w-full rounded-xl" />}>
                    <CourseCta course={course} hasFreePlan={hasFreePlan} hasPaidPlans={hasPaidPlans} />
                  </Suspense>
                </div>
                {packageOffer.offered ? <AddToPlanButton courseId={course.id} courseTitle={course.title} className="mt-3" /> : null}
                <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    Access starts as soon as your payment is confirmed
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    Learn on desktop, tablet or phone
                  </li>
                  {course.certificate_enabled ? (
                    <li className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      Verifiable certificate when you complete it
                    </li>
                  ) : null}
                </ul>
              </div>
            </div>
          </aside>

        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          {course.learning_outcomes.length ? (
            <Section title="What you'll learn">
              <ul className="grid gap-3 sm:grid-cols-2">
                {course.learning_outcomes.map((o) => (
                  <li key={o} className="flex gap-2.5">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {course.description ? (
            <Section title="About this course">
              <RichContent html={course.description} />
            </Section>
          ) : null}

          {course.modules.length ? (
            <Section id="curriculum" title="Curriculum">
              <CourseOutline modules={course.modules} courseSlug={course.slug} />
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="size-3.5" aria-hidden />
                Preview lessons are free with an account; the rest unlock when you enroll.
              </p>
            </Section>
          ) : null}

          {course.requirements.length ? (
            <Section title="Requirements">
              <ul className="list-disc space-y-2 pl-5 text-foreground/90">
                {course.requirements.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </Section>
          ) : null}

          {course.target_audience.length ? (
            <Section title="Who this course is for">
              <ul className="list-disc space-y-2 pl-5 text-foreground/90">
                {course.target_audience.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </Section>
          ) : null}

          {ownPlans.length || pricing.included.length ? (
            <Section id="pricing" title="Choose how you learn">
              {ownPlans.length ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {ownPlans.map((plan) => (
                    <PlanCard key={plan.id} plan={plan} course={{ id: course.id, slug: course.slug }} highlight={plan.is_featured} />
                  ))}
                </div>
              ) : null}
              {pricing.included.length ? (
                <div className="mt-8">
                  <h3 className="mb-4 text-lg font-semibold">{ownPlans.length ? "Also included in" : "Available as part of"}</h3>
                  <div className="grid gap-5">
                    {pricing.included.map((p) => (
                      <ProductOffer key={p.id} product={p} />
                    ))}
                  </div>
                </div>
              ) : null}
            </Section>
          ) : null}

          {course.instructors.length ? (
            <Section title={course.instructors.length > 1 ? "Your instructors" : "Your instructor"}>
              <div className="grid gap-6">
                {course.instructors.map((i) => (
                  <div key={i.user_id} className="flex flex-col gap-4 sm:flex-row">
                    <PersonAvatar name={i.public_name} src={i.avatar_url} className="size-16" />
                    <div>
                      <Link href={`/instructors/${i.slug}`} className="text-lg font-semibold hover:text-primary hover:underline">
                        {i.public_name}
                      </Link>
                      {i.headline ? <p className="text-sm text-muted-foreground">{i.headline}</p> : null}
                      {i.bio ? <p className="mt-2 line-clamp-4 whitespace-pre-line text-foreground/85">{i.bio}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {course.rating && reviews.length ? (
            <Section title="Student reviews">
              <div className="mb-6 flex items-center gap-3">
                <p className="font-heading text-4xl font-bold">{course.rating.average.toFixed(1)}</p>
                <RatingStars value={course.rating.average} count={course.rating.count} />
              </div>
              <ul className="grid gap-4">
                {reviews.map((r) => (
                  <li key={r.id} className="rounded-2xl border bg-card p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <RatingStars value={r.rating} />
                      <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
                    </div>
                    {r.title ? <p className="mt-3 font-semibold">{r.title}</p> : null}
                    {r.body ? <p className="mt-1 whitespace-pre-line text-foreground/85">{r.body}</p> : null}
                    <p className="mt-3 text-sm text-muted-foreground">
                      {r.reviewer_name}
                      {r.verified_enrollment ? <span className="ml-2 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">Verified student</span> : null}
                    </p>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>
        </Container>
      </div>

      {related.length ? (
        <section className="border-t bg-card py-16">
          <Container>
            <h2 className="mb-8 text-2xl font-semibold tracking-tight">You might also like</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((c) => (
                <CourseCard key={c.id} course={c} />
              ))}
            </div>
          </Container>
        </section>
      ) : null}
    </>
  );
}
