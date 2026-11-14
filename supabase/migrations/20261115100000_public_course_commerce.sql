-- Public course selector, guest checkout and the rule-based course advisor.
--
-- Reuses the existing commerce model:
--   pricing_plans        a course's price per access period (one-time plans on the course product).
--                        `in_course_selector` makes a plan the price offered on /courses/select.
--   coupons              one coupon engine for Whop plan checkouts and course packages.
--   course_entitlements  the single source of course access (one row per purchased course).
--   access_invitations   single-use, hashed-token activation links (/join/[token]).
--   payment_transactions the verified Whop payment record.
--   faqs                 the approved FAQ content the advisor answers from.
--
-- New:
--   public_carts                       anonymous server-side carts (cookie token, hashed)
--   public_course_orders (+ items)     guest orders: learner email, price snapshot, Whop link
--   course_advisor_*                   advisor rules (intents, keywords, synonyms,
--                                      recommendations) and minimal conversation logs
--
-- Money is integer minor units. Prices are always recomputed on the server.
-- Nothing here is writable from the browser: every write goes through server
-- code with the service role after validation.

-- ---------------------------------------------------------------------------
-- Pricing: which course prices the selector offers
-- ---------------------------------------------------------------------------

alter table public.pricing_plans
  add column in_course_selector boolean not null default false;

alter table public.pricing_plans
  add constraint pricing_plans_selector_one_time_check
  check (not in_course_selector or plan_type = 'one_time');

-- One selector price per course product, access period and currency.
create unique index pricing_plans_selector_uniq
  on public.pricing_plans (product_id, coalesce(access_duration_days, 0), currency)
  where in_course_selector and visibility <> 'archived';

-- The one-time public prices already sold on course pages are offered in the
-- selector too (admins can switch any of them off in Admin → Public course pricing).
update public.pricing_plans pp
set in_course_selector = true
from public.products p
where p.id = pp.product_id
  and p.kind = 'course'
  and p.status = 'active'
  and pp.plan_type = 'one_time'
  and pp.visibility = 'public'
  and pp.price_cents >= 100
  and not exists (
    select 1 from public.pricing_plans other
    where other.product_id = pp.product_id
      and other.id <> pp.id
      and other.plan_type = 'one_time'
      and other.visibility = 'public'
      and coalesce(other.access_duration_days, 0) = coalesce(pp.access_duration_days, 0)
      and other.currency = pp.currency
      and (other.sort_order, other.created_at) < (pp.sort_order, pp.created_at)
  );

-- ---------------------------------------------------------------------------
-- Coupons: one engine for plan checkouts and course packages
-- ---------------------------------------------------------------------------

alter table public.coupons
  add column applies_to text not null default 'all' check (applies_to in ('all', 'plans', 'packages')),
  -- Course packages only: courses the discount applies to (empty = every course).
  add column course_ids uuid[] not null default '{}',
  add column min_subtotal_cents integer check (min_subtotal_cents is null or min_subtotal_cents > 0),
  add column max_redemptions_per_customer integer check (max_redemptions_per_customer is null or max_redemptions_per_customer > 0);

