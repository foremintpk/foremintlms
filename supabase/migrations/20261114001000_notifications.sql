-- Notifications and transactional email: in-app notifications, per-category
-- preferences, editable email templates, a durable outbox and delivery events.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null check (category in ('learning', 'billing', 'messages', 'discussions', 'support', 'live', 'system')),
  type text not null,
  title text not null check (length(title) <= 200),
  body text check (length(body) <= 2000),
  url text,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

create table public.notification_preferences (
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null check (category in ('learning', 'billing', 'messages', 'discussions', 'support', 'live', 'marketing')),
  email_enabled boolean not null default true,
  in_app_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

create table public.email_templates (
  key text primary key check (key ~ '^[a-z0-9_.]+$'),
  name text not null,
  description text,
  category text not null check (category in ('auth', 'billing', 'learning', 'communication', 'system')),
  subject text not null,
  preheader text,
  heading text not null,
  body text not null,
  cta_label text,
  is_enabled boolean not null default true,
  -- Security emails (password reset, verification) cannot be disabled.
  is_required boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  template_key text not null references public.email_templates (key) on update cascade,
  user_id uuid references public.profiles (id) on delete set null,
  to_email extensions.citext not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'cancelled', 'skipped')),
  attempts integer not null default 0,
  max_attempts integer not null default 6,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index email_outbox_pending_idx on public.email_outbox (next_attempt_at) where status in ('pending', 'failed');
create index email_outbox_user_idx on public.email_outbox (user_id, created_at desc);
create index email_outbox_provider_idx on public.email_outbox (provider_message_id);

create table public.email_delivery_events (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid references public.email_outbox (id) on delete set null,
  provider_message_id text,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index email_delivery_events_outbox_idx on public.email_delivery_events (outbox_id);

create trigger notification_preferences_updated_at before update on public.notification_preferences for each row execute function private.set_updated_at();
create trigger email_templates_updated_at before update on public.email_templates for each row execute function private.set_updated_at();

alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.email_templates enable row level security;
alter table public.email_outbox enable row level security;
alter table public.email_delivery_events enable row level security;
