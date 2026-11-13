-- Marketing & content: CMS pages and sections, testimonials, case studies,
-- blog, FAQs, newsletter, leads and platform announcements.

create table public.cms_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (private.is_valid_slug(slug)),
  title text not null,
  seo_title text,
  seo_description text,
  og_image_url text,
  status text not null default 'published' check (status in ('draft', 'published')),
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cms_sections (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.cms_pages (id) on delete cascade,
  section_key text not null check (section_key ~ '^[a-z0-9_]+$'),
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  content jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (page_id, section_key)
);

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  person_name text not null check (length(person_name) between 1 and 120),
  person_role text check (length(person_role) <= 160),
  company text check (length(company) <= 160),
  avatar_url text,
  quote text not null check (length(quote) between 1 and 2000),
  rating smallint check (rating between 1 and 5),
  category_id uuid references public.course_categories (id) on delete set null,
  course_id uuid references public.courses (id) on delete set null,
  consent_confirmed boolean not null default false,
  is_featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  sort_order integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A testimonial can only be published once the person's consent is recorded.
  check (status <> 'published' or consent_confirmed)
);
create index testimonials_status_idx on public.testimonials (status, is_featured, sort_order);

create table public.case_studies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (private.is_valid_slug(slug)),
  kind text not null default 'case_study' check (kind in ('case_study', 'success_story')),
  title text not null check (length(title) between 1 and 200),
  summary text check (length(summary) <= 600),
  cover_image_url text,
  customer_name text,
  business_name text,
  challenge text,
  approach text,
  implementation text,
  outcome text,
  media jsonb not null default '[]'::jsonb,
  course_ids uuid[] not null default '{}',
  consent_confirmed boolean not null default false,
  is_featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  seo_title text,
  seo_description text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'published' or consent_confirmed)
);
create index case_studies_status_idx on public.case_studies (kind, status, published_at desc);

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (private.is_valid_slug(slug)),
  title text not null check (length(title) between 1 and 200),
  excerpt text check (length(excerpt) <= 600),
  body text not null default '',
  cover_image_url text,
  author_id uuid references public.profiles (id) on delete set null,
  author_name text,
  category text,
  tags text[] not null default '{}',
  reading_minutes integer,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'archived')),
  published_at timestamptz,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index blog_posts_status_idx on public.blog_posts (status, published_at desc);

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null check (length(question) between 1 and 400),
  answer text not null,
  category text not null default 'general' check (category in ('general', 'courses', 'billing', 'certificates', 'live', 'technical', 'instructors')),
  sort_order integer not null default 0,
  is_published boolean not null default true,
  show_on_home boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index faqs_category_idx on public.faqs (category, sort_order);

create table public.newsletter_subscriptions (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null unique,
  status text not null default 'subscribed' check (status in ('subscribed', 'unsubscribed')),
  source text,
  unsubscribe_token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  consent_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.marketing_leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(full_name) between 1 and 160),
  email extensions.citext not null,
  phone text,
  subject text,
  message text check (length(message) <= 5000),
  source text not null default 'contact' check (source in ('contact', 'course_interest', 'instructor_application', 'business')),
  course_id uuid references public.courses (id) on delete set null,
  status text not null default 'new' check (status in ('new', 'contacted', 'closed', 'spam')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index marketing_leads_status_idx on public.marketing_leads (status, created_at desc);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 200),
  body text not null,
  audience text not null default 'all' check (audience in ('all', 'students', 'teachers', 'course')),
  course_id uuid references public.courses (id) on delete cascade,
  send_email boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (audience <> 'course' or course_id is not null)
);
create index announcements_published_idx on public.announcements (published_at desc);

create trigger cms_pages_updated_at before update on public.cms_pages for each row execute function private.set_updated_at();
create trigger cms_sections_updated_at before update on public.cms_sections for each row execute function private.set_updated_at();
create trigger testimonials_updated_at before update on public.testimonials for each row execute function private.set_updated_at();
create trigger case_studies_updated_at before update on public.case_studies for each row execute function private.set_updated_at();
create trigger blog_posts_updated_at before update on public.blog_posts for each row execute function private.set_updated_at();
create trigger faqs_updated_at before update on public.faqs for each row execute function private.set_updated_at();

alter table public.cms_pages enable row level security;
alter table public.cms_sections enable row level security;
alter table public.testimonials enable row level security;
alter table public.case_studies enable row level security;
alter table public.blog_posts enable row level security;
alter table public.faqs enable row level security;
alter table public.newsletter_subscriptions enable row level security;
alter table public.marketing_leads enable row level security;
alter table public.announcements enable row level security;