create or replace function public.increment_coupon_redemption(p_coupon uuid)
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  update public.coupons set redemptions_count = redemptions_count + 1 where id = p_coupon returning redemptions_count;
$$;
revoke execute on function public.increment_coupon_redemption(uuid) from public, anon, authenticated;
grant execute on function public.increment_coupon_redemption(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Anonymous carts
-- ---------------------------------------------------------------------------

create table public.public_carts (
  id uuid primary key default gen_random_uuid(),
  -- SHA-256 of the random token kept in the visitor's httpOnly cookie.
  token_hash text not null unique,
  course_ids uuid[] not null default '{}',
  -- '30', '90', 'lifetime'…; null = the configured default.
  access_duration text check (access_duration ~ '^([0-9]{1,4}|lifetime)$'),
  coupon_code extensions.citext check (coupon_code is null or coupon_code ~ '^[A-Za-z0-9_-]{3,40}$'),
  learner_email extensions.citext check (learner_email is null or length(learner_email) <= 254),
  last_order_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  check (cardinality(course_ids) <= 100)
);
create index public_carts_expiry_idx on public.public_carts (expires_at);

-- ---------------------------------------------------------------------------
-- Guest course orders
-- ---------------------------------------------------------------------------

create sequence public.public_course_order_number_seq start 1001;

create table public.public_course_orders (
  id uuid primary key default gen_random_uuid(),
  -- Human reference shown on pages and emails (FMA-ORD-2026-001001). Not a secret.
  order_number text not null unique,
  -- SHA-256 of the order access token used in /checkout/order/<token>. The
  -- token is an HMAC of the order id, so it can be re-derived for emails.
  access_token_hash text not null unique,
  cart_id uuid references public.public_carts (id) on delete set null,
  -- Everything that defines the purchase; equal fingerprints reuse a pending order.
  fingerprint text not null,
  source text not null default 'website' check (source in ('website', 'advisor')),
  advisor_session_id uuid,

  -- The intended learner. Never replaced by the payer's Whop email.
  learner_email extensions.citext not null check (length(learner_email) between 3 and 254),
  learner_user_id uuid references public.profiles (id) on delete set null,

  currency text not null check (currency ~ '^[a-z]{3}$'),
  -- null = lifetime access
  duration_days integer check (duration_days is null or duration_days between 1 and 3650),
  subtotal_minor bigint not null check (subtotal_minor >= 0),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  total_minor bigint not null check (total_minor >= 0),
  coupon_id uuid references public.coupons (id) on delete set null,
  coupon_code_snapshot text,
  coupon_snapshot jsonb,

  status text not null default 'draft' check (status in (
    'draft', 'pending_payment', 'payment_processing', 'paid', 'fulfillment_pending', 'fulfilled',
    'failed', 'expired', 'cancelled', 'refunded', 'partially_refunded', 'under_review'
  )),
  payment_status text not null default 'unpaid' check (payment_status in (
    'unpaid', 'pending', 'succeeded', 'failed', 'refunded', 'partially_refunded', 'disputed', 'not_required'
  )),
  fulfillment_status text not null default 'not_started' check (fulfillment_status in (
    'not_started', 'awaiting_activation', 'fulfilled', 'failed', 'suspended', 'revoked'
  )),
  status_reason text,

  -- Whop (provider side)
  checkout_provider text not null default 'whop' check (checkout_provider in ('whop', 'none')),
  environment text check (environment in ('sandbox', 'production')),
  whop_account_id text,
  whop_product_id text,
  whop_plan_id text unique,                    -- the order's own hidden variant (plan_…), stock 1
  whop_checkout_configuration_id text unique,  -- ch_…
  whop_checkout_url text,                      -- purchase_url returned by Whop
  whop_payment_id text unique,
  whop_invoice_id text,
  link_generation_error text,
  link_attempts integer not null default 0,
  link_locked_at timestamptz,

  -- Who paid (may differ from the learner: a parent, employer or institute).
  payer_email extensions.citext,
  payer_name text,
  paid_amount_minor bigint,
  paid_tax_minor bigint,
  refunded_amount_minor bigint not null default 0,
  payment_transaction_id uuid references public.payment_transactions (id) on delete set null,

  expires_at timestamptz not null,
  paid_at timestamptz,
  fulfilled_at timestamptz,
  cancelled_at timestamptz,
  expired_at timestamptz,
  last_synced_at timestamptz,
  link_email_sent_count integer not null default 0,
  activation_sent_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_minor = subtotal_minor - discount_minor),
  check (discount_minor <= subtotal_minor)
);
create index public_course_orders_status_idx on public.public_course_orders (status, created_at desc);
create index public_course_orders_email_idx on public.public_course_orders (learner_email, status);
create index public_course_orders_learner_idx on public.public_course_orders (learner_user_id);
create index public_course_orders_cart_idx on public.public_course_orders (cart_id, fingerprint);
create index public_course_orders_expiry_idx on public.public_course_orders (expires_at) where status in ('draft', 'pending_payment', 'payment_processing');
create index public_course_orders_coupon_idx on public.public_course_orders (coupon_id) where coupon_id is not null;

alter table public.public_carts
  add constraint public_carts_last_order_fk foreign key (last_order_id) references public.public_course_orders (id) on delete set null;

create table public.public_course_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.public_course_orders (id) on delete cascade,
  course_id uuid references public.courses (id) on delete set null,
  pricing_plan_id uuid references public.pricing_plans (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  course_title_snapshot text not null,
  course_slug_snapshot text not null,
  category_snapshot text,
  course_price_minor bigint not null check (course_price_minor >= 0),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  currency text not null,
  duration_days integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (order_id, course_id)
);
create index public_course_order_items_course_idx on public.public_course_order_items (course_id);

create table public.public_course_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.public_course_orders (id) on delete cascade,
  event_type text not null,
  old_status text,
  new_status text,
  actor_id uuid references public.profiles (id) on delete set null,
  dedupe_key text unique,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index public_course_order_events_order_idx on public.public_course_order_events (order_id, created_at desc);

create or replace function public.next_public_order_number()
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select 'FMA-ORD-' || to_char(now() at time zone 'utc', 'YYYY') || '-' || lpad(nextval('public.public_course_order_number_seq')::text, 6, '0');
$$;
revoke execute on function public.next_public_order_number() from public, anon, authenticated;
grant execute on function public.next_public_order_number() to service_role;

-- Payments and access rows point back at their order.
alter table public.payment_transactions
  add column public_order_id uuid references public.public_course_orders (id) on delete set null;
create index payment_transactions_public_order_idx on public.payment_transactions (public_order_id) where public_order_id is not null;

alter table public.course_entitlements
  add column public_order_id uuid references public.public_course_orders (id) on delete set null;
