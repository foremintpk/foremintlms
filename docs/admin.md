# Admin workspace

The admin workspace (`/admin`) is where the academy is run day to day. Every page requires the `admin` role **and** an MFA-verified (`aal2`) session while *Settings → Security → Require an authenticator app* is on. This is enforced by `requireAdmin()` in each page and server action, and again in the database (`private.is_admin()` in RLS and in every analytics function).

This document covers the sections built in the admin workstream. Courses, live classes, commerce (pricing, bundles, coupons, payments, invoices, subscriptions), community (discussions, reviews, messages, support), email templates and personal account settings are documented by their own workstreams.

## Sections and routes

| Route | What it does |
| --- | --- |
| `/admin` | Overview: students, enrollments, net revenue and MRR in the default currency, published courses, instructors, completion, open tickets. "Needs attention" strip for courses awaiting review, instructors awaiting approval, open tickets and deletion requests. Enrollment and revenue trends, most popular courses, subscription status. Date-range filter (7/30/90 days, 12 months, custom). |
| `/admin/analytics` | Full analytics: sign-ups, enrollments, completions, gross payments and refunds per currency, MRR, new/cancelled subscriptions, course popularity and completion rates, assignment performance, instructor activity, tickets and certificates. Every chart has a "View as table" fallback. |
| `/admin/instructors` | Tabs: approved, waiting for approval, invitations, suspended. Invite by email (instructor or administrator role, optional courses and message); resend or revoke invitations; approve (sends `system.teacher_approved`). |
| `/admin/instructors/[id]` | Assign or remove courses (lead or assistant, can edit), edit the public profile (name, slug, bio, photo, expertise, links, public, featured, can create courses), suspend or reinstate teaching, and suspend, reactivate or delete the account. |
| `/admin/students` | Search by name, email or ID; filter by account status (including deletion requested); sort; CSV export. |
| `/admin/students/[id]` | Access records from every source, with **manual grant** (one course or all-access; 30/60/90/180/365 days, no end date, or until a date; reason required) and **revoke** (reason required). Also enrollments with progress, payments, certificates, tickets, recent learning and sign-in events. Account actions: suspend or reactivate, send a password reset, clear a deletion request, delete the account. |
| `/admin/enrollments` | Global list filtered by course, status, source and time; manual enrollment dialog (student search plus the same grant form). |
| `/admin/categories` | Create, edit, publish or archive categories; drag-and-drop ordering; image upload; assign courses; delete (only when empty). |
| `/admin/programs`, `/admin/programs/[id]` | Learning programs: details, cover image, level, featured; ordered course list with required/elective flags. A program can't be published until it has at least one course. |
| `/admin/content` | Typed editors for every home and about section defined in `src/lib/cms/sections.ts` (validated server-side with the same schemas); show/hide; drag-and-drop ordering; page SEO and sharing image. |
| `/admin/blog`, `/admin/blog/[id]` | Rich-text editor, cover image, category, tags, author, automatic reading time, draft / publish now / schedule / archive, SEO. Scheduled posts are switched to published by the `scheduled-publishing` cron job. |
| `/admin/testimonials` | CRUD with a mandatory consent checkbox. Publishing is blocked without consent in the UI, the server action and a database `CHECK` constraint. |
| `/admin/case-studies`, `/admin/case-studies/[id]` | Case studies and success stories: challenge, approach, implementation, outcome, media, related courses and SEO. Publishing requires consent, enforced the same way. |
| `/admin/faqs` | CRUD by category, drag-and-drop ordering, "show on home". |
| `/admin/legal`, `/admin/legal/[slug]` | Versioned legal documents: start a draft from the live version, edit, preview with placeholders filled from settings, publish (the previous version becomes *superseded*), full version history. A permanent notice says the drafts need legal review. |
| `/admin/leads` | Contact enquiries (status, bulk "mark contacted", reply by email) and newsletter subscribers (unsubscribe), both exportable. |
| `/admin/notifications` | Announcements to everyone, students, instructors or one course's learners. Publish now (in-app notification plus optional email), schedule (shown on dashboards at the publish time, with emails queued for that time), or save as a draft. Unpublishing or deleting cancels emails that haven't been sent. |
| `/admin/reports` + `/api/exports/[report]` | CSV exports: students, enrollments, payments, subscriptions, courses, tickets, leads, newsletter, certificates. Optional date range, 50,000-row cap, UTF-8 BOM, protection against spreadsheet formula injection, rate limit of 30 per 10 minutes, and an audit entry for every export. |
| `/admin/integrations` | Whop, Resend, Mux, Bunny Stream, YouTube, Zoom and Google: status, where each value comes from (environment or admin-entered), masked secrets, save (encrypted with `ENCRYPTION_KEY`), *Test connection*, webhook and OAuth URLs to copy, and setup steps. |
| `/admin/settings` | Brand, contact, legal entity, billing defaults, security (admin MFA, Google sign-in), messaging permission, upload limits and file types, reminder timing, analytics IDs. Each section has its own zod schema in `src/lib/services/admin/settings-schema.ts`. |
| `/admin/audit` | Admin activity (`audit_logs`, filterable by record type, actor and time, with full metadata) and sign-in and security events (`auth_events`). |

