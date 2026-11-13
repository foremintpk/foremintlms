-- Catalog: categories, learning paths, courses, instructors, modules,
-- lessons, content blocks, media, video assets, resources and reviews.

create table public.course_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (private.is_valid_slug(slug)),
  name text not null check (length(name) between 1 and 120),
  short_description text check (length(short_description) <= 280),
  description text,
  image_url text,
  icon text,
  accent_color text check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index course_categories_status_idx on public.course_categories (status, sort_order);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (private.is_valid_slug(slug)),
  title text not null check (length(title) between 1 and 200),
  short_description text check (length(short_description) <= 400),
  description text,
  thumbnail_url text,
  banner_url text,
  promo_video jsonb,
  category_id uuid references public.course_categories (id) on delete set null,
  level text not null default 'all_levels' check (level in ('beginner', 'intermediate', 'advanced', 'all_levels')),
  language text not null default 'en',
  estimated_duration_minutes integer check (estimated_duration_minutes >= 0),
  learning_outcomes text[] not null default '{}',
  requirements text[] not null default '{}',
  target_audience text[] not null default '{}',
  tags text[] not null default '{}',
  visibility text not null default 'public' check (visibility in ('public', 'unlisted', 'private')),
  status text not null default 'draft' check (status in ('draft', 'in_review', 'published', 'unpublished', 'archived')),
  is_free boolean not null default false,
  is_featured boolean not null default false,
  sequential_progression boolean not null default false,
  certificate_enabled boolean not null default true,
  certificate_min_progress integer not null default 100 check (certificate_min_progress between 1 and 100),
  certificate_require_quizzes boolean not null default true,
  certificate_require_assignments boolean not null default true,
  discussions_enabled boolean not null default true,
  sort_order integer not null default 0,
  published_at timestamptz,
  scheduled_publish_at timestamptz,
  submitted_for_review_at timestamptz,
  submitted_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  review_notes text,
  created_by uuid references public.profiles (id) on delete set null,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index courses_status_idx on public.courses (status, visibility);
create index courses_category_idx on public.courses (category_id);
create index courses_featured_idx on public.courses (is_featured) where is_featured;
create index courses_title_trgm_idx on public.courses using gin (title extensions.gin_trgm_ops);
create index courses_scheduled_idx on public.courses (scheduled_publish_at) where scheduled_publish_at is not null;

create table public.course_instructors (
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'lead' check (role in ('lead', 'assistant')),
  can_edit boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (course_id, user_id)
);
create index course_instructors_user_idx on public.course_instructors (user_id);

