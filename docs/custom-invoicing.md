# Custom invoicing, payment links and company access

Admins sell negotiated packages — any courses (or all, optionally including future ones), any price, one-time or recurring — to an individual or a company. Whop collects the money; Foremint provisions access only from verified Whop state.

## How a client pays: two collection methods

| | Direct payment link (default) | Official Whop invoice |
| --- | --- | --- |
| What the client gets | One link to Whop's hosted checkout | A numbered Whop invoice with PDF, due date and Whop reminders |
| Who can pay | Anyone holding the link, without signing in first | Only the invoiced customer (signs in to Whop as the invoiced email) |
| Whop objects | Hidden product + hidden variant (`stock: 1`) + checkout configuration | Native invoice (`pay_…`) with an inline hidden product/variant |
| Paid twice? | No: the variant has one unit and the checkout is deleted after payment | No: an invoice is paid once |
| Requirements | Whop API key + company id | Also a **verified** Whop business account (`invoice_account_verification_required` otherwise) |
| Financial record | Whop's payment receipt PDF | Whop's invoice PDF |

Both create isolated Whop products, so public plans and course prices never change. Choose per invoice; the default is in **Invoice settings**.

## Admin workflow

**Admin → Billing & invoicing**: Billing overview, Custom invoices, Create custom invoice, Company accounts, Company members, Payment history, Subscriptions, Invoice subscriptions, Expiring access, Receipts & documents, Invoice settings.

