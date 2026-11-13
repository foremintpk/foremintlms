-- Commerce: products, plans, bundles, coupons, Whop customers, checkout
-- sessions, transactions, subscriptions, billing documents, webhook events
-- and reconciliation logs. Whop is the payment processor; this schema is the
-- application's own record of what was sold and what access it grants.

create table public.products (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('course', 'bundle', 'membership')),
  name text not null check (length(name) between 1 and 200),
  slug text not null unique check (private.is_valid_slug(slug)),
  description text,
  image_url text,
  course_id uuid unique references public.courses (id) on delete cascade,
  grants_all_courses boolean not null default false,
  status text not null default 'active' check (status in ('active', 'archived')),
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  whop_product_id text unique,
  whop_synced_at timestamptz,
  whop_sync_error text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'course' and course_id is not null) or kind <> 'course'),
  check ((kind = 'membership') or not grants_all_courses)
);
create index products_kind_idx on public.products (kind, status);

-- Which courses a product unlocks (course products have exactly their course;
-- bundles list several; memberships either list courses or grant all).
create table public.product_courses (
  product_id uuid not null references public.products (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (product_id, course_id)
);
create index product_courses_course_idx on public.product_courses (course_id);

create table public.pricing_plans (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  description text,
  plan_type text not null check (plan_type in ('free', 'one_time', 'recurring')),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  price_cents integer not null default 0 check (price_cents >= 0),
  compare_at_price_cents integer check (compare_at_price_cents >= 0),
  -- one-time: days of access, null = lifetime
  access_duration_days integer check (access_duration_days > 0),
  -- recurring: billing period in days (30 monthly, 365 yearly, …)
  billing_period_days integer check (billing_period_days > 0),
  trial_days integer check (trial_days >= 0),
  grace_period_days integer not null default 3 check (grace_period_days between 0 and 60),
  stock_limit integer check (stock_limit >= 0),
  units_sold integer not null default 0 check (units_sold >= 0),
  available_from timestamptz,
  available_until timestamptz,
  promo_label text check (length(promo_label) <= 60),
  visibility text not null default 'public' check (visibility in ('public', 'hidden', 'archived')),
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  whop_plan_id text unique,
  whop_synced_at timestamptz,
  whop_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (plan_type <> 'recurring' or billing_period_days is not null),
  check (plan_type <> 'free' or price_cents = 0),
  check (available_until is null or available_from is null or available_until > available_from)
);
create index pricing_plans_product_idx on public.pricing_plans (product_id, visibility, sort_order);

create table public.course_bundles (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products (id) on delete cascade,
  headline text,
  highlights text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code extensions.citext not null unique check (code ~ '^[A-Za-z0-9_-]{3,40}$'),
  description text,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  amount numeric(10, 2) not null check (amount > 0),
  currency text check (currency ~ '^[a-z]{3}$'),
  max_redemptions integer check (max_redemptions > 0),
  redemptions_count integer not null default 0,
  starts_at timestamptz,
  expires_at timestamptz,
  plan_ids uuid[] not null default '{}',
  new_customers_only boolean not null default false,
  status text not null default 'active' check (status in ('active', 'disabled', 'archived')),
  whop_promo_code_id text unique,
  whop_synced_at timestamptz,
  whop_sync_error text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_type <> 'percent' or amount <= 100)
);

