# Foremint Academy — Architecture & Conventions

This is the working contract for the codebase. Read it before adding a feature.

## Stack

- **Next.js 16.4 (App Router, Turbopack)** with **Cache Components** and **Partial Prefetching** enabled (`next.config.ts`). Middleware is now `src/proxy.ts`.
- **React 19.3**, **TypeScript strict**, **Tailwind CSS v4**, **shadcn/ui (radix-nova style)**, **Lucide** icons.
- **Supabase**: Postgres + Auth + Storage + Realtime. Schema lives in `supabase/migrations/*.sql` (applied through the Supabase MCP / CLI).
- **Whop** payments (`@whop/sdk`), **Resend** + **React Email**, **Mux / Bunny Stream / YouTube** video, **Zoom / Google Meet** live classes.
- **Zod 4** for every input boundary. **Vitest** unit/integration tests, **Playwright** E2E.

## Next.js 16 rules that bite

1. **Cache Components**: reading `cookies()`, `headers()`, `searchParams` or the session outside `<Suspense>` is a build error **unless** the segment exports `export const instant = false`.
   - Every layout under `/learn`, `/teach`, `/admin` and every auth-dependent page exports `export const instant = false`.
   - Public marketing pages fetch data through `"use cache"` functions (with `cacheTag` + `cacheLife`) that use `createPublicClient()` (no cookies). Anything user-specific on a public page (e.g. header "Dashboard" button) sits in a small `<Suspense>` boundary.
2. **No synchronous IO during prerender** in public pages: no `new Date()`, `Date.now()`, `Math.random()`, `crypto.randomUUID()` in server components outside a dynamic boundary. Put them in client components, cached functions, or after `await connection()` inside `<Suspense>`.
3. **`generateStaticParams` must return ≥1 item** — we don't use it for DB-driven routes. Await `params` inside a `<Suspense>`-wrapped child for public dynamic routes, or mark the page `instant = false`.
4. **`usePathname`/`useParams` in shared layouts** must sit inside `<Suspense>` (nav components handle this already).
5. No `runtime`, `dynamic`, `revalidate` or `dynamicParams` segment exports — they are incompatible with Cache Components. Use `cacheLife`.
6. Route handlers: `export async function POST(req: Request)`; read raw body with `await req.text()` for signature verification.
7. Async request APIs: `await params`, `await searchParams`, `await cookies()`, `await headers()`.
8. `forbidden()`/`unauthorized()` are experimental — use the guards in `src/lib/auth/guards.ts` instead.

## Supabase access rules

| Client | File | Use |
| --- | --- | --- |
| `createClient()` | `lib/supabase/server.ts` | Server components/actions as the signed-in user. **RLS applies.** Default choice. |
| `createPublicClient()` | `lib/supabase/public.ts` | Anonymous cookie-less reads of published content, safe inside `"use cache"`. |
| `createAdminClient()` | `lib/supabase/admin.ts` | Service role, **bypasses RLS**. Only in trusted server code **after** an explicit permission check (guards), webhooks, cron. |
| `createClient()` | `lib/supabase/browser.ts` | Client components: realtime subscriptions only. |

- Roles come only from `public.user_roles` (+ `teacher_profiles.status = 'approved'` for teachers). Never from `user_metadata`.
- Admin = role `admin` **and** an `aal2` (MFA) session while `security.require_admin_mfa` is true. Both the TS guards and the SQL helper `private.is_admin()` enforce this.
- Writes that must never be client-initiated (enforced by RLS having **no** write policy): `course_entitlements`, `enrollments`, `lesson_progress`, `quiz_attempts`, `quiz_answers`, `assignment_submissions` (insert), `certificates`, all commerce tables, `notifications` (insert), `email_outbox`, `audit_logs`, `integration_settings`. Those go through services using the admin client after checks.
- Quiz questions/options are never readable by students; the server returns sanitized quiz payloads (no `is_correct`, no `accepted_answers`).
- Private storage buckets (`course-content`, `submissions`, `attachments`, `documents`) have no client policies. The server checks permissions and issues short-lived signed URLs (`lib/services/storage.ts`).

## Directory layout

```
src/
  app/
    (site)/              public marketing website (layout: header/footer)
    (auth)/              login, register, password reset, invitations
    learn/               student app      (instant = false)
    teach/               teacher app      (instant = false)
    admin/               admin app        (instant = false, MFA-gated)
    api/                 route handlers: webhooks, cron, files, pdf, oauth
  components/
    ui/                  shadcn primitives (do not edit casually)
    brand/               logo
    site/                marketing components
    app-shell/           dashboard shell, nav, page header
    common/              shared building blocks (empty states, data table, uploads, rich text…)
    learning/            player, outline, quiz runner, assignment submit
    course-builder/      shared by /teach and /admin
    communication/       messages, discussions, tickets
    billing/             invoices, plans, checkout buttons
  lib/
    env.ts  format.ts  actions.ts  audit.ts  settings.ts
    auth/                session.ts (getSessionUser), guards.ts
    security/            crypto (AES-GCM), rate-limit, request meta
    supabase/            clients + proxy session refresh
    services/            domain services (server-only): access, entitlements, progress, storage,
                         notifications, email, video/, live/, payments/whop, billing, certificates…
    validation/          zod schemas shared by forms and actions
  emails/                React Email templates + layout
  types/database.ts      generated Supabase types
supabase/migrations/     SQL migrations (schema, RLS, storage, seeds)
tests/{unit,integration,e2e}
docs/                    architecture, deployment, integrations
```

