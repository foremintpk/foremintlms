-- Learning: per-learner assignment deadline reminders.
-- The cron job claims a (assignment, learner, due date) row before notifying,
-- so hourly runs never send the same reminder twice — including assignments
-- whose due date is relative to each learner's enrollment.

create table public.assignment_deadline_reminders (
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  due_at timestamptz not null,
  sent_at timestamptz not null default now(),
  primary key (assignment_id, user_id, due_at)
);
create index assignment_deadline_reminders_user_idx on public.assignment_deadline_reminders (user_id);

alter table public.assignment_deadline_reminders enable row level security;

-- Learners can see which reminders they were sent; writes are server-only.
create policy "assignment_deadline_reminders: owner reads" on public.assignment_deadline_reminders
  for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));

-- Quiz answers are autosaved while an attempt is in progress; this index
-- keeps attempt lookups per learner fast on the quiz page.
create index if not exists quiz_attempts_quiz_user_status_idx on public.quiz_attempts (quiz_id, user_id, status);
create index if not exists assignment_submissions_assignment_user_idx on public.assignment_submissions (assignment_id, user_id, attempt_number desc);
