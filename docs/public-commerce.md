# Course selector, guest checkout and the course advisor

Visitors choose several courses on **Build your learning plan** (`/courses/select`), pay once without creating an account first (or send the payment link to someone else), and get their courses after the payment is verified. The **course advisor** chatbot (bottom-left on every public page) recommends courses from admin-written rules and uses the same cart and checkout. It is rule-based: no AI service, model or library is involved.

One catalogue, one pricing engine, one cart, one Whop integration, one entitlement system, one sign-in system.

## How it reuses what exists

| Concern | Reused | New |
| --- | --- | --- |
| Prices | `pricing_plans`: a course's one-time plan for an access period. `in_course_selector` puts it in the selector. | Admin → Public course pricing (grid + bulk fill) |
| Coupons | `coupons`, plus `applies_to` (plans / packages / both), `course_ids`, `min_subtotal_cents`, `max_redemptions_per_customer` | Package discounts are computed by Foremint and are never sent to Whop |
| Payment | Whop client, the payment-link pattern from custom invoices, the existing webhook (`/api/webhooks/whop`), reconciliation | `public_course_orders` (+ `_items`, `_events`) |
| Access | `course_entitlements`, one row per course; `grantAccess` | `public_order_id` keeps fulfilment idempotent |
| Accounts | `access_invitations` + `/join/[token]` (single-use, hashed token; the learner sets their own password) | invitation kind `order_activation` |
| Email | outbox + editable templates | `order.payment_link`, `order.payment_confirmed`, `order.account_activation`, `order.courses_added` |
| FAQs | `faqs` | `keywords`, `advisor_enabled`, `advisor_priority` |

Schema: `supabase/migrations/20261115100000_public_course_commerce.sql`.

## Cart and pricing

- The cart lives on the server (`public_carts`). The visitor holds a random token in an httpOnly, SameSite=Lax cookie (`fm_cart`); only its SHA-256 is stored.
- The cart holds course ids, the access period, a coupon code and the learner email — never prices. Every response is re-priced from the database (`services/commerce/pricing.ts → quoteBasket`).
- One access period applies to the whole package. A course without a price for that period is flagged and must be removed (or the period changed) before checkout, so terms are never mixed silently.
- Checkout sends the total the visitor saw; if the server's total differs, the order is refused with "prices changed" and the new totals are shown.

## Orders and the Whop link

1. `POST /api/commerce/checkout` validates the email, re-prices the cart, re-validates the coupon and creates the order (a snapshot of courses, prices, discount and period).
2. It creates the Whop side: one **hidden, one-time variant priced at the exact discounted total, with stock 1**, under a shared hidden "Foremint Academy course package" product. Then it creates a **checkout configuration** with metadata `foremint_public_order_id`. The visitor is redirected to its `purchase_url`, or the link is copied and shared.
3. The same basket with the same email reuses the pending order and link instead of creating new ones. Links expire after `commerce.order_link_ttl_hours` (default 72); the daily `commerce` cron closes expired links.
4. Whop's return URL (`/checkout/success?order=<token>`) is only a hint. Whop rejects non-https URLs, so local http sites get no return URL.

## Payment verification and fulfilment

The Whop webhook re-fetches the payment from Whop. `payments/sync.ts` then routes it to `commerce/fulfillment.ts` when its checkout configuration or variant belongs to an order; metadata alone is never trusted. A payment fulfils the order only if all of these hold:
- it is on our Whop account
- it is in the order's currency
- the amount before tax equals the order total
- no Whop promo code was applied

Otherwise the order is held as **Under review**, with no access granted, and admins are notified.

Whop's money fields are in the settlement currency. A buyer shown a converted price (for example PKR) still settles in USD at the exact total; this was verified with a sandbox payment.

