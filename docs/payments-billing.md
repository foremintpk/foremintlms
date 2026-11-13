# Payments & billing (Whop)

Foremint sells through **Whop** and keeps its own records of what was sold and what access it grants. Whop processes the money. Foremint decides access, and only from **verified server-side state**: a signature-verified webhook followed by a fresh API read of the payment or membership. A browser redirect from checkout never grants access.

## What's built

| Area | Where |
| --- | --- |
| Whop client, connection test | `src/lib/services/payments/whop.ts` (`getWhopClient`, `testWhopConnection`) |
| Catalog sync (products → Whop products, plans → Whop *variants*, coupons → Whop promo codes) | `src/lib/services/payments/catalog.ts` |
| Checkout | `src/lib/services/payments/checkout.ts`, route `GET /checkout/[planId]`, pages `/checkout/success`, `/checkout/unavailable` |
| Webhooks | `src/lib/services/payments/webhooks.ts`, route `POST /api/webhooks/whop` |
| Payment → access sync | `src/lib/services/payments/sync.ts` |
| Reconciliation + failed-event retries | `src/lib/services/payments/reconcile.ts` (`reconcileWhopPayments`, `retryFailedWebhookEvents`) |
| Refunds | `src/lib/services/payments/refunds.ts` |
| Pure mapping rules (unit tested) | `src/lib/services/payments/mapping.ts`, `src/lib/services/billing/receipt-model.ts` |
| Billing documents + branded PDF | `src/lib/services/billing/documents.ts`, `src/lib/pdf/receipt.tsx`, `GET /api/billing/documents/[id]/pdf` |
| Learner billing | `/learn/billing` |
| Admin | `/admin/pricing`, `/admin/pricing/[productId]`, `/admin/bundles`, `/admin/bundles/[productId]`, `/admin/coupons`, `/admin/payments`, `/admin/payments/[id]`, `/admin/payments/webhooks`, `/admin/payments/reconciliation`, `/admin/invoices`, `/admin/subscriptions`, CSV `GET /api/billing/exports/payments` |
| SQL | `supabase/migrations/20261114105000_payments_functions.sql` (document numbering, atomic counters, idempotent documents, webhook retry claiming) |

## Whop setup (dashboard)

