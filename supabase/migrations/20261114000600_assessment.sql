-- Assessment: question banks, quizzes, attempts, assignments, submissions,
-- feedback and certificates.

create table public.question_banks (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null check (length(title) between 1 and 200),
  description text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index question_banks_course_idx on public.question_banks (course_id);

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete set null,
  title text not null check (length(title) between 1 and 200),
  description text,
  time_limit_minutes integer check (time_limit_minutes between 1 and 600),
  max_attempts integer check (max_attempts between 1 and 100),
  passing_score integer not null default 70 check (passing_score between 0 and 100),
  shuffle_questions boolean not null default false,
  shuffle_options boolean not null default false,
  -- When set, each attempt draws this many questions from the bank.
  question_bank_id uuid references public.question_banks (id) on delete set null,
  draw_count integer check (draw_count > 0),
  show_correct_answers text not null default 'after_submit' check (show_correct_answers in ('never', 'after_submit', 'after_pass')),
  retry_cooldown_minutes integer not null default 0 check (retry_cooldown_minutes >= 0),
  counts_toward_completion boolean not null default true,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (draw_count is null or question_bank_id is not null)
);
create index quizzes_course_idx on public.quizzes (course_id);
create index quizzes_lesson_idx on public.quizzes (lesson_id);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  quiz_id uuid references public.quizzes (id) on delete cascade,
  question_bank_id uuid references public.question_banks (id) on delete cascade,
  question_type text not null check (question_type in ('single_choice', 'multiple_choice', 'true_false', 'short_answer')),
  prompt text not null check (length(prompt) between 1 and 4000),
  explanation text,
  points numeric(6, 2) not null default 1 check (points > 0),
  sort_order integer not null default 0,
  accepted_answers text[] not null default '{}',
  case_sensitive boolean not null default false,
  requires_manual_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (quiz_id is not null or question_bank_id is not null)
);
create index quiz_questions_quiz_idx on public.quiz_questions (quiz_id, sort_order);
create index quiz_questions_bank_idx on public.quiz_questions (question_bank_id);

create table public.quiz_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  label text not null check (length(label) between 1 and 1000),
  is_correct boolean not null default false,
  sort_order integer not null default 0
);
create index quiz_options_question_idx on public.quiz_options (question_id, sort_order);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'needs_review', 'graded', 'expired')),
  question_ids uuid[] not null default '{}',
  option_orders jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  submitted_at timestamptz,
  score numeric(8, 2),
  max_score numeric(8, 2),
  percent numeric(5, 2),
  passed boolean,
  graded_by uuid references public.profiles (id) on delete set null,
  graded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (quiz_id, user_id, attempt_number)
);
create index quiz_attempts_user_idx on public.quiz_attempts (user_id, quiz_id);
create index quiz_attempts_review_idx on public.quiz_attempts (course_id, status) where status = 'needs_review';

create table public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts (id) on delete cascade,
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  selected_option_ids uuid[] not null default '{}',
  text_answer text check (length(text_answer) <= 4000),
  is_correct boolean,
  points_awarded numeric(6, 2),
  feedback text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete set null,
  title text not null check (length(title) between 1 and 200),
  instructions text,
  max_points numeric(6, 2) not null default 100 check (max_points > 0),
  passing_points numeric(6, 2),
  due_at timestamptz,
  due_days_after_enrollment integer check (due_days_after_enrollment > 0),
  allow_late_submissions boolean not null default true,
  late_penalty_percent integer not null default 0 check (late_penalty_percent between 0 and 100),
  submission_types text[] not null default '{text,file,link}',
  allowed_file_types text[] not null default '{pdf,docx,pptx,xlsx,png,jpg,jpeg,zip}',
  max_file_size_mb integer not null default 25 check (max_file_size_mb between 1 and 500),
  max_files integer not null default 5 check (max_files between 0 and 20),
  rubric jsonb not null default '[]'::jsonb,
  grading_criteria text,
  counts_toward_completion boolean not null default true,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  supporting_media_ids uuid[] not null default '{}',
  deadline_reminder_sent_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (passing_points is null or passing_points <= max_points)
);
create index assignments_course_idx on public.assignments (course_id);
create index assignments_due_idx on public.assignments (due_at) where due_at is not null;

create table public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  attempt_number integer not null default 1 check (attempt_number > 0),
  status text not null default 'submitted' check (status in ('submitted', 'under_review', 'resubmission_requested', 'graded', 'approved')),
  text_body text check (length(text_body) <= 50000),
  links text[] not null default '{}',
  file_ids uuid[] not null default '{}',
  submitted_at timestamptz not null default now(),
  is_late boolean not null default false,
  grade_points numeric(6, 2),
  rubric_scores jsonb not null default '{}'::jsonb,
  graded_at timestamptz,
  graded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, user_id, attempt_number)
);
create index assignment_submissions_course_status_idx on public.assignment_submissions (course_id, status);
create index assignment_submissions_user_idx on public.assignment_submissions (user_id, assignment_id);

create table public.assignment_feedback (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.assignment_submissions (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (length(body) between 1 and 20000),
  created_at timestamptz not null default now()
);
create index assignment_feedback_submission_idx on public.assignment_feedback (submission_id, created_at);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_number text not null unique,
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  enrollment_id uuid references public.enrollments (id) on delete set null,
  recipient_name text not null,
  course_title text not null,
  instructor_name text,
  completion_date date not null,
  issued_at timestamptz not null default now(),
  status text not null default 'issued' check (status in ('issued', 'revoked')),
  revoked_at timestamptz,
  revoked_reason text,
  storage_path text,
  metadata jsonb not null default '{}'::jsonb,
  unique (user_id, course_id)
);

create table public.certificate_verifications (
  id uuid primary key default gen_random_uuid(),
  certificate_id uuid not null references public.certificates (id) on delete cascade,
  verified_at timestamptz not null default now(),
  ip_hash text,
  user_agent text
);
create index certificate_verifications_cert_idx on public.certificate_verifications (certificate_id);

alter table public.lesson_content_blocks
  add constraint lesson_content_blocks_quiz_fk foreign key (quiz_id) references public.quizzes (id) on delete set null,
  add constraint lesson_content_blocks_assignment_fk foreign key (assignment_id) references public.assignments (id) on delete set null;

create trigger question_banks_updated_at before update on public.question_banks for each row execute function private.set_updated_at();
create trigger quizzes_updated_at before update on public.quizzes for each row execute function private.set_updated_at();
create trigger quiz_questions_updated_at before update on public.quiz_questions for each row execute function private.set_updated_at();
create trigger assignments_updated_at before update on public.assignments for each row execute function private.set_updated_at();
create trigger assignment_submissions_updated_at before update on public.assignment_submissions for each row execute function private.set_updated_at();

alter table public.question_banks enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_options enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_answers enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.assignment_feedback enable row level security;
alter table public.certificates enable row level security;
alter table public.certificate_verifications enable row level security;
