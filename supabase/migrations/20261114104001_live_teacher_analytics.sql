-- Teacher analytics aggregates.
-- SECURITY INVOKER: every function runs as the calling user, so Row Level
-- Security limits the aggregates to rows the caller may already read (an
-- instructor sees only their assigned courses; an admin sees everything).
-- Aggregating in SQL also avoids PostgREST's per-request row cap.

create or replace function public.teacher_enrollment_series(
  p_course_ids uuid[],
  p_from timestamptz,
  p_to timestamptz,
  p_bucket text default 'day'
)
returns table (bucket_start date, enrollments bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with buckets as (
    select generate_series(
      date_trunc(case when p_bucket = 'week' then 'week' else 'day' end, p_from),
      date_trunc(case when p_bucket = 'week' then 'week' else 'day' end, p_to),
      case when p_bucket = 'week' then interval '1 week' else interval '1 day' end
    )::date as bucket_start
  ), counts as (
    select date_trunc(case when p_bucket = 'week' then 'week' else 'day' end, e.enrolled_at)::date as bucket_start,
           count(*) as enrollments
    from public.enrollments e
    where e.course_id = any (p_course_ids)
      and e.enrolled_at >= p_from
      and e.enrolled_at < p_to
    group by 1
  )
  select b.bucket_start, coalesce(c.enrollments, 0)
  from buckets b
  left join counts c using (bucket_start)
  order by b.bucket_start;
$$;

create or replace function public.teacher_course_completion(
  p_course_ids uuid[],
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (course_id uuid, enrollments bigint, completed bigint, avg_progress numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.course_id,
         count(*) as enrollments,
         count(*) filter (where e.status = 'completed' or e.completed_at is not null) as completed,
         round(avg(e.progress_percent), 1) as avg_progress
  from public.enrollments e
  where e.course_id = any (p_course_ids)
    and (p_from is null or e.enrolled_at >= p_from)
    and (p_to is null or e.enrolled_at < p_to)
  group by e.course_id;
$$;

create or replace function public.teacher_student_count(p_course_ids uuid[])
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select count(distinct e.user_id)
  from public.enrollments e
  where e.course_id = any (p_course_ids)
    and e.status in ('active', 'completed');
$$;

-- For each published lesson in curriculum order: how many enrolled students
-- have completed it. The drop between consecutive lessons is the drop-off.
create or replace function public.teacher_lesson_dropoff(p_course_id uuid)
returns table (
  lesson_id uuid,
  module_title text,
  lesson_title text,
  "position" bigint,
  completed_students bigint,
  enrolled_students bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with enrolled as (
    select count(*) as n from public.enrollments
    where course_id = p_course_id and status in ('active', 'completed', 'expired')
  ), ordered as (
    select l.id, m.title as module_title, l.title as lesson_title,
           row_number() over (order by m.sort_order, m.created_at, l.sort_order, l.created_at) as "position"
    from public.lessons l
    join public.course_modules m on m.id = l.module_id
    where l.course_id = p_course_id and l.is_published and m.is_published
  )
  select o.id, o.module_title, o.lesson_title, o."position",
         (select count(*) from public.lesson_progress p
           where p.lesson_id = o.id and p.status = 'completed') as completed_students,
         (select n from enrolled) as enrolled_students
  from ordered o
  order by o."position";
$$;

create or replace function public.teacher_quiz_stats(
  p_course_ids uuid[],
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  quiz_id uuid,
  course_id uuid,
  title text,
  attempts bigint,
  students bigint,
  avg_percent numeric,
  pass_rate numeric,
  awaiting_review bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select q.id, q.course_id, q.title,
         count(a.id) filter (where a.status in ('graded', 'submitted')) as attempts,
         count(distinct a.user_id) filter (where a.status in ('graded', 'submitted', 'needs_review')) as students,
         round(avg(a.percent) filter (where a.status = 'graded'), 1) as avg_percent,
         round(100.0 * count(*) filter (where a.passed) / nullif(count(*) filter (where a.status = 'graded'), 0), 1) as pass_rate,
         count(a.id) filter (where a.status = 'needs_review') as awaiting_review
  from public.quizzes q
  left join public.quiz_attempts a
    on a.quiz_id = q.id and a.submitted_at >= p_from and a.submitted_at < p_to
  where q.course_id = any (p_course_ids) and q.status <> 'archived'
  group by q.id, q.course_id, q.title
  order by q.title;
$$;

create or replace function public.teacher_assignment_stats(
  p_course_ids uuid[],
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  assignment_id uuid,
  course_id uuid,
  title text,
  max_points numeric,
  submissions bigint,
  pending bigint,
  graded bigint,
  resubmission_requested bigint,
  late bigint,
  avg_grade_percent numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select a.id, a.course_id, a.title, a.max_points,
         count(s.id) as submissions,
         count(s.id) filter (where s.status in ('submitted', 'under_review')) as pending,
         count(s.id) filter (where s.status in ('graded', 'approved')) as graded,
         count(s.id) filter (where s.status = 'resubmission_requested') as resubmission_requested,
         count(s.id) filter (where s.is_late) as late,
         round(avg(100.0 * s.grade_points / nullif(a.max_points, 0)) filter (where s.grade_points is not null), 1) as avg_grade_percent
  from public.assignments a
  left join public.assignment_submissions s
    on s.assignment_id = a.id and s.submitted_at >= p_from and s.submitted_at < p_to
  where a.course_id = any (p_course_ids) and a.status <> 'archived'
  group by a.id, a.course_id, a.title, a.max_points
  order by a.title;
$$;

revoke execute on function public.teacher_enrollment_series(uuid[], timestamptz, timestamptz, text) from public, anon;
revoke execute on function public.teacher_course_completion(uuid[], timestamptz, timestamptz) from public, anon;
revoke execute on function public.teacher_student_count(uuid[]) from public, anon;
revoke execute on function public.teacher_lesson_dropoff(uuid) from public, anon;
revoke execute on function public.teacher_quiz_stats(uuid[], timestamptz, timestamptz) from public, anon;
revoke execute on function public.teacher_assignment_stats(uuid[], timestamptz, timestamptz) from public, anon;
grant execute on function public.teacher_enrollment_series(uuid[], timestamptz, timestamptz, text) to authenticated;
grant execute on function public.teacher_course_completion(uuid[], timestamptz, timestamptz) to authenticated;
grant execute on function public.teacher_student_count(uuid[]) to authenticated;
grant execute on function public.teacher_lesson_dropoff(uuid) to authenticated;
grant execute on function public.teacher_quiz_stats(uuid[], timestamptz, timestamptz) to authenticated;
grant execute on function public.teacher_assignment_stats(uuid[], timestamptz, timestamptz) to authenticated;

-- Lookups used by provider webhooks and the attendance sync.
create index if not exists live_sessions_connection_idx on public.live_sessions (provider_connection_id);
create index if not exists live_session_attendance_user_idx on public.live_session_attendance (user_id);