1. **Choose an environment.** Build and test in the sandbox (`sandbox.whop.com`, API `https://sandbox-api.whop.com/api/v1`). No real money moves there. Sandbox and production share no accounts, keys, products or webhooks, and their keys look identical, so never mix them. Set `WHOP_ENVIRONMENT=sandbox` (or choose *Sandbox* in Admin → Integrations) while testing.
2. **Company ID.** This is your account id, prefixed `biz_`. Set it as `WHOP_COMPANY_ID`.
3. **API key.** Create it in Developer → API keys and set it as `WHOP_API_KEY`. The key needs permission to:
   - create and update products and variants (the legacy scope names are `access_pass:create`, `access_pass:update`, `plan:create`, `plan:update` and `plan:basic:read`)
   - create and read checkout configurations (`checkout_configuration:create`, `checkout_configuration:basic:read`)
   - read payments, and refund them
   - read members and memberships (`member:basic:read`), member emails (`member:email:read`, used to match buyers who skip Foremint checkout), and `member:manage` (needed for the buyer's billing-management link)
   - create, activate and deactivate promo codes

   Whop names scopes per resource. If a call fails with *permission denied*, Admin → Integrations → Test connection and the plan or coupon sync error show which call was refused.
4. **Webhook.** In Developer → Webhooks, add `https://<your-domain>/api/webhooks/whop` and subscribe to these events:
   - `payment.succeeded`, `payment.failed`, `payment.pending`, `payment.created`, `payment.authorized`, `payment.requires_action`, `payment.canceled`
   - `membership.activated`, `membership.deactivated`, `membership.updated`, `membership.cancel_at_period_end_changed`
   - `refund.created`, `refund.updated`
   - `dispute.created`, `dispute.updated`, `dispute_alert.created`

   Copy the signing secret (it starts `ws_`) into `WHOP_WEBHOOK_SECRET` exactly as shown, prefix included. Whop shows it only once.
5. **Sync the catalog.** Add plans in Admin → Pricing & plans, then press **Sync to Whop**.

Credentials can also be entered in Admin → Integrations, where they're stored AES-GCM encrypted. Environment variables take precedence.

## Purchase workflow

1. The learner picks a plan. Site links go to `/checkout/<planId>`.
2. The server checks:
   - that the learner is signed in, and rate-limits checkout attempts
   - that the plan is available (not archived, inside its sale window, not sold out) and the course is published
   - that the learner doesn't already hold the access they'd be buying (if they do, they're sent to their course or billing page)
3. **Free plans** are granted immediately through `grantAccess`.
4. **Paid plans:**
   - A `checkout_sessions` row is created.
   - A Whop checkout configuration is created for the synced variant, with metadata `{ foremint_user_id, checkout_session_id, plan_id, product_id, context, course_ids }` and `redirect_url=/checkout/success?session=<id>`.
   - The learner is sent (303) to Whop's hosted `purchase_url`.
5. Whop processes the payment. The payments and memberships it creates inherit the checkout metadata.
6. The webhook arrives:
   - The signature is verified (`unwrapWebhook` from `@whop/sdk/helpers`, Standard Webhooks headers) and the event is stored by `webhook-id`.
   - The payment or membership is **re-fetched from the API** and mapped to our records.
7. The access decision:
   - The metadata is trusted only if it matches a checkout session we created for the same learner and plan.
   - **Fallback matching:** by checkout configuration id, then the known Whop customer, then a unique account email. Purchases that can't be matched are recorded as *Not matched* in Admin → Payments, with no access granted.
   - **One-time plans:** `grantAccess` with `computeAccessWindow` (N days or lifetime).
   - **Subscriptions:** the live membership status goes through `entitlementForMembership` to `grantAccess` or `setSubscriptionAccess`. Renewals extend expiry, cancellation keeps access to the period end, past-due keeps it through the grace period, and expiry or deactivation ends it.
8. `/checkout/success` polls until an entitlement linked to the checkout session exists, then shows **Start learning**. The `status` query parameter Whop appends is only a hint and never grants anything.

Everything is idempotent:
- **Webhooks:** retries reuse `webhook-id`, and processed events are acknowledged without running again.
- **Entitlements:** one per payment or subscription per course.
- **Emails:** every email has an idempotency key.
- **Documents:** unique per transaction, issuer and type.
- **Counters:** units sold and coupon redemptions are counted once, guarded by flags stored on the transaction.

## Refunds, disputes, failures

- **Admin refund.** In Admin → Payments → a payment → **Refund**, choose full or partial and give a reason, which is audit-logged. The refund goes through `payments.refund`, and the refunded payment is then applied immediately along the same path the `refund.*` webhook takes, so the later webhook changes nothing.
  - A full refund revokes the access it paid for and creates a credit note.
  - A partial refund keeps access and updates the credit note.
- **Disputes.** Access is suspended while a dispute is open, restored if the dispute is won, and revoked if it's lost.
- **Failed payments.** These trigger the required `billing.payment_failed` email, using Whop's recovery URL when there is one.

## Reconciliation and retries

- **Reconciliation** runs daily (`/api/cron/payment-reconciliation`), or manually from Admin → Payments → Reconciliation. It:
  - re-reads live subscriptions and memberships (plus anything touched in the last 45 days) from Whop, re-applies them, and records any drift
  - imports or updates Whop payments from the last 3 days that are missing locally or differ
  - re-checks local payments that have been pending for more than an hour
  - sends `billing.subscription_expiring` a week before a cancelled subscription ends

  Each run is logged in `payment_reconciliation_logs` with field-level differences. An old successful payment is never taken as proof that a subscription is still active: the membership's live status decides.
- **Retries.** Failed events return a non-2xx response so Whop retries them (12 times over about 71 hours, per Whop's docs). They also get an exponential `next_attempt_at` (1 minute up to 6 hours). The `webhook-retries` cron runs them again, and admins can retry a single event from Admin → Payments → Webhook events. Events stuck in *processing* are released after 15 minutes.

## Receipts and invoices policy

- **Whop's own receipt.** Every confirmed payment gets an `issuer = whop` document. Downloading it calls `payments.generatePdf`, which returns a short-lived Whop-hosted URL that we redirect to.
- **Foremint receipt.** Every confirmed payment also gets an `issuer = foremint` receipt, numbered `FMA-R-YYYY-NNNNNN` and generated from the verified Whop payment. It is frozen at issue time, labelled as *generated by Foremint Academy from Whop payment `pay_…`*, and never presented as a Whop document. Totals come from `computeTotals`, with Whop's total as the authority and a visible note if the line items differ.
  - Tax is shown only as Whop reports it.
  - The legal entity, address, registration number and tax ID are printed only if they're set in Admin → Settings (`legal.*`). Nothing is invented.
- **Credit notes** (`FMA-CN-…`) record refunds.
- **Emails.** `billing.payment_confirmation` (with details and line items) is always sent. Because Whop already emails its own receipt, `billing.receipt_available` is sent only when the `billing.send_foremint_receipts` setting is on.

## Plans → Whop variants

Plans map to Whop variants as follows:

| Our plan | Whop variant |
| --- | --- |
| One-time | `billing_type = one_time`, `initial_price`, `expiration_days` for fixed-term access |
| Subscription | `billing_type = renewal`, `renewal_price` per `billing_period` days, optional `trial_period_days` |

Other rules:
- Prices are sent in major units. Whop requires at least 1.00 for paid plans, which the admin form enforces.
- Stock syncs as the remaining number of places.
- The compare-at price becomes Whop's strike-through price.
- Variants are kept **hidden** on Whop's storefront, so every purchase starts from Foremint checkout. That enforces sale windows and attaches the metadata that identifies the learner.
- Changing a plan's billing type archives the old variant and creates a new one. Existing subscribers stay on the old variant.

## Limitations and things to verify with live credentials

- **Not tested against a live Whop account.** No sandbox or production credentials were available. Webhook intake, signature verification and the mapping rules are covered by unit tests (`tests/unit/payments`), including Standard Webhooks test vectors built the way Whop signs.
- **`redirect_url` timing.** Whop's legacy docs describe the checkout configuration's `redirect_url` inconsistently (after checkout vs after creation). Confirm in the sandbox that buyers return to `/checkout/success`. Access doesn't depend on it.
- **Promo codes:**
  - Discounts apply to the first payment only (`promo_duration_months: 1`).
  - Whop promo codes can't be edited after creation (only activated or deactivated), so the UI archives and recreates them instead.
  - A coupon start date isn't supported by Whop's promo code API, so it isn't offered.
- **Scope names.** Whop's docs list permissions per endpoint and some names are legacy (`access_pass:*`, `plan:*`). Confirm the key's permissions with **Test connection** and the sync error messages.
- **Currency.** Amounts are stored in hundredths. Zero-decimal currencies (such as JPY) would need an extra formatting rule. USD is the default.
- **Purchases outside Foremint checkout** (for example a Whop link shared directly) are matched by Whop customer or a unique email. If neither matches, the payment appears as *Not matched* for an admin to resolve.
- **Webhook response time.** Whop expects a response within 5 seconds. Processing is synchronous, and if Whop times out it simply retries, which the idempotency rules make safe.