create table public.learning_paths (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (private.is_valid_slug(slug)),
  title text not null check (length(title) between 1 and 200),
  summary text check (length(summary) <= 400),
  description text,
  image_url text,
  level text not null default 'all_levels' check (level in ('beginner', 'intermediate', 'advanced', 'all_levels')),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.learning_path_courses (
  learning_path_id uuid not null references public.learning_paths (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  sort_order integer not null default 0,
  is_required boolean not null default true,
  primary key (learning_path_id, course_id)
);
create index learning_path_courses_course_idx on public.learning_path_courses (course_id);

create table public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null check (length(title) between 1 and 200),
  description text,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  release_at timestamptz,
  release_after_days integer check (release_after_days >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index course_modules_course_idx on public.course_modules (course_id, sort_order);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  module_id uuid not null references public.course_modules (id) on delete cascade,
  title text not null check (length(title) between 1 and 200),
  summary text,
  lesson_type text not null default 'mixed' check (lesson_type in ('video', 'article', 'quiz', 'assignment', 'live', 'resource', 'mixed')),
  sort_order integer not null default 0,
  duration_minutes integer check (duration_minutes >= 0),
  is_preview boolean not null default false,
  is_published boolean not null default true,
  release_at timestamptz,
  release_after_days integer check (release_after_days >= 0),
  prerequisite_lesson_id uuid references public.lessons (id) on delete set null,
  completion_rule text not null default 'manual' check (completion_rule in ('manual', 'video_watched', 'quiz_passed', 'assignment_approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lessons_module_idx on public.lessons (module_id, sort_order);
create index lessons_course_idx on public.lessons (course_id);

-- Any uploaded file that lives in Supabase Storage.
create table public.media_files (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  purpose text not null check (purpose in (
    'course_content', 'course_image', 'category_image', 'marketing', 'avatar',
    'submission', 'message_attachment', 'ticket_attachment', 'live_resource', 'document'
  )),
  course_id uuid references public.courses (id) on delete cascade,
  uploaded_by uuid references public.profiles (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'ready', 'rejected', 'deleted')),
  created_at timestamptz not null default now(),
  unique (bucket, storage_path)
);
create index media_files_course_idx on public.media_files (course_id);
create index media_files_uploader_idx on public.media_files (uploaded_by);

-- Provider-agnostic video records (YouTube unlisted, Mux, Bunny Stream).
create table public.video_assets (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('youtube', 'mux', 'bunny')),
  title text,
  course_id uuid references public.courses (id) on delete cascade,
  provider_asset_id text,
  provider_upload_id text,
  playback_id text,
  status text not null default 'waiting' check (status in ('waiting', 'processing', 'ready', 'errored')),
  duration_seconds numeric(10, 2),
  aspect_ratio text,
  thumbnail_url text,
  captions jsonb not null default '[]'::jsonb,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index video_assets_course_idx on public.video_assets (course_id);
create unique index video_assets_provider_asset_idx on public.video_assets (provider, provider_asset_id) where provider_asset_id is not null;
create index video_assets_upload_idx on public.video_assets (provider, provider_upload_id) where provider_upload_id is not null;

-- A lesson is a sequence of typed content blocks.
create table public.lesson_content_blocks (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  block_type text not null check (block_type in (
    'video', 'video_playlist', 'embed', 'rich_text', 'pdf', 'document', 'presentation',
    'spreadsheet', 'image', 'file', 'link', 'quiz', 'assignment', 'live_session',
    'recording', 'resource_collection'
  )),
  title text,
  sort_order integer not null default 0,
  data jsonb not null default '{}'::jsonb,
  video_asset_id uuid references public.video_assets (id) on delete set null,
  media_file_id uuid references public.media_files (id) on delete set null,
  quiz_id uuid,
  assignment_id uuid,
  live_session_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lesson_content_blocks_lesson_idx on public.lesson_content_blocks (lesson_id, sort_order);
create index lesson_content_blocks_course_idx on public.lesson_content_blocks (course_id);

create table public.lesson_resources (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete cascade,
  title text not null check (length(title) between 1 and 200),
  description text,
  resource_type text not null check (resource_type in ('file', 'link')),
  media_file_id uuid references public.media_files (id) on delete cascade,
  url text,
  is_downloadable boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((resource_type = 'file' and media_file_id is not null) or (resource_type = 'link' and url is not null))
);
create index lesson_resources_lesson_idx on public.lesson_resources (lesson_id, sort_order);
create index lesson_resources_course_idx on public.lesson_resources (course_id);

create table public.course_reviews (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  title text check (length(title) <= 160),
  body text check (length(body) <= 4000),
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  verified_enrollment boolean not null default false,
  moderated_by uuid references public.profiles (id) on delete set null,
  moderated_at timestamptz,
  moderation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, user_id)
);
create index course_reviews_course_idx on public.course_reviews (course_id, status);

create trigger course_categories_updated_at before update on public.course_categories for each row execute function private.set_updated_at();
create trigger courses_updated_at before update on public.courses for each row execute function private.set_updated_at();
create trigger learning_paths_updated_at before update on public.learning_paths for each row execute function private.set_updated_at();
create trigger course_modules_updated_at before update on public.course_modules for each row execute function private.set_updated_at();
create trigger lessons_updated_at before update on public.lessons for each row execute function private.set_updated_at();
create trigger video_assets_updated_at before update on public.video_assets for each row execute function private.set_updated_at();
create trigger lesson_content_blocks_updated_at before update on public.lesson_content_blocks for each row execute function private.set_updated_at();
create trigger lesson_resources_updated_at before update on public.lesson_resources for each row execute function private.set_updated_at();
create trigger course_reviews_updated_at before update on public.course_reviews for each row execute function private.set_updated_at();

-- Lessons and blocks must stay inside the course of their parent.
create or replace function private.enforce_lesson_course()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_course uuid;
begin
  select course_id into v_course from public.course_modules where id = new.module_id;
  if v_course is null or v_course <> new.course_id then
    raise exception 'Lesson module must belong to the same course';
  end if;
  return new;
end;
$$;
create trigger lessons_course_consistency before insert or update of module_id, course_id on public.lessons
  for each row execute function private.enforce_lesson_course();

create or replace function private.enforce_block_course()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_course uuid;
begin
  select course_id into v_course from public.lessons where id = new.lesson_id;
  if v_course is null or v_course <> new.course_id then
    raise exception 'Content block lesson must belong to the same course';
  end if;
  return new;
end;
$$;
create trigger lesson_content_blocks_course_consistency before insert or update of lesson_id, course_id on public.lesson_content_blocks
  for each row execute function private.enforce_block_course();

alter table public.course_categories enable row level security;
alter table public.courses enable row level security;
alter table public.course_instructors enable row level security;
alter table public.learning_paths enable row level security;
alter table public.learning_path_courses enable row level security;
alter table public.course_modules enable row level security;
alter table public.lessons enable row level security;
alter table public.media_files enable row level security;
alter table public.video_assets enable row level security;
alter table public.lesson_content_blocks enable row level security;
alter table public.lesson_resources enable row level security;
alter table public.course_reviews enable row level security;
