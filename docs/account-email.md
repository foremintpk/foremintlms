# Accounts, authentication and email

This covers sign-up, sign-in, password reset, two-step verification (MFA), staff invitations, personal account settings, the notification centre, and the transactional email system.

## Routes

| Route | Purpose |
| --- | --- |
| `/register` | Create a student account (name, email, password with strength meter, terms consent). |
| `/verify-email` | "Check your inbox" plus a rate-limited "send a new link". |
| `/login` | Email + password, plus "Continue with Google" when enabled. |
| `/forgot-password`, `/reset-password` | Email a single-use reset link, then choose a new password (other sessions are signed out). |
| `/auth/confirm` | Landing point for every emailed auth link (`token_hash` + `type`). |
| `/auth/callback` | Google OAuth (PKCE) code exchange. |
| `/mfa` | Authenticator (TOTP) set-up or verification. Admins are sent here until their session is `aal2`. `?enroll=1` adds an authenticator. |
| `/invite/[token]`, `/invite/accepted` | Accept an instructor/admin invitation. |
| `/access-denied`, `/account-suspended` | Role and suspension notices. |
| `/learn/settings`, `/admin/account` | Personal settings: profile, security, notifications, privacy. `/teach/settings` embeds the same `AccountSettings` component. |
| `/learn/settings/export` | "Download my data" JSON export (read through the user's own RLS session). |
| `/learn/notifications`, `/teach/notifications` | Notification centre with realtime updates. |
| `/admin/emails`, `/admin/emails/[key]`, `/admin/emails/outbox`, `/admin/emails/sender` | Template editor with live preview and test send, outbox monitor (retry/cancel, delivery events), sender identity and connection test. |
| `/api/webhooks/resend` | Resend delivery events (Svix-signed). |

## How the auth flows work

We send our own branded auth emails instead of Supabase's built-in ones:

- **Sign-up**: the server calls `auth.admin.generateLink({ type: "signup" })`. That creates the unconfirmed user without sending email, and we queue `auth.verify_email` with a link to `/auth/confirm?token_hash=…&type=signup`. The response is the same whether or not the email already exists.
- **Resend verification**: a `magiclink` token for unconfirmed accounts. Opening it confirms the email and signs the person in.
- **Password reset**: `generateLink({ type: "recovery" })` → `auth.password_reset` → `/auth/confirm` → `/reset-password`. Saving signs out every other session and sends `auth.password_changed`.
- **Sign-in**: rate-limited per IP (20 per 15 min) and per email (8 per 15 min), with generic errors. Suspended accounts are blocked. Every attempt is written to `auth_events`. A user agent not seen in 90 days triggers `auth.new_account_security`.
- **Admins**: when `security.require_admin_mfa` is on (the default), admins go to `/mfa` after signing in, and the database helper `private.is_admin()` also requires an `aal2` JWT.
- **Invitations** (`src/lib/services/invitations.ts`):
  - The token is 32 random bytes; only its SHA-256 is stored, and links expire after 7 days.
  - Accepting with a new account creates it already confirmed (the token proves the person controls the address).
  - Instructors start as `pending`. The teaching area stays locked until an admin approves them in Admin → Instructors.
  - Admin invitations grant the admin role, followed by MFA set-up.
- **Security settings**: change password (verified with a throwaway client so the real session isn't disturbed), manage authenticator apps, and "Sign out of all other devices" (`signOut({ scope: "others" })`, logged as `session_revoked`). There's no per-device list, because Supabase doesn't expose sessions without extra SQL.

## Email system

- **Templates** live in `email_templates`. Admins edit the subject, preview text, heading, plain-text body (with `{{variables}}`) and button label.
  - The branded layout in `src/emails/compose.ts` is a table-based HTML template plus a plain-text version. Every value is HTML-escaped and only http(s) links become buttons.
  - Payloads may include `cta_url`, `details` (key/value rows), `line_items` and `total` (receipt table).
  - We use string templates rather than React Email because Next.js disallows `react-dom/server` inside server actions, which is where emails are queued. The `@react-email/*` packages are unused and can be removed.
- **Outbox**: `enqueueEmail()` writes to `email_outbox`, which is idempotent per key, then tries an immediate send after the response. The cron job `/api/cron/email-outbox` (every 5 minutes) is the safety net.
  - The worker claims rows with `SKIP LOCKED` and sends through Resend with the outbox idempotency key.
  - Failures retry with exponential backoff (2, 4, 8 … minutes, capped at 6 hours) up to `max_attempts`.
  - Disabled optional templates are marked `skipped`. Mail older than 7 days is cancelled rather than sent late.
- **Without Resend credentials**: nothing is pretended. Rows stay `failed` with "Resend is not configured" and retry hourly. In development only (`NODE_ENV !== "production"`), verification and reset links are also printed to the server console so you can test locally.
- **Staff views** never show single-use sign-in links: the outbox redacts `cta_url` for verification, reset and invitation emails.

## Configuration checklist

### Supabase → Authentication

1. **URL Configuration**: set **Site URL** to `NEXT_PUBLIC_APP_URL`. Add redirect URLs `https://YOUR_DOMAIN/auth/callback` and `https://YOUR_DOMAIN/auth/confirm` (and the localhost equivalents for development).
2. **Email provider**: keep **Confirm email** turned **on**. Our flows never call `signUp()`, so Supabase's own templates aren't used for sign-up, recovery or invitations. To stop Supabase sending anything at all, set custom SMTP to your Resend SMTP credentials so any remaining Supabase mail is branded and not rate-limited.
3. **Secure password change**: if you enable it, password changes older than 24 h after sign-in ask the user to sign in again (handled with a clear message).
4. **Multi-factor**: enable **TOTP (App authenticator)**.
5. **Google** (optional): enable the Google provider with your OAuth client. Its authorised redirect URI is `https://<project-ref>.supabase.co/auth/v1/callback`. Then turn on `security.allow_google_login` in Admin → Settings.

### Resend

1. Add your sending domain (a subdomain such as `mail.yourdomain.com` is recommended) and create the DNS records Resend shows:
   - **SPF**: a TXT record for the Resend return-path.
   - **DKIM**: the TXT/CNAME records.
   - **DMARC**: start with `v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com` and move to `quarantine`/`reject` once reports look clean.
2. Create an API key with sending access and set `RESEND_API_KEY`. Set `EMAIL_FROM` (for example `Foremint Academy <hello@mail.yourdomain.com>`), or set the sender in Admin → Email templates → Sender & delivery.
3. **Webhook**: add an endpoint at `https://YOUR_DOMAIN/api/webhooks/resend` with the `email.*` events, and copy its signing secret into `RESEND_WEBHOOK_SECRET`.
4. Use **Admin → Email templates → Sender & delivery → Test connection** to confirm the key works and the domain is verified.

## Limitations

- Email address changes aren't self-service: the profile shows the email read-only and directs people to support. This avoids Supabase's own email-change mails.
- Account deletion is a request (it records `deletion_requested_at` and opens a support ticket), because payment records must be retained. The deletion itself is done by an administrator.
- Live delivery through Resend, Google OAuth and the Resend webhook have not been tested against real accounts (no credentials were available). Unit tests cover composition, escaping, retry backoff, redirect safety, password rules and invitation states.
