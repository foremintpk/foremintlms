-- Live learning: meeting provider connections (Zoom, Google Meet), sessions,
-- invitations, attendance, recordings and session resources.

create table public.meeting_provider_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null check (provider in ('zoom', 'google_meet')),
  account_email text,
  external_account_id text,
  -- AES-256-GCM ciphertext produced by the application (ENCRYPTION_KEY).
  access_token_enc text,
  refresh_token_enc text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  status text not null default 'connected' check (status in ('connected', 'expired', 'revoked', 'error')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  host_id uuid references public.profiles (id) on delete set null,
  title text not null check (length(title) between 1 and 200),
  description text,
  provider text not null check (provider in ('zoom', 'google_meet', 'external')),
  provider_connection_id uuid references public.meeting_provider_connections (id) on delete set null,
  external_meeting_id text,
  join_url text,
  meeting_passcode text,
  starts_at timestamptz not null,
  duration_minutes integer not null default 60 check (duration_minutes between 5 and 600),
  timezone text not null default 'UTC',
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'completed', 'canceled')),
  announcement text,
  canceled_reason text,
  reminder_24h_sent_at timestamptz,
  reminder_1h_sent_at timestamptz,
  provider_sync_error text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index live_sessions_course_idx on public.live_sessions (course_id, starts_at);
create index live_sessions_upcoming_idx on public.live_sessions (starts_at) where status = 'scheduled';
create index live_sessions_external_idx on public.live_sessions (provider, external_meeting_id);

create table public.live_session_attendees (
  session_id uuid not null references public.live_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  invited_at timestamptz not null default now(),
  rsvp text check (rsvp in ('going', 'maybe', 'declined')),
  primary key (session_id, user_id)
);
create index live_session_attendees_user_idx on public.live_session_attendees (user_id);

create table public.live_session_attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  participant_name text,
  participant_email extensions.citext,
  joined_at timestamptz,
  left_at timestamptz,
  duration_seconds integer check (duration_seconds >= 0),
  source text not null check (source in ('provider', 'manual', 'join_click')),
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index live_session_attendance_session_idx on public.live_session_attendance (session_id);
create unique index live_session_attendance_manual_uniq on public.live_session_attendance (session_id, user_id) where source in ('manual', 'join_click');

create table public.meeting_recordings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions (id) on delete cascade,
  provider text not null check (provider in ('zoom', 'google_meet', 'external', 'video_asset')),
  external_id text,
  title text,
  url text,
  passcode text,
  video_asset_id uuid references public.video_assets (id) on delete set null,
  duration_seconds integer,
  recorded_at timestamptz,
  is_visible boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index meeting_recordings_session_idx on public.meeting_recordings (session_id);
create unique index meeting_recordings_external_uniq on public.meeting_recordings (provider, external_id) where external_id is not null;

create table public.live_session_resources (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions (id) on delete cascade,
  title text not null,
  media_file_id uuid references public.media_files (id) on delete cascade,
  url text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (media_file_id is not null or url is not null)
);
create index live_session_resources_session_idx on public.live_session_resources (session_id);

alter table public.lesson_content_blocks
  add constraint lesson_content_blocks_live_fk foreign key (live_session_id) references public.live_sessions (id) on delete set null;

create trigger meeting_provider_connections_updated_at before update on public.meeting_provider_connections for each row execute function private.set_updated_at();
create trigger live_sessions_updated_at before update on public.live_sessions for each row execute function private.set_updated_at();

alter table public.meeting_provider_connections enable row level security;
alter table public.live_sessions enable row level security;
alter table public.live_session_attendees enable row level security;
alter table public.live_session_attendance enable row level security;
alter table public.meeting_recordings enable row level security;
alter table public.live_session_resources enable row level security;