## Server actions

- Live next to their route in `actions.ts` files with `"use server"`.
- Signature: `(input) => Promise<ActionResult<T>>` wrapped in `runAction(async () => { … })` from `lib/actions.ts`.
- Always: guard (`assertUser`/`assertAdmin`/`assertCourseEditor`…) → `schema.parse(input)` → do work → `audit()` for sensitive changes → `updateTag()`/`revalidatePath()` → `ok(data, "Saved")`.
- Throw `UserFacingError` for messages the user should see. Never return raw provider/SQL errors.
- Sensitive public endpoints (login, register, contact, newsletter, checkout) call `enforceRateLimit()`.

## UI conventions

- Pages start with `<PageHeader title description actions />` (`components/app-shell/page-header.tsx`).
- Every list has empty, loading (`loading.tsx` or Suspense skeleton) and error (`error.tsx`) states.
- Tables: server-side search/filter/sort/pagination through URL search params (`components/common/data-table`).
- Forms: shadcn `Field*` components + `useActionForm` hook; buttons use active, specific labels ("Save course", "Publish course"); toasts echo the same verb ("Course published").
- Sentence case everywhere. No all-caps eyebrow labels. Mint (`text-mint-strong`, `bg-mint-soft`) is reserved for progress/success; violet (`primary`) is the brand/action colour.
- Money is stored in integer cents; format with `formatMoney`. Times are UTC in the DB and rendered in the viewer's time zone.
- No fabricated social proof: testimonials, reviews, case studies and stats render only from published DB rows; sections hide when empty.

## Route map

Public: `/`, `/about`, `/courses`, `/courses/[slug]`, `/categories/[slug]`, `/instructors`, `/instructors/[slug]`, `/programs`, `/programs/[slug]`, `/pricing`, `/testimonials`, `/case-studies`, `/case-studies/[slug]`, `/success-stories`, `/success-stories/[slug]`, `/blog`, `/blog/[slug]`, `/faq`, `/contact`, `/legal/[slug]`, `/certificates/verify`, `/certificates/verify/[number]`, `/checkout/[planId]`, `/checkout/success`, `/payment/complete` (custom invoice payment links), `/newsletter/unsubscribe`.

Auth: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/auth/confirm`, `/auth/callback`, `/invite/[token]`, `/join/[token]` (company and purchase invitations), `/mfa` (admin MFA enrol/verify), `/access-denied`, `/account-suspended`.

Student `/learn`: dashboard, `courses`, `courses/[slug]`, `courses/[slug]/lessons/[lessonId]`, `courses/[slug]/quizzes/[quizId]`, `courses/[slug]/assignments/[assignmentId]`, `courses/[slug]/discussions[/id]`, `live`, `assignments`, `certificates`, `messages[/id]`, `support`, `support/new`, `support/[id]`, `billing`, `company` (company members only), `notifications`, `settings`.

Teacher `/teach`: dashboard, `courses`, `courses/new`, `courses/[id]` (+ `/curriculum`, `/lessons/[lessonId]`, `/quizzes[/quizId]`, `/assignments[/assignmentId]`, `/live`, `/students`, `/discussions`, `/analytics`), `students`, `students/[id]`, `reviews`, `live`, `questions`, `messages[/id]`, `support[/id]`, `analytics`, `notifications`, `settings`.

Admin `/admin`: overview, `courses` (+ builder under `courses/[id]/…`), `categories`, `programs`, `instructors[/id]`, `students[/id]`, `enrollments`, `pricing[/productId]`, `bundles`, `coupons`, `payments[/id]`, `invoices`, `subscriptions`, `billing` (+ `billing/invoices[/new|/id]`, `billing/companies[/id]`, `billing/members`, `billing/subscriptions`, `billing/expiring`, `billing/settings` — see docs/custom-invoicing.md), `live`, `discussions`, `reviews`, `messages`, `support[/id]`, `testimonials`, `case-studies`, `content`, `blog[/id]`, `faqs`, `emails`, `notifications`, `legal`, `analytics`, `reports`, `leads`, `integrations`, `settings`, `audit`.

API: `/api/webhooks/{whop,mux,bunny,zoom,resend}`, `/api/cron/[job]`, `/api/files/[id]`, `/api/uploads/{sign,complete}`, `/api/progress`, `/api/certificates/[id]/pdf`, `/api/billing/documents/[id]/pdf`, `/api/billing/custom-invoices/[id]/{summary,whop-pdf}`, `/api/integrations/{zoom,google}/{connect,callback}`, `/api/exports/[report]`.