On success, in this order:
- The order is claimed `paid` (a conditional update, so concurrent webhooks can't double-process).
- The checkout is closed and the coupon redemption is counted once.
- **Existing account** (matched by email): one entitlement per course, expiring `duration_days` after the verified payment time. Then the "payment confirmed" and "courses added" emails, and status `fulfilled`.
- **No account**: an `order_activation` invitation (single-use link). The learner creates their password at `/join/<token>`; we never email passwords. The order waits as `paid / awaiting_activation`, and accepting attaches every paid order for that email.
- The payer (parent, employer, institute) is recorded in `payer_email`. Access always goes to the learner email.

Refunds revoke the order's access. Disputes suspend it, and a lost dispute revokes it. Replayed webhooks change nothing. Existing purchases and longer entitlements are never modified.

Backstops:
- The order page asks Whop directly while it waits (rate-limited).
- The daily `commerce` cron re-checks open orders, expires links and retries failed fulfilment.
- Admins can press **Refresh payment status** or **Retry fulfilment**.

## Invoices

Every order has an invoice PDF (`/api/commerce/orders/<token>/invoice`) marked **Paid**, **Unpaid**, Refunded, Cancelled or Expired. Its contents:
- courses with their frozen prices, the discount, Whop's tax and the total
- the student email, plus the payer's email when someone else paid
- the seller details from Admin → Settings (legal)

Both order emails include it: the payment-link email as the unpaid invoice, the payment-confirmed email as the paid one. The order page also has a download button.

## The course advisor (rule-based chatbot)

Every visitor message goes through the same steps (`src/lib/domain/advisor.ts`, unit-tested against the seeded rules):
1. Split it into clauses. Clauses that describe what the visitor already knows or has ("I know WordPress, but…") are not used to pick courses, and courses for those skills are left out.
2. Normalise each clause: lower case, accents and punctuation removed, the admin's synonym dictionary applied, light stemming.
3. Score each intent's keywords: `keyword` (one word), `phrase` (words in order), `pattern` (`build * app`, where `*` matches 0–3 words), each weighted.
4. Score FAQs from their keywords and question wording.
5. Decide. A follow-up answer wins first; then a command (cart, coupon, payment link, checkout); then the FAQ or intent with the higher confidence. Mixed goals combine every intent scoring at least 50% of the top score. Below the thresholds, the advisor asks for more detail (fallback) instead of guessing.

What the advisor can say, and where it comes from:
- **Replies** — the admin-written intent response, follow-up questions and options, or approved FAQ answers.
- **Courses** — live catalogue data only: published, priced courses with their real prices for the cart's period.
- **Actions** — adding to the cart, applying a coupon and creating a payment link all call the same cart and checkout services as the website. Orders it creates are tagged `source = advisor`.

Logs and privacy:
- Each question is logged with emails and long numbers redacted, cut to 300 characters, together with the matched intent, FAQ, recommended courses and cart events.
- Logs are deleted after `advisor.log_retention_days` (default 90) by the `commerce` cron.

### Admin

| Screen | What it does |
| --- | --- |
| Admin → Public course pricing | Selector settings (periods including custom day counts, default period, currency, limit), the course × period price grid, **Set prices for a period** (fixed or % of another period, with rounding) |
| Admin → Course orders | All guest orders with source (direct checkout / chatbot), payer, coupon, amounts, statuses, access expiry; detail page with timeline and actions (refresh from Whop, retry, resend activation, cancel, approve after review) |
| Admin → Coupons | Where a code works (packages / plans / both), course restriction, minimum spend, per-email limit, start date |
| Admin → Course advisor | Analytics (real data), intents with keywords, follow-ups and course mappings and a message tester, synonyms, behaviour (greeting, quick replies, fallback, limits, retention), conversation logs |
| Admin → Overview | "Course packages & chatbot": orders by source, paid orders and revenue, chatbot conversations, latest orders |
| Admin → FAQs | Keywords and "use in course advisor" per FAQ |

## Security

- No client writes: every new table has RLS, with admin read policies and service-role writes only.
- Learners may read their own orders, but only the safe columns.
- Order pages are authorised by an HMAC token of 43 characters. The human order number can't be used to look an order up.
- Cross-site POSTs to the cart, checkout, order and advisor endpoints are refused (Origin check plus SameSite cookies).
- Rate limits:
  - cart reads and writes
  - coupon attempts: 20 per 10 minutes
  - order creation: per IP and per email
  - activation resends: 3 per hour per order
  - advisor messages
  - invoice downloads
- Payments are verified as described above; redirects, query strings and the browser never grant access.

## Tests

- `tests/unit/commerce/domain.test.ts` — coupons, exact discount allocation, totals, payment verification, periods
- `tests/unit/advisor/engine.test.ts` — the spec's conversations against the seeded rules
- `tests/integration/public-orders.test.ts` — real database, Whop stubbed:
  - repricing and tampering
  - coupon rules
  - existing and new learners, a third-party payer and activation
  - replayed webhooks, refunds, review holds, forged metadata
  - free orders, expiry, missed-webhook refresh
- `tests/e2e/public-site-commerce.spec.ts` (desktop and mobile) and `tests/e2e/commerce-admin.spec.ts`. Set `E2E_CREATE_PAYMENT_LINKS=1` to also create real sandbox links.
