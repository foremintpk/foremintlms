# Public website

The marketing site lives in `src/app/(site)` and shares the root layout with the apps. Everything a visitor sees is read with the anonymous, cookie-less Supabase client inside `"use cache"` loaders, so Row Level Security limits it to published content and pages render from cache.

## Routes

| Route | Notes |
| --- | --- |
| `/` | CMS-driven home (sections A–L from `cms_sections`, validated by `src/lib/cms/sections.ts`; invalid or missing sections fall back to schema defaults). Instructors, testimonials, case studies and pricing sections hide when there's nothing published. Organization JSON-LD. |
| `/about` | CMS `about` page (intro, mission, approach) plus subject list. AI portrait images are used only as unnamed ambient imagery. |
| `/courses` | Catalog with search, category, level, free/paid filters, sort and pagination (URL params, server-filtered inside `<Suspense>`). |
| `/courses/[slug]` | Course detail: outcomes, description, curriculum (preview lessons link to `/learn/courses/[slug]/lessons/[id]`), requirements, audience, plans for the course's own product, bundles/memberships that include it, instructors, published reviews (only if any exist), related courses. Personalised CTA (continue / renew / enroll free / choose plan) streams in a `<Suspense>`. Course + BreadcrumbList JSON-LD, per-course OG image. Unlisted courses are `noindex`. |
| `/categories/[slug]` | Category page with its published courses. |
| `/instructors`, `/instructors/[slug]` | Approved, public instructor profiles and their published courses. |
| `/programs`, `/programs/[slug]` | Learning paths with ordered courses. |
| `/pricing` | Memberships and bundles with live availability (time windows, stock), plus a pointer to per-course plans. |
| `/testimonials` | Published testimonials only (publication requires recorded consent at the DB level). |
| `/case-studies`, `/case-studies/[slug]` | `case_studies.kind = 'case_study'`. |
| `/success-stories`, `/success-stories/[slug]` | `case_studies.kind = 'success_story'`. |
| `/blog`, `/blog/[slug]` | Category filter, pagination, Article JSON-LD, newsletter signup. |
| `/faq` | Grouped by category, FAQPage JSON-LD. |
| `/contact` | Form → `marketing_leads` + staff email (`communication.contact_received`) to the support email from settings. Honeypot + rate limit (5 per 10 min per IP). |
| `/legal/[slug]` | `terms`, `privacy`, `refund`, `cookies`. Renders the current published version with `{{placeholders}}` filled from platform settings (missing values show a visible `[entity name]`-style marker; `{{registration_number}}` renders nothing when unset), plus version history. |
| `/certificates/verify`, `/certificates/verify/[number]` | Public verification showing only recipient name, course, instructor, completion and issue dates, status. Lookups are rate-limited (30 per 5 min per IP) and logged in `certificate_verifications` with a daily-salted IP hash. `noindex`. |
| `/newsletter/unsubscribe?token=` | POST-button confirmation (email link scanners can't unsubscribe people). |

Not built here (other workstreams): `/checkout/**` (payments), `/login`, `/register` (accounts), `/learn/**`.

## Server actions (`src/app/(site)/actions.ts`)

- `subscribeToNewsletter` — upsert into `newsletter_subscriptions` (resubscribes unsubscribed emails), rate-limited.
- `unsubscribeFromNewsletter` — by the 48-hex `unsubscribe_token`.
- `submitContactForm` — lead + staff email.
- `enrollInFreeCourseAction` — signed-out visitors go to `/register?next=/courses/[slug]`; signed-in users go through `enrollInFreeCourse()` and land on `/learn/courses/[slug]`.

## Cache tags

Loaders in `src/lib/services/public/*` are tagged with `PUBLIC_TAGS` (`src/lib/services/public/tags.ts`). Admin actions should call `updateTag(...)` after edits so visitors see changes immediately:

| Tag | Invalidate after changing |
| --- | --- |
| `courses` | courses (status, details, featured, order), course instructors, lessons/modules |
| `course:<slug>` | one course's detail page |
| `categories` | course categories |
| `instructors` | teacher profiles (approval, public flag, bio) |
| `programs` | learning paths |
| `pricing`, `pricing:<courseId>` | products, plans, bundles, memberships |
| `reviews`, `reviews:<courseId>` | course review moderation |
| `cms`, `cms:home`, `cms:about` | CMS pages/sections |
| `faqs` | FAQs |
| `testimonials` | testimonials |
| `case-studies`, `case-study:<slug>` | case studies and success stories |
| `blog`, `blog:<slug>` | blog posts |
| `legal`, `legal:<slug>` | legal documents/versions |

Without an explicit invalidation, catalog/pricing data refreshes within minutes (`cacheLife("minutes")`) and editorial content within an hour (`cacheLife("hours")`). Plan availability (offer windows, stock) is evaluated inside the cached scope, so it can lag by the cache lifetime; checkout re-validates server-side.

## Database

Migration `supabase/migrations/20261114100000_site_public_reviews.sql` adds `public.get_published_course_reviews(p_course uuid, p_limit int)`, a `SECURITY DEFINER` function that returns published reviews of publicly visible courses with a privacy-preserving reviewer name ("Sam K."). Reviewer profiles are otherwise not readable anonymously.

## SEO

- `generateMetadata` on every page with canonical URLs from `NEXT_PUBLIC_APP_URL`, Open Graph and Twitter data.
- `src/app/opengraph-image.tsx` (site default) and `src/app/(site)/courses/[slug]/opengraph-image.tsx` render branded cards with `next/og` using the Funnel fonts in `src/components/site/og/fonts`.
- `src/app/sitemap.ts` lists static pages plus published courses, categories, programs, public instructors, blog posts, case studies/success stories and legal pages.
- `src/app/robots.ts` disallows `/learn`, `/teach`, `/admin`, `/api/`, `/checkout`, auth routes, `/newsletter/` and certificate detail pages.
- JSON-LD: Organization (home), Course + BreadcrumbList (course), BreadcrumbList (category), Person (instructor), ItemList (program), Article (blog, case studies), FAQPage (FAQ). Serialised with `serializeJsonLd`, which escapes `<`, `>`, `&` and line separators.

## Cookie consent and analytics

`src/components/site/cookie-consent.tsx` shows a banner until the visitor chooses. Strictly necessary cookies are always on; analytics are opt-in. The choice is stored in the first-party `fm_consent` cookie for 180 days. Google Analytics 4 (`analytics.ga_measurement_id`) and Plausible (`analytics.plausible_domain`) load only after consent; both IDs are set in Admin → Settings. "Cookie preferences" in the footer reopens the dialog. Turning analytics off reloads the page so already-loaded scripts stop.

The banner is mounted in the public site layout only; signed-in app areas do not load analytics.

## Design notes

- Hero: the headline steps forward line by line (one load sequence, reduced-motion safe) over a photograph with illustrative product UI (a lesson-progress card and a live-workshop card). These fragments are generic interface examples, not data about real learners.
- Sections with no real data (testimonials, case studies, instructors, pricing, reviews) hide; listing pages show explanatory empty states. Nothing is fabricated.
- Empty catalog state: all seeded courses are drafts, so until a course is published the home page and catalog show "courses are being prepared" with a sign-up prompt.

## Known limitations

- Preview lessons require a free account (the player lives under `/learn`).
- Plan availability shown on cached pages can lag by up to the cache lifetime (a few minutes); the checkout route is the source of truth.
- OG image fonts are read from `src/components/site/og/fonts` at runtime. If a deployment ever fails to trace them, add `outputFileTracingIncludes: { "/**/opengraph-image*": ["./src/components/site/og/fonts/*"] }` to `next.config.ts`.
