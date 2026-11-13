# Deployment & environment setup

This guide takes Foremint Academy from an empty Supabase project to a live Vercel deployment. Third-party specifics live in the area guides:

- [payments-billing.md](payments-billing.md) — Whop
- [account-email.md](account-email.md) — Supabase Auth settings, Resend
- [course-builder-video.md](course-builder-video.md) — Mux, Bunny Stream, YouTube
- [teaching-live.md](teaching-live.md) — Zoom, Google Meet

## 1. Supabase

1. **Apply migrations** in `supabase/migrations/` in filename order. They are additive and idempotent where possible; never run them against a production database without a backup (Dashboard → Database → Backups) and a review of what changes.
   - With the Supabase MCP server (`.mcp.json`): ask Claude to apply the migrations.
   - With the CLI: `npx supabase link --project-ref <ref>` then `npx supabase db push`.
   > **This project (`avijlwhtadinxpfpddhi`) was migrated through the Supabase MCP**, which records its own migration names/versions (the larger files were applied in smaller parts). Its schema matches `supabase/migrations/`, but the CLI history does not. Before ever running `supabase db push` against it, mark the repository files as applied so they are not re-run:
   > ```bash
   > npx supabase migration repair --status applied $(ls supabase/migrations | cut -c1-14 | tr '\n' ' ')
   > ```
   > The session-management RPCs (`list_my_sessions`, `revoke_my_session`, `revoke_user_sessions`) were intentionally not created; the app uses `signOut({ scope: "others" })` and account bans instead.
2. **Run the RLS test suite** `supabase/tests/rls_security_test.sql` in the SQL editor. It always rolls back; success is the message `RLS_SUITE_PASSED`. Any other error names the rule that failed.
3. **Auth → URL configuration**
   - Site URL: `https://<your-domain>`
   - Redirect URLs: `https://<your-domain>/auth/confirm`, `https://<your-domain>/auth/callback`, and `http://localhost:3000/**` for development.
4. **Auth → Emails**: the app sends its own branded verification, password-reset and invitation emails through Resend using `generateLink`, so Supabase's default emails are not used. Keep *Confirm email* enabled. Optionally point Supabase's SMTP at Resend as a fallback.
5. **Auth → Multi-factor**: enable *TOTP (authenticator app)*. Administrators are required to use it.
6. **Auth → Providers → Google** (optional): enable it with the Google OAuth client and turn on *Allow Google login* in Admin → Settings.
7. **Storage**: buckets are created by the migrations (`public-media`, `avatars`, `course-content`, `submissions`, `attachments`, `documents`). On the Free plan the global upload limit is 50 MB — raise it under Storage settings on paid plans if you allow larger course files.
8. **API keys**: copy the project URL, the publishable key and the secret key into the environment (below).
9. **First administrator**: `npm run admin:bootstrap -- --email you@example.com --name "Your Name"`, then sign in and enrol an authenticator app at `/mfa`.

## 2. Environment variables

Copy `.env.example` to `.env.local` (development) and set the same variables in Vercel (Production + Preview). Generate the app secrets with `npm run keys:generate`. Only `NEXT_PUBLIC_*` values reach the browser.

Integration credentials can alternatively be entered in **Admin → Integrations**; they are stored AES-256-GCM encrypted with `ENCRYPTION_KEY`. Environment variables take precedence. Rotating `ENCRYPTION_KEY` makes stored integration secrets and meeting OAuth tokens unreadable — re-enter them afterwards.

## 3. Vercel

1. Import the Git repository in Vercel (framework preset: Next.js; build command `npm run build`; Node 20+).
2. Add all environment variables. Set `NEXT_PUBLIC_APP_URL` to the production URL.
3. **Cron jobs** — two layers, so it works on any Vercel plan:
   - `vercel.json` runs every job **once a day** (allowed on Hobby). Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` is set.
   - Frequent schedules come from **Supabase pg_cron + pg_net** (free, plan-independent). After the first deploy, enable the `pg_cron` and `pg_net` extensions and schedule:

   | Job | Schedule |
   | --- | --- |
   | email-outbox | every 5 min |
   | live-reminders | every 10 min |
   | scheduled-publishing, webhook-retries, video-sync | every 15 min |
   | entitlement-expiry, assignment-reminders, live-artifacts, certificates | hourly |

   ```sql
   select cron.schedule('foremint-email-outbox', '*/5 * * * *', $$
     select net.http_post(
       url := 'https://<your-domain>/api/cron/email-outbox',
       headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
     );
   $$);
   ```
   On Vercel **Pro** you can instead put these frequencies straight into `vercel.json`.

4. **Custom domain**: Vercel → Project → Domains → add the domain, create the DNS records Vercel shows, then update `NEXT_PUBLIC_APP_URL`, Supabase Auth URLs, and every webhook / OAuth redirect URL to the new domain.

## 4. Webhooks to register

| Provider | URL | Secret env var |
| --- | --- | --- |
| Whop | `https://<domain>/api/webhooks/whop` | `WHOP_WEBHOOK_SECRET` |
| Resend | `https://<domain>/api/webhooks/resend` | `RESEND_WEBHOOK_SECRET` |
| Mux | `https://<domain>/api/webhooks/mux` | `MUX_WEBHOOK_SECRET` |
| Bunny Stream | `https://<domain>/api/webhooks/bunny?secret=<BUNNY_WEBHOOK_SECRET>` | `BUNNY_WEBHOOK_SECRET` |
| Zoom | `https://<domain>/api/webhooks/zoom` | `ZOOM_WEBHOOK_SECRET_TOKEN` |

OAuth redirect URIs: `https://<domain>/api/integrations/zoom/callback` and `https://<domain>/api/integrations/google/callback`.

## 5. Email domain (Resend)

Add the sending domain in Resend and create the DNS records it lists: **SPF** (TXT), **DKIM** (CNAME/TXT), and a **DMARC** policy such as `v=DMARC1; p=quarantine; rua=mailto:dmarc@<domain>`. Use a subdomain (e.g. `mail.<domain>`) to protect the root domain's reputation. Set `EMAIL_FROM` to an address on the verified domain.

## 6. Verify the deployment

- `/` renders; `/sitemap.xml` and `/robots.txt` respond.
- Register a student account → verification email arrives (Admin → Email templates → Outbox shows *sent*).
- Admin → Integrations shows each provider's status; use *Test connection*.
- Create a course draft, publish it, add a plan, sync it to Whop, make a test purchase in Whop's sandbox/test mode and confirm the enrollment appears only after the webhook.
- `curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/email-outbox` returns `{"ok":true}`.

## 7. Checks before go-live

- `npm run typecheck && npm run lint && npm test && npm run build`
- `npm run test:e2e` against a staging deployment (`E2E_BASE_URL=…`).
- Legal pages reviewed by a lawyer; legal entity, address and jurisdiction filled in Admin → Settings.
- Admin MFA enforced (Admin → Settings → Security).
