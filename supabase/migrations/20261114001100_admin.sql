-- Administration: platform settings, integration settings (encrypted
-- secrets), versioned legal documents, audit logs and rate limiting.

create table public.platform_settings (
  key text primary key check (key ~ '^[a-z0-9_.]+$'),
  value jsonb not null,
  description text,
  -- Public settings (brand name, support email…) may be read anonymously.
  is_public boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Integration credentials entered from the admin dashboard. Secret values are
-- AES-256-GCM encrypted by the application before they reach the database,
-- and no client role can read this table.
create table public.integration_settings (
  provider text primary key check (provider in ('whop', 'resend', 'mux', 'bunny', 'youtube', 'zoom', 'google')),
  config jsonb not null default '{}'::jsonb,
  secrets_enc text,
  status text not null default 'not_configured' check (status in ('not_configured', 'configured', 'connected', 'error')),
  last_checked_at timestamptz,
  last_error text,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug in ('terms', 'privacy', 'refund', 'cookies')),
  title text not null,
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.legal_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.legal_documents (id) on delete cascade,
  version integer not null check (version > 0),
  body text not null,
  change_summary text,
  effective_date date not null default current_date,
  status text not null default 'draft' check (status in ('draft', 'published', 'superseded')),
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (document_id, version)
);

alter table public.legal_documents
  add constraint legal_documents_current_version_fk
  foreign key (current_version_id) references public.legal_document_versions (id) on delete set null;

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id text,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);

-- Audit rows are append-only, even for the service role. The single allowed
-- change is the foreign-key action that clears actor_id when an account is
-- deleted (the entry itself, including its summary, is preserved).
create or replace function private.prevent_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and new.actor_id is null
     and old.actor_id is not null
     and (to_jsonb(new) - 'actor_id') = (to_jsonb(old) - 'actor_id') then
    return new;
  end if;
  raise exception 'audit_logs is append-only';
end;
$$;
create trigger audit_logs_immutable before update or delete on public.audit_logs
  for each row execute function private.prevent_audit_mutation();

create table public.rate_limit_buckets (
  key text primary key,
  window_start timestamptz not null,
  count integer not null default 0
);

create trigger platform_settings_updated_at before update on public.platform_settings for each row execute function private.set_updated_at();
create trigger integration_settings_updated_at before update on public.integration_settings for each row execute function private.set_updated_at();
create trigger legal_documents_updated_at before update on public.legal_documents for each row execute function private.set_updated_at();

alter table public.platform_settings enable row level security;
alter table public.integration_settings enable row level security;
alter table public.legal_documents enable row level security;
alter table public.legal_document_versions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.rate_limit_buckets enable row level security;