-- One entitlement per order and course keeps fulfilment idempotent.
create unique index course_entitlements_public_order_course_uniq
  on public.course_entitlements (public_order_id, user_id, coalesce(course_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where public_order_id is not null;

-- Activation links for learners who had no account when their order was paid.
alter table public.access_invitations
  add column public_order_id uuid references public.public_course_orders (id) on delete cascade;
alter table public.access_invitations drop constraint access_invitations_kind_check;
alter table public.access_invitations add constraint access_invitations_kind_check
  check (kind in ('company_member', 'company_contact', 'purchase_activation', 'order_activation'));
alter table public.access_invitations drop constraint access_invitations_check;
alter table public.access_invitations add constraint access_invitations_company_check
  check (kind in ('purchase_activation', 'order_activation') or company_id is not null);
alter table public.access_invitations add constraint access_invitations_order_check
  check (kind <> 'order_activation' or public_order_id is not null);
create unique index access_invitations_order_pending_uniq
  on public.access_invitations (public_order_id, email) where status = 'pending' and kind = 'order_activation';

-- The browser may read only safe columns (as before), never order ids or hashes.
revoke all on public.access_invitations from anon, authenticated;
grant select (id, kind, company_id, email, full_name, can_invite_members, invited_by_role, status, expires_at, accepted_at, revoked_at, send_count, last_sent_at, created_at)
  on public.access_invitations to authenticated;

-- ---------------------------------------------------------------------------
-- FAQs the advisor may answer from
-- ---------------------------------------------------------------------------

alter table public.faqs
  add column keywords text[] not null default '{}',
  add column advisor_enabled boolean not null default true,
  add column advisor_priority integer not null default 0;

-- ---------------------------------------------------------------------------
-- Course advisor (deterministic rules, no AI)
-- ---------------------------------------------------------------------------

create table public.course_advisor_intents (
  id uuid primary key default gen_random_uuid(),
  intent_key text not null unique check (intent_key ~ '^[a-z0-9_]{2,60}$'),
  title text not null check (length(title) between 1 and 120),
  description text check (length(description) <= 500),
  -- What the advisor says when this intent matches (approved copy).
  response text not null check (length(response) between 1 and 1200),
  -- Optional guided follow-up: {"question": "...", "options": [{"label": "...", "intent": "intent_key"}]}
  follow_up jsonb,
  -- Higher wins ties between equally strong matches.
  priority integer not null default 0 check (priority between -100 and 100),
  -- Show this intent's options on the welcome screen / "not sure" path.
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.course_advisor_keywords (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null references public.course_advisor_intents (id) on delete cascade,
  keyword text not null check (length(keyword) between 1 and 120),
  -- keyword: one word; phrase: words in this order; pattern: words in order with gaps ("build * app")
  match_type text not null default 'phrase' check (match_type in ('keyword', 'phrase', 'pattern')),
  weight numeric(4, 2) not null default 1 check (weight > 0 and weight <= 10),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (intent_id, keyword, match_type)
);
create index course_advisor_keywords_intent_idx on public.course_advisor_keywords (intent_id);

-- Global dictionary applied before matching ("iphone" → "ios", "e-commerce" → "ecommerce").
create table public.course_advisor_synonyms (
  id uuid primary key default gen_random_uuid(),
  term text not null unique check (length(term) between 1 and 80),
  replacement text not null check (length(replacement) between 1 and 80),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.course_advisor_recommendations (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null references public.course_advisor_intents (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  recommendation_priority integer not null default 0,
  role text not null default 'primary' check (role in ('primary', 'supporting')),
  explanation text check (length(explanation) <= 400),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (intent_id, course_id)
);
create index course_advisor_recommendations_course_idx on public.course_advisor_recommendations (course_id);

create table public.course_advisor_conversation_sessions (
  id uuid primary key default gen_random_uuid(),
  -- SHA-256 of the random token in the visitor's httpOnly cookie.
  token_hash text not null unique,
  cart_id uuid references public.public_carts (id) on delete set null,
  order_id uuid references public.public_course_orders (id) on delete set null,
  session_status text not null default 'active' check (session_status in ('active', 'ended', 'expired', 'limited')),
  current_intent text,
  -- Decision-path state: {"stage": "idle" | "follow_up" | "email" | "coupon", "options": [...]}
  conversation_state jsonb not null default '{}'::jsonb,
  message_count integer not null default 0,
  fallback_count integer not null default 0,
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  ended_at timestamptz
);
create index course_advisor_sessions_started_idx on public.course_advisor_conversation_sessions (started_at desc);

alter table public.public_course_orders
  add constraint public_course_orders_advisor_session_fk foreign key (advisor_session_id)
  references public.course_advisor_conversation_sessions (id) on delete set null;

-- Minimal operational log: what was asked (emails/phone numbers redacted,
-- truncated), which rule answered, what was recommended and cart actions.
create table public.course_advisor_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.course_advisor_conversation_sessions (id) on delete cascade,
  message_role text not null check (message_role in ('user', 'event')),
  content text check (length(content) <= 400),
  matched_intent text,
  matched_faq_id uuid references public.faqs (id) on delete set null,
  confidence numeric(6, 2),
  recommended_course_ids uuid[] not null default '{}',
  event_type text check (event_type in ('cart_add', 'cart_remove', 'coupon_applied', 'coupon_rejected', 'order_created', 'checkout_opened')),
  event_course_ids uuid[] not null default '{}',
  order_id uuid references public.public_course_orders (id) on delete set null,
  created_at timestamptz not null default now()
);
create index course_advisor_messages_session_idx on public.course_advisor_messages (session_id, created_at);
create index course_advisor_messages_created_idx on public.course_advisor_messages (created_at desc);
create index course_advisor_messages_intent_idx on public.course_advisor_messages (matched_intent, created_at desc);

create trigger public_carts_updated_at before update on public.public_carts for each row execute function private.set_updated_at();
create trigger public_course_orders_updated_at before update on public.public_course_orders for each row execute function private.set_updated_at();
create trigger course_advisor_intents_updated_at before update on public.course_advisor_intents for each row execute function private.set_updated_at();

-- Aggregates for Admin → Course advisor → Analytics (real data only).
create or replace function public.course_advisor_analytics(p_since timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'sessions', (select count(*) from public.course_advisor_conversation_sessions s where s.started_at >= p_since),
    'questions', (select count(*) from public.course_advisor_messages m where m.created_at >= p_since and m.message_role = 'user'),
    'fallbacks', (select count(*) from public.course_advisor_messages m where m.created_at >= p_since and m.message_role = 'user' and m.matched_intent = 'fallback'),
    'faq_answers', (select count(*) from public.course_advisor_messages m where m.created_at >= p_since and m.message_role = 'user' and m.matched_faq_id is not null),
    'top_intents', coalesce((
      select jsonb_agg(t order by t.count desc) from (
        select m.matched_intent as key, count(*) as count
        from public.course_advisor_messages m
        where m.created_at >= p_since and m.message_role = 'user' and m.matched_intent is not null
          and m.matched_intent not in ('fallback', 'faq', 'command')
        group by 1 order by 2 desc limit 10
      ) t), '[]'::jsonb),
    'recommended_courses', coalesce((
      select jsonb_agg(t order by t.count desc) from (
        select c.id, c.title, count(*) as count
        from public.course_advisor_messages m
        cross join lateral unnest(m.recommended_course_ids) as rid(course_id)
        join public.courses c on c.id = rid.course_id
        where m.created_at >= p_since
        group by 1, 2 order by 3 desc limit 10
      ) t), '[]'::jsonb),
    'selected_courses', coalesce((
      select jsonb_agg(t order by t.count desc) from (
        select c.id, c.title, count(*) as count
        from public.course_advisor_messages m
        cross join lateral unnest(m.event_course_ids) as rid(course_id)
        join public.courses c on c.id = rid.course_id
        where m.created_at >= p_since and m.event_type = 'cart_add'
        group by 1, 2 order by 3 desc limit 10
      ) t), '[]'::jsonb),
    'orders', (select count(*) from public.public_course_orders o where o.created_at >= p_since and o.source = 'advisor'),
    'paid_orders', (select count(*) from public.public_course_orders o where o.created_at >= p_since and o.source = 'advisor' and o.paid_at is not null),
    'paid_total_minor', (select coalesce(sum(o.total_minor), 0) from public.public_course_orders o where o.created_at >= p_since and o.source = 'advisor' and o.paid_at is not null and o.status not in ('refunded')),
    'unanswered', coalesce((
      select jsonb_agg(t order by t.count desc) from (
        select m.content as question, count(*) as count, max(m.created_at) as last_asked
        from public.course_advisor_messages m
        where m.created_at >= p_since and m.message_role = 'user' and m.matched_intent = 'fallback' and m.content is not null
        group by m.content order by 2 desc, 3 desc limit 20
      ) t), '[]'::jsonb)
  );
$$;
revoke execute on function public.course_advisor_analytics(timestamptz) from public, anon, authenticated;
grant execute on function public.course_advisor_analytics(timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- Row level security: admin reads; no browser writes at all.
-- ---------------------------------------------------------------------------

alter table public.public_carts enable row level security;
alter table public.public_course_orders enable row level security;
alter table public.public_course_order_items enable row level security;
alter table public.public_course_order_events enable row level security;
alter table public.course_advisor_intents enable row level security;
alter table public.course_advisor_keywords enable row level security;
alter table public.course_advisor_synonyms enable row level security;
alter table public.course_advisor_recommendations enable row level security;
alter table public.course_advisor_conversation_sessions enable row level security;
alter table public.course_advisor_messages enable row level security;

create policy "public_course_orders: admin or learner reads" on public.public_course_orders
  for select to authenticated using ((select private.is_admin()) or learner_user_id = (select auth.uid()));
create policy "public_course_order_items: admin or learner reads" on public.public_course_order_items
  for select to authenticated using (
    (select private.is_admin())
    or exists (select 1 from public.public_course_orders o where o.id = order_id and o.learner_user_id = (select auth.uid()))
  );
create policy "public_course_order_events: admin reads" on public.public_course_order_events
  for select to authenticated using ((select private.is_admin()));
create policy "course_advisor_intents: admin reads" on public.course_advisor_intents
  for select to authenticated using ((select private.is_admin()));
create policy "course_advisor_keywords: admin reads" on public.course_advisor_keywords
  for select to authenticated using ((select private.is_admin()));
create policy "course_advisor_synonyms: admin reads" on public.course_advisor_synonyms
  for select to authenticated using ((select private.is_admin()));
create policy "course_advisor_recommendations: admin reads" on public.course_advisor_recommendations
  for select to authenticated using ((select private.is_admin()));
create policy "course_advisor_sessions: admin reads" on public.course_advisor_conversation_sessions
  for select to authenticated using ((select private.is_admin()));
create policy "course_advisor_messages: admin reads" on public.course_advisor_messages
  for select to authenticated using ((select private.is_admin()));

revoke all on public.public_carts, public.public_course_orders, public.public_course_order_items, public.public_course_order_events,
  public.course_advisor_intents, public.course_advisor_keywords, public.course_advisor_synonyms, public.course_advisor_recommendations,
  public.course_advisor_conversation_sessions, public.course_advisor_messages from anon;
revoke insert, update, delete, truncate on public.public_course_orders, public.public_course_order_items, public.public_course_order_events,
  public.course_advisor_intents, public.course_advisor_keywords, public.course_advisor_synonyms, public.course_advisor_recommendations,
  public.course_advisor_messages from authenticated;
-- Carts and advisor sessions are only ever read by the server.
revoke all on public.public_carts, public.course_advisor_conversation_sessions from authenticated;
-- Learners may see their own orders, but never the token hash or provider internals.
revoke select on public.public_course_orders from authenticated;
grant select (id, order_number, learner_email, learner_user_id, currency, duration_days, subtotal_minor, discount_minor, total_minor,
  coupon_code_snapshot, status, payment_status, fulfillment_status, paid_at, fulfilled_at, created_at)
  on public.public_course_orders to authenticated;

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------

insert into public.platform_settings (key, value, description, is_public) values
  ('commerce.selector', '{"enabled": true, "durations": ["30", "60", "90", "180", "365", "lifetime"], "default_duration": "30", "currency": "usd", "max_courses": 0}',
   'Course selector (/courses/select): enabled, access periods offered, default period, currency, maximum courses per order (0 = unlimited).', true),
  ('commerce.order_link_ttl_hours', '72', 'Hours a generated course-package payment link stays payable.', false),
  ('advisor.config', '{
     "enabled": true,
     "greeting": "Hey! Welcome to Foremint Academy.",
     "intro": "I''m here to help you find the right courses for your goals.\n\nWhat would you like to learn or achieve?",
     "fallback": "I want to make sure I recommend the right course. Could you tell me a little more about your goal?",
     "closing": "Happy learning! If anything else comes up, I''m right here.",
     "privacy_notice": "This assistant follows set rules — it isn''t AI. We keep a short, anonymous log of questions to improve answers.",
     "show_quick_replies": true,
     "quick_replies": [
       "I want to start an online business.",
       "I want to sell on Amazon.",
       "I want to build a website.",
       "I want to develop mobile apps.",
       "I want to improve my digital marketing.",
       "I want to learn SEO.",
       "I want to establish my company.",
       "I''m not sure which course is right for me."
     ],
     "max_messages": 60,
     "session_ttl_minutes": 120
   }', 'Course advisor chatbot: greeting, messages, quick replies and limits.', true),
  ('advisor.log_retention_days', '90', 'Days advisor conversation logs are kept before they are deleted.', false)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Email templates (editable in Admin → Email templates)
-- ---------------------------------------------------------------------------

insert into public.email_templates (key, name, category, subject, preheader, heading, body, cta_label, is_required) values
  ('order.payment_link', 'Course package: payment link', 'billing',
   'Your {{brand_name}} Course Package', '{{amount}} for {{course_count}} courses.', 'Your course package is ready',
   'Hi there,

Here is the secure payment link for your {{brand_name}} course package ({{order_number}}).

Courses: {{course_list}}
Access: {{access_period}} for each course, starting when the payment is confirmed.

Anyone can pay with this link — you, a parent, an employer or an institution. The courses are always set up for {{learner_email}}. The link can be paid once and works until {{link_expires_at}}.', 'Pay {{amount}}', true),
  ('order.payment_confirmed', 'Course package: payment confirmed', 'billing',
   'Your {{brand_name}} Payment Is Confirmed', 'Order {{order_number}} is paid.', 'Payment confirmed',
   'Hi {{first_name}},

Thank you — the payment for order {{order_number}} is confirmed.

Courses: {{course_list}}
Access: {{access_summary}}
Student account: {{learner_email}}

{{next_steps}}', 'Open {{brand_name}}', true),
  ('order.account_activation', 'Course package: activate your account', 'auth',
   'Activate Your {{brand_name}} Account', 'Your courses are ready.', 'Activate your account',
   'Hi {{first_name}},

Your courses are paid for and waiting: {{course_list}}.

Your login email is {{learner_email}}. Use the button below to create your password — we never send passwords by email. After that, sign in at any time with your email and password.

{{access_summary}}

This link can be used once and expires on {{expires_at}}. Questions? Contact {{support_email}}.', 'Activate my account', true),
  ('order.courses_added', 'Course package: courses added to an account', 'billing',
   'New Courses Added to Your {{brand_name}} Account', 'Start learning now.', 'New courses are in your account',
   'Hi {{first_name}},

These courses were added to your {{brand_name}} account ({{learner_email}}): {{course_list}}.

{{access_summary}}

Your password and your other courses are unchanged.', 'Go to my courses', true)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Advisor starter knowledge (editable in Admin → Course advisor)
-- ---------------------------------------------------------------------------

insert into public.course_advisor_intents (intent_key, title, description, response, follow_up, priority) values
  ('website_development', 'Build websites', 'Professional website and web application development.',
   'Great! Building websites professionally involves understanding development, website platforms and practical project workflows.', null, 10),
  ('wordpress_websites', 'WordPress websites', 'Build and manage sites with WordPress.',
   'WordPress is a fast way to launch professional sites for yourself or for clients.', null, 5),
  ('mobile_app_development', 'Mobile apps', 'Android and iPhone app development.',
   'Building apps for Android and iPhone is a great skill. Here''s where I''d start:', null, 10),
  ('amazon_business', 'Sell on Amazon', 'Amazon FBA and marketplace selling.',
   'Selling on Amazon is a proven way to start an online business. This course walks you through it:', null, 10),
  ('ebay_selling', 'Sell on eBay', 'Selling products on eBay.',
   'eBay is a practical marketplace to start selling quickly.', null, 5),
  ('shopify_store', 'Shopify store', 'Launching and running a Shopify store.',
   'Shopify is a great way to launch your own store. Here''s the course for it:', null, 8),
  ('ecommerce_general', 'E-commerce foundations', 'General e-commerce business skills.',
   'Learning the e-commerce essentials first gives you a strong base for any store or marketplace.', null, 6),
  ('online_business', 'Start an online business', 'Starting an online business without a clear direction yet.',
   'Great goal! Are you interested in selling on marketplaces like Amazon and eBay, or building your own store?',
   '{"question": "Which direction interests you most?", "options": [
      {"label": "Selling on Amazon", "intent": "amazon_business"},
      {"label": "Selling on eBay", "intent": "ebay_selling"},
      {"label": "Building my own store", "intent": "own_store"},
      {"label": "General e-commerce", "intent": "ecommerce_general"}]}', 7),
  ('own_store', 'Build my own store', 'Wants their own online store.',
   'Building your own store gives you full control of your brand.',
   '{"question": "Would you like to build it using Shopify or learn general e-commerce first?", "options": [
      {"label": "Shopify", "intent": "shopify_store"},
      {"label": "General e-commerce first", "intent": "ecommerce_general"}]}', 8),
  ('marketplace_selling', 'Sell on marketplaces', 'Selling on Amazon, eBay and other marketplaces.',
   'Marketplaces let you reach buyers who are already shopping. These courses cover the two biggest:', null, 6),
  ('digital_marketing', 'Digital marketing', 'Marketing, social media and advertising.',
   'Digital marketing helps any business reach and convert the right customers.', null, 8),
  ('seo', 'SEO and organic traffic', 'Ranking on Google and growing organic traffic.',
   'More organic traffic starts with a solid SEO framework.', null, 9),
  ('company_formation', 'Register a company', 'US LLC and UK Ltd formation.',
   'This course explains how US LLCs and UK Ltd companies are formed and run. It''s educational and isn''t a substitute for advice from a qualified legal or tax professional.', null, 9),
  ('not_sure', 'Not sure where to start', 'Visitor doesn''t know which course fits.',
   'No problem — let''s work it out together.',
   '{"question": "What would you most like to achieve?", "options": [
      {"label": "Start an online business", "intent": "online_business"},
      {"label": "Sell on Amazon", "intent": "amazon_business"},
      {"label": "Build websites", "intent": "website_development"},
      {"label": "Build mobile apps", "intent": "mobile_app_development"},
      {"label": "Grow with digital marketing", "intent": "digital_marketing"},
      {"label": "Rank on Google (SEO)", "intent": "seo"},
      {"label": "Register a company", "intent": "company_formation"}]}', 4),
  ('greeting', 'Greeting', 'Hello / hi.',
   'Hi! I''m happy to help you choose.',
   '{"question": "What would you like to learn or achieve?", "options": [
      {"label": "Start an online business", "intent": "online_business"},
      {"label": "Build websites", "intent": "website_development"},
      {"label": "Build mobile apps", "intent": "mobile_app_development"},
      {"label": "Learn SEO", "intent": "seo"},
      {"label": "I''m not sure", "intent": "not_sure"}]}', 0),
  ('thanks', 'Thanks', 'Thank you / that''s all.',
   'You''re welcome! Happy learning — I''m here if anything else comes up.', null, 0)
on conflict (intent_key) do nothing;

insert into public.course_advisor_keywords (intent_id, keyword, match_type, weight)
select i.id, v.keyword, v.match_type, v.weight
from (values
  ('website_development', 'build website', 'phrase', 3.0),
  ('website_development', 'create website', 'phrase', 3.0),
  ('website_development', 'make website', 'phrase', 3.0),
  ('website_development', 'build * website', 'pattern', 2.5),
  ('website_development', 'website development', 'phrase', 3.0),
  ('website_development', 'web development', 'phrase', 3.0),
  ('website_development', 'web developer', 'phrase', 3.0),
  ('website_development', 'client website', 'phrase', 2.5),
  ('website_development', 'coding website', 'phrase', 2.5),
  ('website_development', 'web app', 'phrase', 2.5),
  ('website_development', 'custom app', 'phrase', 2.0),
  ('website_development', 'frontend', 'keyword', 2.0),
  ('website_development', 'backend', 'keyword', 2.0),
  ('website_development', 'html', 'keyword', 2.0),
  ('website_development', 'css', 'keyword', 1.5),
  ('website_development', 'javascript', 'keyword', 2.0),
  ('website_development', 'react', 'keyword', 1.5),
  ('website_development', 'code', 'keyword', 1.0),
  ('website_development', 'website', 'keyword', 1.0),
  ('wordpress_websites', 'wordpress', 'keyword', 3.0),
  ('wordpress_websites', 'theme', 'keyword', 1.0),
  ('wordpress_websites', 'plugin', 'keyword', 1.0),
  ('wordpress_websites', 'blog', 'keyword', 1.0),
  ('mobile_app_development', 'mobile app', 'phrase', 3.5),
  ('mobile_app_development', 'build * app', 'pattern', 2.5),
  ('mobile_app_development', 'create * app', 'pattern', 2.5),
  ('mobile_app_development', 'develop * app', 'pattern', 2.5),
  ('mobile_app_development', 'app developer', 'phrase', 3.0),
  ('mobile_app_development', 'app development', 'phrase', 3.0),
  ('mobile_app_development', 'android', 'keyword', 2.5),
  ('mobile_app_development', 'ios', 'keyword', 2.5),
  ('mobile_app_development', 'flutter', 'keyword', 2.0),
  ('mobile_app_development', 'react native', 'phrase', 2.5),
  ('mobile_app_development', 'app', 'keyword', 1.5),
  ('amazon_business', 'amazon', 'keyword', 3.0),
  ('amazon_business', 'fba', 'keyword', 3.0),
  ('amazon_business', 'amazon seller', 'phrase', 2.0),
  ('amazon_business', 'amazon business', 'phrase', 2.0),
  ('amazon_business', 'sell on amazon', 'phrase', 2.0),
  ('amazon_business', 'private label', 'phrase', 2.0),
  ('ebay_selling', 'ebay', 'keyword', 3.5),
  ('shopify_store', 'shopify', 'keyword', 3.5),
  ('shopify_store', 'dropshipping', 'keyword', 1.5),
  ('ecommerce_general', 'ecommerce', 'keyword', 3.0),
  ('ecommerce_general', 'online store', 'phrase', 2.5),
  ('ecommerce_general', 'sell product online', 'phrase', 3.0),
  ('ecommerce_general', 'sell * online', 'pattern', 2.0),
  ('ecommerce_general', 'general ecommerce', 'phrase', 2.0),
  ('online_business', 'online business', 'phrase', 3.5),
  ('online_business', 'business online', 'phrase', 3.0),
  ('online_business', 'start * business', 'pattern', 2.5),
  ('online_business', 'own business', 'phrase', 2.0),
  ('online_business', 'make money online', 'phrase', 3.0),
  ('online_business', 'side hustle', 'phrase', 2.5),
  ('own_store', 'own store', 'phrase', 3.5),
  ('own_store', 'own * store', 'pattern', 3.5),
  ('own_store', 'my own store', 'phrase', 1.0),
  ('own_store', 'build * store', 'pattern', 2.5),
  ('own_store', 'start * store', 'pattern', 2.0),
  ('marketplace_selling', 'marketplace', 'keyword', 3.0),
  ('marketplace_selling', 'sell on marketplace', 'phrase', 1.5),
  ('digital_marketing', 'digital marketing', 'phrase', 3.5),
  ('digital_marketing', 'social media', 'phrase', 3.0),
  ('digital_marketing', 'advertising', 'keyword', 2.5),
  ('digital_marketing', 'online campaign', 'phrase', 3.0),
  ('digital_marketing', 'marketing strategy', 'phrase', 2.5),
  ('digital_marketing', 'marketing', 'keyword', 1.5),
  ('digital_marketing', 'facebook', 'keyword', 1.5),
  ('digital_marketing', 'instagram', 'keyword', 1.5),
  ('digital_marketing', 'tiktok', 'keyword', 1.5),
  ('digital_marketing', 'email marketing', 'phrase', 2.5),
  ('digital_marketing', 'brand', 'keyword', 1.0),
  ('seo', 'seo', 'keyword', 3.5),
  ('seo', 'organic traffic', 'phrase', 3.5),
  ('seo', 'google ranking', 'phrase', 3.0),
  ('seo', 'rank * google', 'pattern', 3.0),
  ('seo', 'rank * website', 'pattern', 2.5),
  ('seo', 'search visibility', 'phrase', 3.0),
  ('seo', 'keyword research', 'phrase', 3.0),
  ('seo', 'website ranking', 'phrase', 3.0),
  ('seo', 'search engine', 'phrase', 2.5),
  ('seo', 'rank', 'keyword', 2.0),
  ('seo', 'traffic', 'keyword', 1.5),
  ('company_formation', 'llc', 'keyword', 3.5),
  ('company_formation', 'ltd', 'keyword', 3.5),
  ('company_formation', 'register * company', 'pattern', 3.0),
  ('company_formation', 'form * company', 'pattern', 3.0),
  ('company_formation', 'establish * company', 'pattern', 3.0),
  ('company_formation', 'set up * company', 'pattern', 3.0),
  ('company_formation', 'start * company', 'pattern', 2.5),
  ('company_formation', 'company formation', 'phrase', 3.0),
  ('company_formation', 'incorporate', 'keyword', 2.5),
  ('company_formation', 'company', 'keyword', 1.0),
  ('not_sure', 'not sure', 'phrase', 3.0),
  ('not_sure', 'no idea', 'phrase', 3.0),
  ('not_sure', 'which course', 'phrase', 2.5),
  ('not_sure', 'right for me', 'phrase', 2.0),
  ('not_sure', 'help me choose', 'phrase', 3.0),
  ('not_sure', 'don t know', 'phrase', 2.0),
  ('not_sure', 'where to start', 'phrase', 2.0),
  ('not_sure', 'recommend', 'keyword', 1.0),
  ('greeting', 'hello', 'keyword', 1.5),
  ('greeting', 'hi', 'keyword', 1.5),
  ('greeting', 'hey', 'keyword', 1.5),
  ('greeting', 'good morning', 'phrase', 1.5),
  ('greeting', 'good evening', 'phrase', 1.5),
  ('thanks', 'thank', 'keyword', 2.0),
  ('thanks', 'thx', 'keyword', 2.0),
  ('thanks', 'that s all', 'phrase', 2.0)
) as v(intent_key, keyword, match_type, weight)
join public.course_advisor_intents i on i.intent_key = v.intent_key
on conflict (intent_id, keyword, match_type) do nothing;

insert into public.course_advisor_synonyms (term, replacement) values
  ('e-commerce', 'ecommerce'),
  ('e commerce', 'ecommerce'),
  ('web site', 'website'),
  ('web sites', 'website'),
  ('webpage', 'website'),
  ('site', 'website'),
  ('sites', 'website'),
  ('iphone', 'ios'),
  ('ipad', 'ios'),
  ('apple', 'ios'),
  ('application', 'app'),
  ('applications', 'app'),
  ('online shop', 'online store'),
  ('shop', 'store'),
  ('ads', 'advertising'),
  ('advert', 'advertising'),
  ('advertisement', 'advertising'),
  ('programming', 'code'),
  ('coding', 'code'),
  ('front-end', 'frontend'),
  ('back-end', 'backend'),
  ('limited company', 'ltd'),
  ('limited liability company', 'llc'),
  ('fulfilled by amazon', 'fba'),
  ('search engine optimization', 'seo'),
  ('search engine optimisation', 'seo'),
  ('clients', 'client'),
  ('customers', 'customer')
on conflict (term) do nothing;

insert into public.course_advisor_recommendations (intent_id, course_id, recommendation_priority, role, explanation)
select i.id, c.id, v.priority, v.role, v.explanation
from (values
  ('website_development', 'modern-web-development', 1, 'primary', 'Code real websites and web apps from the ground up.'),
  ('website_development', 'wordpress-development-fundamentals', 2, 'primary', 'Deliver client sites quickly on the world''s most used platform.'),
  ('wordpress_websites', 'wordpress-development-fundamentals', 1, 'primary', 'Themes, plugins and launching production WordPress sites.'),
  ('mobile_app_development', 'mobile-app-development', 1, 'primary', 'Build and publish apps for Android and iPhone.'),
  ('mobile_app_development', 'modern-web-development', 2, 'supporting', 'Web fundamentals that most app projects also need.'),
  ('amazon_business', 'amazon-fba-foundations', 1, 'primary', 'Product research, sourcing and selling with Fulfilled by Amazon.'),
  ('ebay_selling', 'ebay-selling-playbook', 1, 'primary', 'List, price and ship products profitably on eBay.'),
  ('shopify_store', 'shopify-store-launch', 1, 'primary', 'Set up, design and launch your Shopify store.'),
  ('shopify_store', 'e-commerce-business-essentials', 2, 'supporting', 'The business side of running any online store.'),
  ('ecommerce_general', 'e-commerce-business-essentials', 1, 'primary', 'The essentials of starting and running an e-commerce business.'),
  ('ecommerce_general', 'shopify-store-launch', 2, 'supporting', 'Put the essentials into practice with your own store.'),
  ('marketplace_selling', 'amazon-fba-foundations', 1, 'primary', 'Sell on the world''s largest marketplace with FBA.'),
  ('marketplace_selling', 'ebay-selling-playbook', 2, 'primary', 'Start selling quickly on eBay.'),
  ('digital_marketing', 'digital-marketing-fundamentals', 1, 'primary', 'Social media, advertising and campaigns that convert.'),
  ('seo', 'complete-seo-framework', 1, 'primary', 'Keyword research, on-page SEO and earning organic traffic.'),
  ('seo', 'wordpress-development-fundamentals', 2, 'supporting', 'Useful if your site runs on WordPress.'),
  ('company_formation', 'llc-and-ltd-formation-guide', 1, 'primary', 'How US LLCs and UK Ltd companies are formed and run.')
) as v(intent_key, slug, priority, role, explanation)
join public.course_advisor_intents i on i.intent_key = v.intent_key
join public.courses c on c.slug = v.slug
on conflict (intent_id, course_id) do nothing;

-- FAQs the advisor (and the FAQ page) can answer from.
insert into public.faqs (question, answer, category, sort_order, is_published, show_on_home, keywords, advisor_priority)
select v.question, v.answer, v.category, v.sort_order, true, false, v.keywords, v.priority
from (values
  ('Which course should I choose?',
   '<p>Start from your goal. Open the course advisor (bottom-left of any page) and tell it what you want to achieve, or browse every course on <a href="/courses/select">Build your learning plan</a>, where you can compare prices and pick several at once.</p>',
   'courses', 100, array['which course', 'choose', 'right course', 'recommend', 'best course'], 1),
  ('How do I pay?',
   '<p>Pick your courses on <a href="/courses/select">Build your learning plan</a>, enter the learner''s email address and continue to secure checkout. Payments are processed by Whop; the payment methods available to you are shown on the checkout page. You don''t need an account to pay.</p>',
   'billing', 101, array['pay', 'payment', 'how to pay', 'payment method', 'card', 'checkout'], 2),
  ('Can my institution, employer or parent pay for me?',
   '<p>Yes. At checkout choose <strong>Generate &amp; copy payment link</strong> and send the link to whoever is paying. They pay with their own details, and the courses are always set up for the learner email you entered — not the payer''s.</p>',
   'billing', 102, array['institution', 'employer', 'parent', 'someone else', 'pay for me', 'sponsor', 'payment link', 'school', 'company pay'], 3),
  ('Can I buy more than one course at once?',
   '<p>Yes. Add as many courses as you like to your learning package. You''ll see each course''s price, any discount and the total before you pay, and you pay once for all of them.</p>',
   'billing', 103, array['multiple courses', 'several courses', 'more than one', 'many courses', 'package', 'bundle'], 2),
  ('What happens after I pay?',
   '<p>As soon as the payment is confirmed we email the learner. New learners get a secure link to create their password; if the email already has an account, the courses are added to it straight away and appear under My courses.</p>',
   'billing', 104, array['after payment', 'after i pay', 'what happens', 'next step', 'paid'], 2),
  ('How do I receive my login details?',
   '<p>We never email passwords. After your payment is confirmed you''ll receive an email with a secure, single-use link to create your own password. From then on, sign in with your email address and that password.</p>',
   'billing', 105, array['login', 'log in', 'password', 'credential', 'account details', 'sign in', 'username'], 3),
  ('Can I extend my access?',
   '<p>Yes — buy the course again from <a href="/courses/select">Build your learning plan</a>. A new purchase starts its own access period when its payment is confirmed, and your progress and certificates are kept. For anything else, contact support.</p>',
   'billing', 106, array['extend', 'renew', 'more time', 'access ended', 'expired', 'expire'], 2),
  ('How can I contact support?',
   '<p>Use the <a href="/contact">contact page</a>, or open a support ticket from your dashboard once you''re signed in. We reply by email.</p>',
   'general', 107, array['support', 'contact', 'help', 'talk to someone', 'human', 'email you'], 2)
) as v(question, answer, category, sort_order, keywords, priority)
where not exists (select 1 from public.faqs f where f.question = v.question);

update public.faqs set keywords = array['how long', 'access', 'duration', 'days', 'lifetime']
where question = 'How long will I have access?' and keywords = '{}';
