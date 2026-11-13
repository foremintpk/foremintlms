-- Identity: profiles, private account details, roles, teachers, preferences,
-- invitations and authentication audit events.

-- Display-level profile. Visible to people who share a learning context.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (length(full_name) <= 120),
  display_name text check (length(display_name) <= 80),
  avatar_url text check (length(avatar_url) <= 2048),
  headline text check (length(headline) <= 160),
  bio text check (length(bio) <= 4000),
  timezone text not null default 'UTC' check (length(timezone) <= 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Private account details. Visible only to the user, admins and (for email)
-- the instructors of courses the user is enrolled in.
create table public.profile_private (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  email extensions.citext not null,
  phone text check (length(phone) <= 40),
  country text check (length(country) <= 2),
  billing_name text check (length(billing_name) <= 160),
  billing_address jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'suspended')),
  suspended_reason text,
  last_sign_in_at timestamptz,
  deletion_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profile_private_email_idx on public.profile_private (email);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
create index user_roles_role_idx on public.user_roles (role);

-- Instructor profile. Public fields are shown on the marketing site once the
-- teacher is approved and marked public.
create table public.teacher_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  slug text not null unique check (private.is_valid_slug(slug)),
  public_name text not null check (length(public_name) between 1 and 120),
  headline text check (length(headline) <= 160),
  bio text check (length(bio) <= 8000),
  avatar_url text,
  expertise text[] not null default '{}',
  website_url text,
  social_links jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('invited', 'pending', 'approved', 'suspended')),
  is_public boolean not null default false,
  is_featured boolean not null default false,
  can_create_courses boolean not null default false,
  sort_order integer not null default 0,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index teacher_profiles_status_idx on public.teacher_profiles (status, is_public);

create table public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  locale text not null default 'en',
  autoplay_next_lesson boolean not null default true,
  playback_rate numeric(3, 2) not null default 1.0 check (playback_rate between 0.5 and 2.5),
  marketing_emails boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.account_invitations (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null,
  role public.app_role not null check (role in ('teacher', 'admin')),
  token_hash text not null unique,
  full_name text,
  message text,
  course_ids uuid[] not null default '{}',
  invited_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index account_invitations_email_idx on public.account_invitations (email);

-- Authentication / session audit trail (login, logout, password change, MFA…).
create table public.auth_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  email extensions.citext,
  event text not null check (event in (
    'sign_in', 'sign_in_failed', 'sign_out', 'sign_up', 'password_reset_requested',
    'password_changed', 'email_verified', 'mfa_enrolled', 'mfa_verified', 'mfa_removed',
    'session_revoked', 'invitation_accepted'
  )),
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index auth_events_user_idx on public.auth_events (user_id, created_at desc);

-- New auth user → profile, private details, default student role, preferences.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(left(new.raw_user_meta_data ->> 'full_name', 120), ''));

  insert into public.profile_private (user_id, email)
  values (new.id, new.email);

  insert into public.user_roles (user_id, role)
  values (new.id, 'student');

  insert into public.user_preferences (user_id)
  values (new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Keep the private email in sync when a user changes it in Supabase Auth.
create or replace function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profile_private set email = new.email, updated_at = now()
    where user_id = new.id;
  end if;
  if new.last_sign_in_at is distinct from old.last_sign_in_at then
    update public.profile_private set last_sign_in_at = new.last_sign_in_at
    where user_id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_updated
  after update of email, last_sign_in_at on auth.users
  for each row execute function private.handle_user_email_change();

create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger profile_private_updated_at before update on public.profile_private
  for each row execute function private.set_updated_at();
create trigger teacher_profiles_updated_at before update on public.teacher_profiles
  for each row execute function private.set_updated_at();
create trigger user_preferences_updated_at before update on public.user_preferences
  for each row execute function private.set_updated_at();

alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.user_roles enable row level security;
alter table public.teacher_profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.account_invitations enable row level security;
alter table public.auth_events enable row level security;