create table public.whop_customers (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  whop_user_id text unique,
  whop_member_id text,
  email extensions.citext,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per checkout started from the app. Its id travels to Whop as
-- metadata so webhooks can be matched back to the user and plan.
create table public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_id uuid not null references public.pricing_plans (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  coupon_id uuid references public.coupons (id) on delete set null,
  whop_checkout_id text unique,
  purchase_url text,
  status text not null default 'created' check (status in ('created', 'completed', 'expired', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index checkout_sessions_user_idx on public.checkout_sessions (user_id, created_at desc);

create table public.subscription_records (
  id uuid primary key default gen_random_uuid(),
  whop_membership_id text not null unique,
  user_id uuid references public.profiles (id) on delete set null,
  plan_id uuid references public.pricing_plans (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  status text not null check (status in ('trialing', 'active', 'past_due', 'canceling', 'canceled', 'expired', 'completed', 'unresolved', 'drafted')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  manage_url text,
  last_synced_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscription_records_user_idx on public.subscription_records (user_id);

create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  whop_payment_id text not null unique,
  user_id uuid references public.profiles (id) on delete set null,
  plan_id uuid references public.pricing_plans (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  checkout_session_id uuid references public.checkout_sessions (id) on delete set null,
  subscription_record_id uuid references public.subscription_records (id) on delete set null,
  whop_membership_id text,
  status text not null check (status in ('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded', 'disputed', 'voided')),
  billing_reason text check (billing_reason in ('initial', 'renewal', 'one_time', 'other')),
  currency text not null default 'usd',
  subtotal_cents integer,
  discount_cents integer not null default 0,
  tax_cents integer,
  total_cents integer not null default 0,
  refunded_cents integer not null default 0,
  promo_code text,
  card_brand text,
  card_last4 text,
  failure_reason text,
  paid_at timestamptz,
  refunded_at timestamptz,
  last_synced_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payment_transactions_user_idx on public.payment_transactions (user_id, created_at desc);
create index payment_transactions_status_idx on public.payment_transactions (status, paid_at desc);
create index payment_transactions_membership_idx on public.payment_transactions (whop_membership_id);

create sequence public.billing_document_number_seq start 1001;

create table public.billing_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  transaction_id uuid references public.payment_transactions (id) on delete set null,
  document_type text not null check (document_type in ('receipt', 'invoice', 'credit_note')),
  issuer text not null check (issuer in ('whop', 'foremint')),
  number text not null unique,
  whop_invoice_id text,
  external_url text,
  storage_path text,
  status text not null default 'issued' check (status in ('draft', 'issued', 'paid', 'void', 'refunded')),
  currency text not null default 'usd',
  total_cents integer not null default 0,
  issued_at timestamptz not null default now(),
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index billing_documents_user_idx on public.billing_documents (user_id, issued_at desc);
create index billing_documents_transaction_idx on public.billing_documents (transaction_id);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('whop', 'mux', 'bunny', 'zoom', 'resend', 'google')),
  event_id text not null,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received', 'processing', 'processed', 'failed', 'ignored')),
  attempts integer not null default 0,
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  next_attempt_at timestamptz,
  unique (provider, event_id)
);
create index webhook_events_status_idx on public.webhook_events (status, next_attempt_at);

create table public.payment_reconciliation_logs (
  id uuid primary key default gen_random_uuid(),
  trigger text not null default 'scheduled' check (trigger in ('scheduled', 'manual')),
  status text not null default 'running' check (status in ('running', 'completed', 'failed', 'skipped')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  checked_count integer not null default 0,
  updated_count integer not null default 0,
  mismatches jsonb not null default '[]'::jsonb,
  error text,
  triggered_by uuid references public.profiles (id) on delete set null
);

create trigger products_updated_at before update on public.products for each row execute function private.set_updated_at();
create trigger pricing_plans_updated_at before update on public.pricing_plans for each row execute function private.set_updated_at();
create trigger course_bundles_updated_at before update on public.course_bundles for each row execute function private.set_updated_at();
create trigger coupons_updated_at before update on public.coupons for each row execute function private.set_updated_at();
create trigger whop_customers_updated_at before update on public.whop_customers for each row execute function private.set_updated_at();
create trigger subscription_records_updated_at before update on public.subscription_records for each row execute function private.set_updated_at();
create trigger payment_transactions_updated_at before update on public.payment_transactions for each row execute function private.set_updated_at();

alter table public.products enable row level security;
alter table public.product_courses enable row level security;
alter table public.pricing_plans enable row level security;
alter table public.course_bundles enable row level security;
alter table public.coupons enable row level security;
alter table public.whop_customers enable row level security;
alter table public.checkout_sessions enable row level security;
alter table public.subscription_records enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.billing_documents enable row level security;
alter table public.webhook_events enable row level security;
alter table public.payment_reconciliation_logs enable row level security;
