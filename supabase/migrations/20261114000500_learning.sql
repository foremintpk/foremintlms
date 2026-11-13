-- Learning: enrollments, entitlements (the source of truth for access),
-- lesson progress, bookmarks and personal notes.

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed', 'expired', 'revoked', 'archived')),
  source text not null check (source in ('purchase', 'subscription', 'membership', 'bundle', 'free', 'manual')),
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  last_lesson_id uuid references public.lessons (id) on delete set null,
  last_accessed_at timestamptz,
  progress_percent numeric(5, 2) not null default 0 check (progress_percent between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_id)
);
create index enrollments_course_idx on public.enrollments (course_id, status);
create index enrollments_user_idx on public.enrollments (user_id, status);

-- Access grants. A student can open paid content only while an active,
-- unexpired entitlement exists for the course (or an all-access grant).
create table public.course_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  scope text not null default 'course' check (scope in ('course', 'all_access')),
  course_id uuid references public.courses (id) on delete cascade,
  enrollment_id uuid references public.enrollments (id) on delete set null,
  source text not null check (source in ('purchase', 'subscription', 'membership', 'bundle', 'free', 'manual')),
  product_id uuid references public.products (id) on delete set null,
  pricing_plan_id uuid references public.pricing_plans (id) on delete set null,
  checkout_session_id uuid references public.checkout_sessions (id) on delete set null,
  payment_transaction_id uuid references public.payment_transactions (id) on delete set null,
  subscription_record_id uuid references public.subscription_records (id) on delete set null,
  whop_membership_id text,
  status text not null default 'active' check (status in ('active', 'expired', 'revoked', 'suspended')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  granted_by uuid references public.profiles (id) on delete set null,
  grant_reason text,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  revoke_reason text,
  expiry_reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scope = 'course' and course_id is not null) or (scope = 'all_access' and course_id is null)),
  check (expires_at is null or expires_at > starts_at),
  -- Manual grants must be justified. granted_by is recorded by the server and
  -- may later become null if that administrator's account is deleted.
  check (source <> 'manual' or grant_reason is not null)
);
create index course_entitlements_user_course_idx on public.course_entitlements (user_id, course_id, status);
create index course_entitlements_user_scope_idx on public.course_entitlements (user_id, scope, status);
create index course_entitlements_expiry_idx on public.course_entitlements (expires_at) where status = 'active' and expires_at is not null;
create index course_entitlements_membership_idx on public.course_entitlements (whop_membership_id);
create index course_entitlements_payment_idx on public.course_entitlements (payment_transaction_id);
-- One entitlement per payment per course keeps webhook retries idempotent.
create unique index course_entitlements_payment_course_uniq
  on public.course_entitlements (payment_transaction_id, coalesce(course_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where payment_transaction_id is not null;
create unique index course_entitlements_subscription_course_uniq
  on public.course_entitlements (subscription_record_id, coalesce(course_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where subscription_record_id is not null;

create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  progress_percent numeric(5, 2) not null default 0 check (progress_percent between 0 and 100),
  video_position_seconds numeric(10, 2) not null default 0 check (video_position_seconds >= 0),
  video_duration_seconds numeric(10, 2),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  last_viewed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);
create index lesson_progress_user_course_idx on public.lesson_progress (user_id, course_id);
create index lesson_progress_course_idx on public.lesson_progress (course_id, status);

create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  position_seconds numeric(10, 2),
  label text check (length(label) <= 200),
  created_at timestamptz not null default now()
);
create index bookmarks_user_idx on public.bookmarks (user_id, course_id);

create table public.student_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  body text not null check (length(body) between 1 and 20000),
  position_seconds numeric(10, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index student_notes_user_idx on public.student_notes (user_id, lesson_id);

create trigger enrollments_updated_at before update on public.enrollments for each row execute function private.set_updated_at();
create trigger course_entitlements_updated_at before update on public.course_entitlements for each row execute function private.set_updated_at();
create trigger lesson_progress_updated_at before update on public.lesson_progress for each row execute function private.set_updated_at();
create trigger student_notes_updated_at before update on public.student_notes for each row execute function private.set_updated_at();

alter table public.enrollments enable row level security;
alter table public.course_entitlements enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.bookmarks enable row level security;
alter table public.student_notes enable row level security;