1. **Create custom invoice** (`/admin/billing/invoices/new`): customer type (individual / new or existing company), description, courses (selected · all published today · all including future), payment method, amount and currency, one-time access (30/60/90/180/365 days, custom days, until a date, lifetime) or recurring billing (monthly/quarterly/6-monthly/annual/custom 2–365 days, optional upfront fee, optional fixed number of payments 2–115, grace period), due date, optional link expiry. A live summary shows the first payment, renewal amount and the end date if paid today.
2. **Review** shows every commercial term; the admin must tick a confirmation before **Create payment link / Generate Whop invoice**. "Save as draft" works without Whop.
3. **Invoice details** (`/admin/billing/invoices/[id]`): copy/open the link, email it (branded Foremint email, or Whop's own email for native invoices), refresh payment status from Whop, branded service summary (preview/download/regenerate), Whop PDF, duplicate, create revised invoice, void, cancel subscription, approve a held payment, extend/suspend/restore access, resend activation invitations, activity timeline, payments.

Duplicates and revisions open the builder prefilled; a revision records `revision_of` and leaves the original open until you void it.

## Statuses

`draft → pending_generation → awaiting_payment → paid`, plus `past_due` (due date passed), `failed` (last attempt declined; link still payable), `expired` (link expiry reached — voided on Whop), `cancelled`, `voided`, `refunded`, `partially_refunded`, `under_review`.

`under_review` means money may have arrived but **no access was granted**: wrong amount/currency/Whop account, paid after the invoice was voided/expired, paid after a fixed access end date, or a dispute. An admin can approve it (reason required; Whop must still report the payment as paid).

## Payment verification and webhooks

Webhooks keep using `POST /api/webhooks/whop` (Standard Webhooks signature over the raw body via `unwrapWebhook`, events stored by `webhook-id`, duplicates acknowledged without re-running). For every `payment.*`, `refund.*`, `dispute*` and `membership.*` event the payment or membership is **re-fetched from Whop**; `src/lib/services/payments/sync.ts` then routes it to custom invoicing when it belongs to one:

- native invoice: `payment.id` equals the invoice's `pay_` id
- payment link: `payment.checkout_configuration_id` or `payment.variant_id` matches the invoice's dedicated checkout/variant
- renewals: `payment.membership_id` matches the subscription the invoice started

Native invoices emit `payment.*` events (the `invoice.*` events belong to Whop's legacy invoice API and are ignored).

Before access is granted (`src/lib/services/invoicing/fulfillment.ts`): Whop account id, currency, exact pre-tax amount (`amount`, or `upfront fee + recurring price` for the first recurring payment), and that the invoice is still collectable. The invoice is claimed with a conditional status update, the package is unique per invoice, access rows are upserted in SQL, and every email/event carries an idempotency or dedupe key — a retried or out-of-order webhook can't double-provision, double-extend or double-email. Slow work is not done in the webhook: emails go to the durable `email_outbox`, PDFs are rendered on demand. Fulfilment needs a few fast queries plus one Whop read; if it fails the event is recorded with backoff and Whop retries it.

Backstops: the success page (`/payment/complete?ref=…`) asks Whop for the status (rate-limited) and only reports it; the daily `invoicing` cron re-reads open invoices from Whop; admins can press **Refresh payment status**. None of them trust the URL.

## Provisioning

- **Individual, existing account** (matched by email): access immediately.
- **Individual, no account**: a single-use activation invitation (`/join/<token>`, 7 days by default, resend rotates the token). The person creates their password there (Supabase Auth `admin.createUser`, email confirmed by the token) and the package attaches to their new Student account.
- **Company**: the workspace is created on payment (or the chosen existing company is used). The primary contact is added as manager if they have an account, otherwise invited. Both the contact and Foremint admins can invite employees (`company_member` invitations); each employee keeps their own login, progress, submissions and certificates.

No account or workspace receives access before a verified payment, and invitations alone never grant access.

## Access model

`invoice_entitlements` is the paid package (courses + window), owned by a company or one user. `sync_invoice_entitlement_access()` (SQL, atomic, idempotent) writes one `course_entitlements` row per beneficiary and course — or one all-access row when future courses are included — linked by `invoice_entitlement_id`. Every existing access check (route guards, `private.has_course_access` RLS, signed video/download URLs, discussions) therefore applies unchanged and compares `expires_at` with `now()` on each request; the cron only flips statuses and sends emails.

- Late joiners inherit the package's end date (not a new period).
- Removing a member revokes only their company-derived rows; their own purchases and progress stay.
- Suspending a company suspends all its packages' access at once.
- Recurring packages follow Whop's live membership: renewals move the end to the new period end (+ grace while past due), cancellation keeps access to the paid-through date, a fixed number of payments caps the end date. A refunded/disputed package is never reactivated by membership events.
- Refunds/disputes follow **Invoice settings** (defaults: full refund revokes, partial keeps, dispute suspends; a lost chargeback revokes, a won dispute restores).
- Manual extensions (add days from end / from today / set date) require a reason and are written to the company audit log and invoice timeline.

## Roles and permissions

Three platform roles only. Company management is a capability on the membership row (`can_invite_members`, `can_view_billing`), resolved from the database on every request — never from user metadata or a client-supplied company id.

| | Admin | Company contact / manager | Employee | Teacher | Visitor |
| --- | --- | --- | --- | --- | --- |
| Create/void invoices, see amounts & notes | ✓ | – | – | – | – |
| See own company's courses & expiry | ✓ | ✓ | ✓ | – | – |
| Invite / resend / revoke / remove employees | ✓ | ✓ (members only, not managers) | – | – | – |
| See company invoices | ✓ | primary contact | – | – | – |
| Change contact, seats, extend, suspend | ✓ | – | – | – | – |

RLS: commercial tables (`custom_invoices`, `whop_invoice_mappings`, events, company audit) are admin-read-only; members read their own membership and company; managers read their company's members and invitations (token hashes are column-revoked); there are no client write policies at all.

## Branded service summary

`/api/billing/custom-invoices/[id]/summary` renders an A4 PDF (`src/lib/pdf/service-summary.tsx`) with only: contact name, company, company description, services, service description, courses and access period — no prices, phone numbers, notes, addresses or ids. It says it is not a tax invoice and points to Whop's document. Versions are stored in the private `documents` bucket (`custom-invoices/<id>/service-summary-vN.pdf`); admins, the individual purchaser and the company's billing contact can download it.

## Whop permissions

Least privilege for the API key, by call:

| Call | Permission |
| --- | --- |
| Create hidden product (link) / inline product (invoice) | `access_pass:create`; archive: `access_pass:update` |
| Create variant (link) / inline variant (invoice) | `plan:create`; archive: `plan:update` |
| Create/delete checkout configuration (link) | `checkout_configuration:create` (+ delete) |
| Create, issue, send, void native invoices | `payment:charge` |
| Retrieve invoices, payments, PDFs; list payments by variant | `payment:basic:read` |
| Membership state and cancellation | `member:basic:read`, `member:manage` |
| Customer emails on invoices | `member:email:read` |

API version pinned to `2026-11-11` (`WHOP_API_VERSION`).

## Webhook events to subscribe

Already required by checkout: `payment.created`, `payment.pending`, `payment.succeeded`, `payment.failed`, `payment.canceled`, `payment.requires_action`, `payment.authorized`, `membership.activated`, `membership.updated`, `membership.deactivated`, `membership.cancel_at_period_end_changed`, `refund.created`, `refund.updated`, `dispute.created`, `dispute.updated`, `dispute_alert.created`. No extra events are needed for custom invoices.

## Testing in the Whop sandbox

1. Admin → Integrations: environment **Sandbox**, sandbox API key and `biz_` id, webhook signing secret from the sandbox dashboard pointing at `https://<site>/api/webhooks/whop`.
2. Create a custom invoice with **Direct payment link**, open the link, pay with Whop's sandbox test card. No real money moves.
3. Watch the invoice turn **Paid** (webhook) — or press **Refresh payment status**. Check the activation/company emails in Admin → Email templates → Outbox.
4. For native Whop invoices, first complete business verification in the sandbox dashboard; until then issuing returns `invoice_account_verification_required` and the invoice stays in *Pending generation* with that message.

Sandbox and production share nothing; each invoice records its environment and refuses to continue in the other one.

## Code map

| Area | Where |
| --- | --- |
| Rules (money, windows, verification, statuses) | `src/lib/domain/invoicing.ts` (unit-tested) |
| Input schemas | `src/lib/validation/invoicing.ts` |
| Whop calls | `src/lib/services/invoicing/whop-invoices.ts` |
| Admin operations | `src/lib/services/invoicing/invoices.ts` |
| Fulfilment (webhook path) | `src/lib/services/invoicing/fulfillment.ts` |
| Packages → access | `src/lib/services/invoicing/access.ts` |
| Companies, invitations, acceptance | `companies.ts`, `invitations.ts`, `acceptance.ts`, `company-portal.ts` |
| Cron | `maintenance.ts` → `/api/cron/invoicing` (daily) |
| SQL | `supabase/migrations/20261114120000_custom_invoicing.sql`, `20261114121000_custom_invoice_payment_links.sql` |
| Pages | `src/app/admin/billing/**`, `src/app/learn/company`, `src/app/(auth)/join/[token]`, `src/app/(site)/payment/complete` |
| Tests | `tests/unit/invoicing/*`, `tests/integration/custom-invoicing.test.ts`, `tests/e2e/invoicing.spec.ts` |