## Data and security model

- Pages and actions use `createClient()` (RLS as the admin). The service role is used only for:
  - tables with no client policies (`integration_settings`, `email_outbox` cancellation);
  - Supabase Auth admin calls (ban or unban, generate a reset link, delete a user);
  - the foundation services (`grantAccess`, `revokeAccess`, `notify`), and only after `assertAdmin()`.
- **Analytics**: `supabase/migrations/20261114106001_admin_analytics.sql` adds `admin_overview_metrics`, `admin_timeseries`, `admin_course_stats`, `admin_assignment_performance`, `admin_instructor_activity` and `admin_search_users`. Each is `SECURITY DEFINER` with `search_path = ''` and raises unless `private.is_admin()` is true. They aggregate in Postgres and zero-fill time buckets. Revenue is reported **per currency** and never summed across currencies. "Net" is gross minus refunds, from payments recorded through Whop webhooks and reconciliation.
- **MRR** (`src/lib/services/admin/metrics.ts`) counts subscriptions that are active, cancelling or past due (trials excluded). Calendar-style billing periods are normalised exactly: 28–31 days = 1×, 90 days = ÷3, 365 days = ÷12, 7 days = ×52/12.
- **Suspension** (`src/lib/services/admin/accounts.ts`): sets `profile_private.status = 'suspended'` with a reason, bans the user in Supabase Auth (`ban_duration: "876000h"`) so refresh tokens stop working, logs an auth event (`session_revoked`, `scope: suspension`) and an audit entry. Reactivation reverses both. RLS already denies suspended accounts through `private.has_role` and `private.is_active_account`. Access tokens that have already been issued stay valid until they expire (at most one JWT lifetime).
- **Account deletion** removes the user's personal uploads (avatar, submissions, attachments) and then the auth user. Most personal rows cascade; payment transactions and billing documents are kept with no link to the person, as tax and accounting law requires. An audit entry records the deletion with a SHA-256 hash of the email, never the email itself. Administrator accounts can't be deleted from this screen.
- **Integration secrets** never reach the browser. The UI only receives whether a value is set, where it came from and a masked preview. A blank secret field keeps the stored value, and "Remove saved value" clears it. Audit entries list the names of changed fields, never their values.
- Every mutation calls `audit()` and expires the matching public cache tags (`PUBLIC_TAGS` from `src/lib/services/public/tags.ts`, plus `SETTINGS_TAG` and `INTEGRATIONS_TAG`).

## Setup notes

1. Apply `20261114106001_admin_analytics.sql`. Overview, analytics and student search call these functions, and the pages show the error state until they exist.
2. Regenerate `src/types/database.ts` afterwards. The admin RPC calls go through `src/lib/services/admin/rpc.ts`, so they compile either way.
3. Fill in *Settings → Legal entity* and *Contact* before publishing the legal pages; missing placeholders are flagged in the legal editor.
4. Set the default currency in *Settings → Billing*; dashboards use it for headline revenue.

## Known limitations

- Suspension can't instantly kill access tokens that are already issued (the session-revocation SQL was intentionally not added). They expire within the JWT lifetime, and RLS denies a suspended account immediately in any case.
- Exports are built in memory and capped at 50,000 rows per file. Use date ranges for larger datasets.
- Scheduled announcements don't create bell notifications at publish time. They appear on dashboards at that time and, if chosen, are emailed then.
- The shared chart tokens (`--chart-2…5` in `globals.css`) fail the colour validator's lightness band for categorical use. Admin charts only use the single-series primary hue (`--chart-1`), which passes.
